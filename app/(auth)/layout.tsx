import type { ReactNode } from 'react';

/**
 * The (auth) route group.
 *
 * Narrow, centred column. These screens are single purpose forms and reading a form
 * that stretches the full page width is unpleasant.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-sm py-8">{children}</div>;
}
