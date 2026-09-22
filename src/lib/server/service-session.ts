/**
 * Service Account Session Manager
 *
 * Hanterar en server-side ETERNA-session för portalen.
 * Används för att låta anonyma besökare söka utan inloggning.
 *
 * - Lazy init: autentiserar vid första anropet, inte vid startup
 * - Cachar JSESSIONID i minnet
 * - Re-autentiserar automatiskt vid 401 (session expired)
 * - Deduplicerar samtida auth-försök (Promise-lock)
 */

import { ETERNA_API_URL, PORTAL_SERVICE_USER, PORTAL_SERVICE_PASSWORD } from './env';

let cachedSessionId: string | null = null;
let authPromise: Promise<string> | null = null;

/**
 * Autentisera mot ETERNA och extrahera JSESSIONID.
 *
 * Använder session-inloggningsendpointen (samma som webbformuläret), INTE
 * HTTP Basic Auth mot API:et. ETERNA:s Basic Auth-hantering för /api/v2/*
 * validerar aldrig credentials korrekt — varje request identifieras som
 * `guest` oavsett rätt/fel lösenord (verifierat både med curl direkt mot
 * ETERNA och med JWT/Bearer-access-keys, som uppvisar samma symptom).
 * Session-login-endpointen är däremot bevisat fungerande.
 */
async function authenticate(): Promise<string> {
  const res = await fetch(`${ETERNA_API_URL}/api/v2/members/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    // Lösenordet skickas som ETERNA:s SecureString-format (array av tecken),
    // inte som en vanlig sträng — det är vad login-endpointen kräver.
    body: JSON.stringify({
      username: PORTAL_SERVICE_USER,
      password: { chars: Array.from(PORTAL_SERVICE_PASSWORD) },
    }),
  });

  if (!res.ok) {
    const status = res.status;
    if (status === 401 || status === 403) {
      throw new Error(
        `Service account autentisering misslyckades (${status}). Kontrollera PORTAL_SERVICE_USER/PASSWORD.`,
      );
    }
    throw new Error(`ETERNA svarade med ${status} vid service account auth.`);
  }

  // Extrahera JSESSIONID från Set-Cookie header
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/JSESSIONID=([^;]+)/);
  if (!match) {
    throw new Error(
      'ETERNA returnerade inget JSESSIONID cookie. Kontrollera att ETERNA körs korrekt.',
    );
  }

  return match[1];
}

/**
 * Hämta en giltig service account JSESSIONID.
 * Cachar sessionen och deduplicerar samtida anrop.
 */
export async function getServiceSessionCookie(): Promise<string> {
  if (cachedSessionId) {
    return `JSESSIONID=${cachedSessionId}`;
  }

  // Deduplicera: om auth redan pågår, vänta på samma Promise
  if (authPromise) {
    const id = await authPromise;
    return `JSESSIONID=${id}`;
  }

  authPromise = authenticate();
  try {
    cachedSessionId = await authPromise;
    return `JSESSIONID=${cachedSessionId}`;
  } catch (err) {
    cachedSessionId = null;
    throw err;
  } finally {
    authPromise = null;
  }
}

/**
 * Invalidera cached session. Anropas av proxyn vid 401/403 från ETERNA.
 *
 * Tar emot den specifika session-id som visade sig ogiltig, och rensar
 * cachen bara om den fortfarande matchar. Söksidan skickar flera parallella
 * requests (aips/find, representations/find, files/find, ...) — utan detta
 * skulle en request som just ogiltigförklarar en död session kunna radera
 * en giltig session som en SAMTIDIG syskon-request precis hann hämta,
 * vilket tvingar in alla i en oändlig omloggnings-kapplöpning.
 */
export function invalidateServiceSession(staleSessionId?: string): void {
  if (staleSessionId === undefined || cachedSessionId === staleSessionId) {
    cachedSessionId = null;
  }
}
