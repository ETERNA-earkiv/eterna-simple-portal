/**
 * Astro API endpoint: GET /filer/<filnamn>
 * Serverar PDF-filer som laddats upp via adminytan. Publik adress.
 */

import type { APIRoute } from 'astro';
import { normalizeFileName, readUploadedFile, uploadedFilesDir } from '@lib/server/uploaded-files';

const notFound = () => new Response('Filen finns inte.', {
  status: 404,
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

export const GET: APIRoute = async ({ params }) => {
  // Bara namn i rensad form släpps igenom — då kan adressen aldrig peka
  // utanför filmappen eller på något annat än en uppladdad PDF.
  const name = params.name ?? '';
  if (normalizeFileName(name) !== name) return notFound();

  const bytes = await readUploadedFile(uploadedFilesDir(), name);
  if (!bytes) return notFound();

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `inline; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      // Samma adress används när filen ersätts, så webbläsaren ska fråga om.
      'Cache-Control': 'no-cache',
    },
  });
};
