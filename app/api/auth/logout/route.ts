/**
 * Logout. Revokes the token server side, then clears the cookie.
 *
 * The cookie is cleared whether or not the API call succeeds. An already expired
 * token should still leave the browser in a signed out state rather than stuck.
 */

import { NextResponse } from 'next/server';
import { apiFetchServer } from '@/lib/api/client';
import { AUTH_COOKIE, getToken } from '@/lib/auth/session';

export async function POST() {
  const token = await getToken();

  if (token) {
    try {
      await apiFetchServer('/api/logout', { method: 'POST', token, cache: 'no-store' });
    } catch {
      // Revocation failed, most likely because the token had already expired.
      // Clearing the cookie is still the right outcome.
    }
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(AUTH_COOKIE);

  return response;
}
