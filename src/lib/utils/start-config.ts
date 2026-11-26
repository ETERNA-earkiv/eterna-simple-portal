/**
 * Söksidans texter (startConfig i config.json).
 *
 * config.json skrivs via import i adminytan, så formatet kan vara fel.
 * Ogiltiga delar plockas bort här i stället för att krascha söksidan för
 * alla besökare.
 */

import type { AboutSourceLink, StartConfig, StartSection } from '@lib/api/config';

export type StartBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; start: number; items: string[] };

const NUMBERED_LINE = /^(\d+)[.)]\s+(.*)$/;

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Tillåter bara http(s), mailto och sökvägar på den egna portalen. */
export function isSafeLinkUrl(url: string): boolean {
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return true;
  return url.startsWith('/') && !url.startsWith('//');
}

function normalizeLink(value: unknown): AboutSourceLink | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { label, url } = value as Record<string, unknown>;
  const cleanLabel = nonEmptyString(label);
  const cleanUrl = nonEmptyString(url);
  if (!cleanLabel || !cleanUrl || !isSafeLinkUrl(cleanUrl)) return undefined;
  return { label: cleanLabel, url: cleanUrl };
}

function normalizeSection(value: unknown): StartSection | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { heading, body, link } = value as Record<string, unknown>;
  const cleanBody = nonEmptyString(body);
  if (!cleanBody) return undefined;

  const section: StartSection = { body: cleanBody };
  const cleanHeading = nonEmptyString(heading);
  if (cleanHeading) section.heading = cleanHeading;
  const cleanLink = normalizeLink(link);
  if (cleanLink) section.link = cleanLink;
  return section;
}

/**
 * Rensar startConfig. Returnerar null när inget användbart finns kvar, så
 * söksidan då visas med standardrubrik och utan extra text.
 */
export function normalizeStartConfig(raw: unknown): StartConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { title, infoText, sections } = raw as Record<string, unknown>;

  const cleanSections = Array.isArray(sections)
    ? sections.map(normalizeSection).filter((s): s is StartSection => s !== undefined)
    : [];
  const cleanTitle = nonEmptyString(title);
  const cleanInfoText = nonEmptyString(infoText);

  if (!cleanTitle && !cleanInfoText && cleanSections.length === 0) return null;

  const config: StartConfig = { sections: cleanSections };
  if (cleanTitle) config.title = cleanTitle;
  if (cleanInfoText) config.infoText = cleanInfoText;
  return config;
}

/**
 * Delar en brödtext i stycken. Blankrad ger nytt stycke. Ett stycke där
 * varje rad börjar med "1.", "2." osv. blir en numrerad lista, så att
 * skärmläsare läser den som en lista.
 */
export function parseStartBody(body: string): StartBlock[] {
  const blocks: StartBlock[] = [];

  for (const chunk of body.split(/\n\s*\n/)) {
    const text = chunk.trim();
    if (!text) continue;

    const lines = text.split('\n').map((line) => line.trim());
    const matches = lines.map((line) => NUMBERED_LINE.exec(line));

    if (lines.length >= 2 && matches.every((m) => m !== null)) {
      blocks.push({
        type: 'list',
        start: Number(matches[0]![1]),
        items: matches.map((m) => m![2]),
      });
    } else {
      blocks.push({ type: 'paragraph', text });
    }
  }

  return blocks;
}
