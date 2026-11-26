import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uploadPdf } from './uploads';

function pdfFile(name: string): File {
  return new File(['%PDF-1.7\nexempel'], name, { type: 'application/pdf' });
}

describe('uploadPdf', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skickar filen till /api/files med filnamnet i adressen', async () => {
    const result = { name: 'min-lista.pdf', url: '/filer/min-lista.pdf', size: 16, replaced: false };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    const file = pdfFile('Min lista.pdf');

    expect(await uploadPdf(file)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith('/api/files/Min%20lista.pdf', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      credentials: 'include',
      body: file,
    });
  });

  it('kastar serverns felmeddelande', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Filen är inte en PDF.' }), { status: 400 }));
    await expect(uploadPdf(pdfFile('lista.pdf'))).rejects.toThrow('Filen är inte en PDF.');
  });

  it('kastar ett allmänt fel när svaret saknar meddelande', async () => {
    fetchMock.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    await expect(uploadPdf(pdfFile('lista.pdf'))).rejects.toThrow('Kunde inte ladda upp filen.');
  });
});
