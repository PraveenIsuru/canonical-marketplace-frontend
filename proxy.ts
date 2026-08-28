/**
 * Route protection.
 *
 * In Next.js 16 this file is `proxy.ts`, not `middleware.ts`, and the export is
 * `proxy`, not `middleware`. The behaviour is unchanged.
 *
 * This is an optimistic check only. It asks whether a token is present, nothing more.
 * Real authorisation happens server side on every endpoint, so do not try to decide
 * seller or administrator eligibility here.
 *
 * The matcher excludes the public catalogue. Most traffic is anonymous, and running
 * this on the highest traffic routes would add latency for no benefit.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth/session';

/**
 * Every prefix that requires a token. Access level is enforced by the API, not here.
 *
 * Exported since M12, because `app/robots.ts` disallows exactly these and a second
 * hand written list would drift the first time a route was added. There is one answer
 * to "which routes are behind a login", and both the redirect and the crawl rules read
 * it.
 */
export const PROTECTED_PREFIXES = [
  // Buyer
  '/wishlist',
  /*
   * M9. The M0 list guessed `/verification`; the screen that shipped is `/verify/{slug}`,
   * scoped to a product because verification always is.
   *
   * Safe against `/verify-email`, which is a public auth screen: the check below matches
   * an exact path or one followed by a slash, and `/verify-email` is neither.
   */
  '/verify',
  '/account',
  // Seller onboarding
  '/sell',
  '/store',
  // Seller
  '/dashboard',
  '/listings',
  '/attach',
  '/proposals',
  '/analytics',
  /*
   * M10. Version history, scoped to a product like the verification screens are.
   *
   * Deliberately not `/products/{slug}/versions`: the matcher below excludes
   * `products` so public catalogue traffic never resolves a session, and a protected
   * page under that prefix would silently inherit the exclusion and lose this redirect.
   */
  '/versions',
  // Administrator
  '/admin',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!needsAuth) {
    return NextResponse.next();
  }

  if (request.cookies.has(AUTH_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  /*
   * Everything except the public catalogue, the auth screens, Next internals, and
   * static assets. `products`, `search`, and `stores` are anonymous readable and must
   * never resolve a session.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|products|search|stores|login|register|forgot-password|reset-password|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
