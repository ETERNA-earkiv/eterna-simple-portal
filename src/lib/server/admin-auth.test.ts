import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@lib/server/env', () => ({
  ETERNA_API_URL: 'http://mock-eterna:8080',
}));

import { hasEternaSession } from './admin-auth';

function request(cookie?: string): Request {
  return new Request('http://localhost/api/x', {
    headers: cookie ? { cookie } : {},
  });
}

describe('hasEternaSession', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nekar utan sessionscookie och frågar inte ETERNA', async () => {
    expect(await hasEternaSession(request())).toBe(false);
    expect(await hasEternaSession(request('annat=1'))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('godkänner en inloggad användare och skickar cookien till ETERNA', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'admin' }), { status: 200 }));
    expect(await hasEternaSession(request('JSESSIONID=abc'))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://mock-eterna:8080/api/v2/members/users/authenticated',
      { headers: { Cookie: 'JSESSIONID=abc' } },
    );
  });

  it('nekar gästanvändaren', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'guest' }), { status: 200 }));
    expect(await hasEternaSession(request('JSESSIONID=abc'))).toBe(false);
  });

  it('nekar när ETERNA svarar med fel', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 401 }));
    expect(await hasEternaSession(request('JSESSIONID=abc'))).toBe(false);
  });

  it('nekar när ETERNA inte går att nå', async () => {
    fetchMock.mockRejectedValue(new Error('nätverksfel'));
    expect(await hasEternaSession(request('JSESSIONID=abc'))).toBe(false);
  });
});
