/**
 * Role guards.
 *
 * These are rendering hints only. Every one of them can be wrong without being a
 * security problem, because the API decides authorisation on every request. Their
 * job is to avoid showing a control that would only fail when clicked.
 *
 * Roles are derived, never stored. A user is a seller when a store exists on their
 * session, and an administrator when the flag is set. There is no roles array.
 */

import type { SessionUser } from '@/types/store';

export function isAuthenticated(session: SessionUser | null): session is SessionUser {
  return session !== null;
}

export function isSeller(session: SessionUser | null): boolean {
  return session?.store != null;
}

export function isAdmin(session: SessionUser | null): boolean {
  return session?.is_admin === true;
}

/** A store is visible to buyers if and only if it holds at least one attachment. */
export function hasLiveStore(session: SessionUser | null): boolean {
  return session?.store?.is_live === true;
}

export function isEmailVerified(session: SessionUser | null): boolean {
  return session?.email_verified_at != null;
}

/** Nearby availability alerts need a saved location. Its absence is not a failure. */
export function hasSavedLocation(session: SessionUser | null): boolean {
  return session?.latitude != null && session?.longitude != null;
}

/**
 * Version history is visible to administrators and to sellers currently attached to
 * the product. Attachment is evaluated at request time, so a seller who detaches
 * loses access mid session and the next request returns 403.
 */
export function canViewVersionHistory(
  session: SessionUser | null,
  attachedStoreIds: number[],
): boolean {
  if (isAdmin(session)) return true;
  if (!isSeller(session)) return false;
  return attachedStoreIds.includes(session!.store!.id);
}

/**
 * Deliberately not implemented as a guard.
 *
 * Proposal review eligibility depends on which stores were attached at the moment the
 * proposal opened, which the client cannot know. The proposal payload carries a
 * `can_vote` hint from the server instead. Trust that, and let the vote call be the
 * real check.
 */
