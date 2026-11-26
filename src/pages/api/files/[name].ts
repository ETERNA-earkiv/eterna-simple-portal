/**
 * Astro API endpoint: PUT /api/files/<filnamn>
 * Tar emot en PDF från adminytan och sparar den i config-katalogen.
 * Filen blir publik på /filer/<filnamn>. Kräver ETERNA-session.
 */

import type { APIRoute } from 'astro';
import { hasEternaSession } from '@lib/server/admin-auth';
import {
  MAX_FILE_BYTES,
  isPdf,
  normalizeFileName,
  saveUploadedFile,
  uploadedFilesDir,
} from '@lib/server/uploaded-files';

const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Läser bodyn men avbryter så fort gränsen passeras. null = för stor. */
async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export const PUT: APIRoute = async ({ request, params }) => {
  if (!(await hasEternaSession(request))) {
    return json(401, { error: 'Du måste vara inloggad för att ladda upp filer.' });
  }

  const name = normalizeFileName(params.name ?? '');
  if (!name) {
    return json(400, { error: 'Filnamnet måste sluta på .pdf. Bara PDF-filer kan laddas upp.' });
  }

  const tooLarge = json(413, { error: `Filen är för stor. Högst ${MAX_MB} MB.` });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE_BYTES) return tooLarge;

  const bytes = await readLimited(request, MAX_FILE_BYTES);
  if (bytes === null) return tooLarge;
  if (bytes.byteLength === 0) return json(400, { error: 'Filen är tom.' });
  if (!isPdf(bytes)) return json(400, { error: 'Filen är inte en PDF.' });

  try {
    const { replaced } = await saveUploadedFile(uploadedFilesDir(), name, bytes);
    return json(200, { name, url: `/filer/${name}`, size: bytes.byteLength, replaced });
  } catch {
    return json(500, { error: 'Kunde inte spara filen.' });
  }
};
