import type { ReactNode } from 'react';

/**
 * The (seller) route group.
 *
 * Access is enforced twice, and neither is redundant. `proxy.ts` redirects a visitor
 * with no token before the page runs, and the API refuses every seller endpoint with
 * `store_required` for a user who holds no store. The screens themselves only decide
 * what to show, never whether the caller is allowed.
 */
export default function SellerLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl">{children}</div>;
}
