import type { ReactNode } from 'react';

/**
 * The (admin) route group.
 *
 * Access is enforced twice and neither is redundant. `proxy.ts` redirects a visitor
 * with no token before the page runs, and the API refuses every administrator endpoint
 * with `forbidden` when `is_admin` is false. The screens themselves only decide what to
 * show, never whether the caller is allowed: `isAdmin` is a rendering hint and the
 * request is the real check.
 *
 * Wider than the seller group. These screens carry change comparisons, vote lists, and
 * variant tables side by side, and squeezing them into the same column would make an
 * escalation harder to read than it needs to be.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-4xl">{children}</div>;
}
