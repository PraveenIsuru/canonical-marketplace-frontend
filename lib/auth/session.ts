/**
 * Server side session resolution.
 *
 * The Sanctum token lives in an httpOnly cookie written by the login route handler.
 * Client JavaScript never touches it. Everything here runs on the server.
 */

import { cookies } from 'next/headers';
import { apiFetchServer } from '@/lib/api/client';
import type { SessionUser } from '@/types/store';

export const AUTH_COOKIE = 'auth_token';

/** Reads the token from the httpOnly cookie. Server only. */
export async function getToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE)?.value ?? null;
}

/**
 * Resolves the current user, or null when there is no valid session.
 *
 * Never cached. A stale session would render the wrong navigation, and worse, would
 * show seller entries to somebody whose store was removed.
 *
 * Do not call this from a public catalogue route. Those must not resolve a session
 * at all, which is why the proxy matcher excludes them.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    return await apiFetchServer<SessionUser>('/api/user', {
      token,
      cache: 'no-store',
    });
  } catch {
    // An expired or revoked token is an anonymous visitor, not an error to surface.
    return null;
  }
}
