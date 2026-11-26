import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GET } from './[name]';

const PDF = new TextEncoder().encode('%PDF-1.7\nexempel');

function get(name: string) {
  return GET({ params: { name } } as any) as Promise<Response>;
}

describe('GET /filer/[name]', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'portal-filer-'));
    const configDir = join(root, 'public', 'assets', 'config');
    await mkdir(join(configDir, 'filer'), { recursive: true });
    await writeFile(join(configDir, 'filer', 'lista.pdf'), PDF);
    await writeFile(join(configDir, 'config.json'), '{"hemligt":true}');
    vi.spyOn(process, 'cwd').mockReturnValue(root);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it('serverar en uppladdad fil som PDF', async () => {
    const res = await get('lista.pdf');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-length')).toBe(String(PDF.length));
    expect(res.headers.get('content-disposition')).toBe('inline; filename="lista.pdf"');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it('låter webbläsaren hämta en ersatt fil direkt', async () => {
    const res = await get('lista.pdf');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('svarar 404 för en fil som inte finns', async () => {
    expect((await get('saknas.pdf')).status).toBe(404);
  });

  it('svarar 404 för namn som inte är i rensad form', async () => {
    expect((await get('Lista.pdf')).status).toBe(404);
    expect((await get('lista')).status).toBe(404);
  });

  it('går inte att ta sig ut ur filmappen', async () => {
    expect((await get('../config.json')).status).toBe(404);
    expect((await get('..\\config.json')).status).toBe(404);
    expect((await get('../config.pdf')).status).toBe(404);
  });
});
