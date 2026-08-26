import Link from 'next/link';
import { AccountNav } from './AccountNav';

/**
 * X-04 global navigation.
 *
 * The static half. It reads no cookies and resolves no session, so pages that use it
 * can still be statically generated. That matters because the public catalogue is the
 * highest traffic part of the system and must be indexable.
 *
 * The session dependent half is AccountNav, which is client rendered.
 */
export function Navigation() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm"
      >
        <Link href="/" className="mr-2 font-semibold text-zinc-900 dark:text-zinc-100">
          Marketplace
        </Link>

        {/* Anonymous readable. Everyone sees these, and they need no session. */}
        <Link
          href="/products"
          className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Catalogue
        </Link>
        <Link
          href="/search"
          className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Search
        </Link>

        <AccountNav />
      </nav>
    </header>
  );
}
