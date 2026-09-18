/**
 * User store — inloggad användare, roller och behörigheter.
 */

import { atom, computed } from 'nanostores';
import { apiGet } from '../api/client';
import type { EternaUser } from '../types/user';
import { ETERNA_ROLES } from '../types/user';

export const $user = atom<EternaUser | null>(null);
export const $userLoading = atom(false);
export const $userError = atom<string | null>(null);

// Computed
export const $isLoggedIn = computed($user, (u) => u != null);
export const $username = computed($user, (u) => u?.name || '');
export const $displayName = computed($user, (u) => u?.fullName || u?.name || '');
export const $roles = computed($user, (u) => u?.allRoles || []);

// Role-based permissions
function hasRole(role: string): boolean {
  const user = $user.get();
  return user?.allRoles?.includes(role) ?? false;
}

export const $canBrowse = computed($user, () => hasRole(ETERNA_ROLES.AIP_READ));
export const $canEditAIPs = computed($user, () =>
  hasRole(ETERNA_ROLES.AIP_UPDATE) || hasRole(ETERNA_ROLES.MEMBER_MANAGE),
);
export const $canDeleteAIPs = computed($user, () =>
  hasRole(ETERNA_ROLES.AIP_DELETE) || hasRole(ETERNA_ROLES.MEMBER_MANAGE),
);
export const $canCreateAIPs = computed($user, () =>
  hasRole(ETERNA_ROLES.AIP_CREATE) || hasRole(ETERNA_ROLES.MEMBER_MANAGE),
);
export const $canManageMembers = computed($user, () =>
  hasRole(ETERNA_ROLES.MEMBER_MANAGE),
);
export const $canCreateRepresentations = computed($user, () =>
  hasRole(ETERNA_ROLES.REPRESENTATION_CREATE) || hasRole(ETERNA_ROLES.MEMBER_MANAGE),
);

export async function loadUserProfile(): Promise<void> {
  $userLoading.set(true);
  $userError.set(null);
  try {
    const user = await apiGet<EternaUser>('/api/v2/members/users/authenticated');
    $user.set(user);
  } catch (err) {
    $userError.set(err instanceof Error ? err.message : 'Kunde inte hämta användarprofil');
  } finally {
    $userLoading.set(false);
  }
}

export function clearUser(): void {
  $user.set(null);
  $userLoading.set(false);
  $userError.set(null);
}
