import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@lib/server/env', () => ({
  ETERNA_API_URL: 'http://mock-eterna:8080',
}));

import { PUT } from './[name]';
import { MAX_FILE_BYTES } from '@lib/server/uploaded-files';

const PDF = new TextEncoder().encode('%PDF-1.7\nexempel');

function upload(name: string, body: Uint8Array | null, headers: Record<string, string> = {}) {
  const request = new Request(`http://localhost/api/files/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { cookie: 'JSESSIONID=abc', 'content-type': 'application/pdf', ...headers },
    body: body as BodyInit | null,
  });
  return PUT({ request, params: { name } } as any) as Promise<Response>;
}

describe('PUT /api/files/[name]', () => {
  const fetchMock = vi.fn();
  let root: string;
  let filesDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'portal-upload-'));
    filesDir = join(root, 'public', 'assets', 'config', 'filer');
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    fetchMock.mockReset();
    // Ny Response per anrop — en Response-body kan bara läsas en gång.
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 'admin' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('sparar filen under ett rensat namn och svarar med adressen', async () => {
    const res = await upload('Utskrivbar Översikt.pdf', PDF);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: 'utskrivbar-oversikt.pdf',
      url: '/filer/utskrivbar-oversikt.pdf',
      size: PDF.length,
      replaced: false,
    });
    expect(new Uint8Array(await readFile(join(filesDir, 'utskrivbar-oversikt.pdf')))).toEqual(PDF);
  });

  it('talar om när en fil med samma namn ersätts', async () => {
    await upload('lista.pdf', PDF);
    const res = await upload('lista.pdf', PDF);
    expect((await res.json()).replaced).toBe(true);
  });

  it('nekar utan inloggning och sparar ingenting', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: 'guest' }), { status: 200 }));
    const res = await upload('lista.pdf', PDF);
    expect(res.status).toBe(401);
    await expect(readdir(filesDir)).rejects.toThrow();
  });

  it('nekar filnamn som inte slutar på .pdf', async () => {
    const res = await upload('lista.docx', PDF);
    expect(res.status).toBe(400);
  });

  it('nekar innehåll som inte är en PDF', async () => {
    const res = await upload('lista.pdf', new TextEncoder().encode('<html>inte pdf</html>'));
    expect(res.status).toBe(400);
    await expect(readdir(filesDir)).rejects.toThrow();
  });

  it('nekar en tom fil', async () => {
    const res = await upload('lista.pdf', null);
    expect(res.status).toBe(400);
  });

  it('nekar direkt när content-length är över gränsen', async () => {
    const res = await upload('lista.pdf', PDF, { 'content-length': String(MAX_FILE_BYTES + 1) });
    expect(res.status).toBe(413);
  });

  it('nekar när innehållet är större än gränsen även utan content-length', async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(PDF);
    const res = await upload('lista.pdf', big);
    expect(res.status).toBe(413);
    await expect(readdir(filesDir)).rejects.toThrow();
  });

  it('svarar med felmeddelande på svenska', async () => {
    const res = await upload('lista.docx', PDF);
    expect((await res.json()).error).toMatch(/PDF/);
  });
});
