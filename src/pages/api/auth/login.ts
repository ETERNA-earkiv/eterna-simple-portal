/**
 * POST /api/auth/login — loggar in en administratör mot ETERNA.
 *
 * Byter användarnamn/lösenord mot en riktig session via samma
 * session-login-endpoint som ETERNA:s eget webbformulär använder
 * (POST /api/v2/members/users/login).
 *
 * Använder INTE HTTP Basic Auth mot ETERNA:s API — det valideras aldrig
 * korrekt där (varje request identifieras som `guest`, oavsett rätt/fel
 * lösenord, verifierat separat mot ETERNA:s källkod och med curl). Basic
 * Auth-inloggning via /api/v2/aips/find (den tidigare metoden) misslyckades
 * därför alltid, oavsett giltiga credentials.
 */

import type { APIRoute } from 'astro';
import { ETERNA_API_URL } from '@lib/server/env';

interface LoginRequestBody {
  username?: string;
  password?: string;
}

export const POST: APIRoute = async ({ request }) => {
  let body: LoginRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Ogiltig förfrågan.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { username, password } = body;
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Användarnamn och lösenord krävs.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let eternaRes: Response;
  try {
    eternaRes = await fetch(`${ETERNA_API_URL}/api/v2/members/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      // ETERNA:s SecureString-format för lösenord (array av tecken), inte en
      // vanlig sträng.
      body: JSON.stringify({ username, password: { chars: Array.from(password) } }),
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Kunde inte ansluta till arkivet.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!eternaRes.ok) {
    return new Response(JSON.stringify({ error: 'Fel användarnamn eller lösenord.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await eternaRes.json();
  if (user?.id === 'guest') {
    return new Response(JSON.stringify({ error: 'Fel användarnamn eller lösenord.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const setCookie = eternaRes.headers.get('set-cookie');
  if (setCookie) {
    headers.append('Set-Cookie', setCookie);
  }

  return new Response(JSON.stringify(user), { status: 200, headers });
};
