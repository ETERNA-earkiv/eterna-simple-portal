/**
 * Kontroll av att en request kommer från en inloggad ETERNA-användare.
 * Används av de adresser som skriver till portalens delade lagring.
 */

import { ETERNA_API_URL } from '@lib/server/env';

/**
 * true när requesten har en giltig ETERNA-session som inte är gäst.
 * Fail-closed: går ETERNA inte att nå nekas requesten.
 */
export async function hasEternaSession(request: Request): Promise<boolean> {
  const cookie = request.headers.get('cookie') || '';
  if (!cookie.includes('JSESSIONID')) return false;

  try {
    const res = await fetch(`${ETERNA_API_URL}/api/v2/members/users/authenticated`, {
      headers: { Cookie: cookie },
    });
    if (!res.ok) return false;
    return (await res.json())?.id !== 'guest';
  } catch {
    return false;
  }
}
