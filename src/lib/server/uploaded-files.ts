/**
 * Filer som en administratör laddar upp via adminytan (bara PDF).
 *
 * Filerna sparas i config-katalogen, som är en volym i Docker. De överlever
 * därför omstarter och uppgraderingar utan att driftsättningen ändras.
 * De serveras publikt via /filer/<filnamn>.
 */

import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const MAX_BASE_LENGTH = 100;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/** Katalogen läses vid anrop, inte vid import, som för config.json. */
export function uploadedFilesDir(): string {
  return join(process.cwd(), 'public', 'assets', 'config', 'filer');
}

/**
 * Gör om ett filnamn till en säker form: små bokstäver, a–z, siffror,
 * bindestreck och understreck, med ändelsen .pdf. Returnerar null för
 * sökvägar, andra ändelser och namn som blir tomma eller för långa.
 */
export function normalizeFileName(name: string): string | null {
  if (name.includes('/') || name.includes('\\')) return null;

  const lower = name.trim().toLowerCase();
  if (!lower.endsWith('.pdf')) return null;

  const base = lower
    .slice(0, -'.pdf'.length)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!base || base.length > MAX_BASE_LENGTH) return null;
  return `${base}.pdf`;
}

export function isPdf(bytes: Uint8Array): boolean {
  return PDF_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sparar filen. Skriver först till en tillfällig fil och byter sedan namn,
 * så att en avbruten uppladdning aldrig lämnar en halv fil på den publika
 * adressen. `name` ska vara ett namn från normalizeFileName.
 */
export async function saveUploadedFile(
  dir: string,
  name: string,
  bytes: Uint8Array,
): Promise<{ replaced: boolean }> {
  await mkdir(dir, { recursive: true });
  const target = join(dir, name);
  const replaced = await exists(target);

  const temp = join(dir, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, bytes);
    await rename(temp, target);
  } catch (err) {
    await rm(temp, { force: true });
    throw err;
  }
  return { replaced };
}

/** Läser filen, eller returnerar null om den inte finns. */
export async function readUploadedFile(dir: string, name: string): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    return new Uint8Array(await readFile(join(dir, name)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
