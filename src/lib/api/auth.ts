/**
 * Authentication API — login, session validation, logout.
 */

import { $user, clearUser, loadUserProfile } from '../stores/user';

let sessionChecked = false;
let sessionCheckPromise: Promise<boolean> | null = null;

/**
 * Login via portalens egen /api/auth/login-endpoint.
 *
 * Anropar INTE ETERNA:s API med Basic Auth direkt från klienten — det
 * valideras aldrig korrekt där (se src/pages/api/auth/login.ts). Servern
 * byter istället credentials mot en riktig session via ETERNA:s
 * session-login-endpoint och forwardar JSESSIONID-cookien hit.
 */
export async function login(username: string, password: string): Promise<boolean> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) return false;

  // Session established — fetch user profile
  await loadUserProfile();
  sessionChecked = true;
  return true;
}

/**
 * Validate existing session cookie.
 * Called by auth guard on protected routes.
 */
export async function validateSession(): Promise<boolean> {
  if (sessionChecked && $user.get()) return true;

  if (sessionCheckPromise) return sessionCheckPromise;

  sessionCheckPromise = (async () => {
    try {
      const res = await fetch('/api/v2/members/users/authenticated', {
        credentials: 'include',
      });
      if (!res.ok) return false;

      const user = await res.json();
      if (user?.id === 'guest') return false;

      await loadUserProfile();
      sessionChecked = true;
      return true;
    } catch {
      return false;
    } finally {
      sessionCheckPromise = null;
    }
  })();

  return sessionCheckPromise;
}

/**
 * Logout — rensar bara lokalt user-state.
 * JSESSIONID är HttpOnly (sätts av ETERNA) och kan inte rensas från
 * JavaScript. Riktig utloggning (radera cookien + avsluta sessionen i
 * ETERNA) görs av server-routen POST /api/auth/logout, som headerns
 * "Logga ut"-knapp anropar.
 */
export function logout(): void {
  clearUser();
  sessionChecked = false;
}

export function isAuthenticated(): boolean {
  return sessionChecked && $user.get() != null;
}
