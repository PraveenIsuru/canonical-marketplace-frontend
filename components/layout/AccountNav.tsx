'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/useSession';
import { isAdmin, isSeller } from '@/lib/auth/guards';
import { queryKeys } from '@/lib/query/keys';

/**
 * The session dependent half of X-04.
 *
 * Client rendered on purpose. The static half of the navigation lives in the server
 * component beside this one, so public catalogue pages stay statically generated.
 *
 * Buyer and seller entries render together. There is no mode switch, because a single
 * account may hold both roles.
 *
 * There is no notification bell here or anywhere. Notifications are email only.
 */
export function AccountNav() {
  const { session, isLoading } = useSession();
  const seller = isSeller(session);
  const admin = isAdmin(session);

  if (isLoading) {
    // A neutral placeholder rather than the anonymous state, so the bar does not
    // flick from "Sign in" to a name on every page load.
    return <span className="h-5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />;
  }

  if (!session) {
    return <NavLink href="/login">Sign in</NavLink>;
  }

  return (
    <>
      <NavLink href="/wishlist">Wishlist</NavLink>
      {!seller && <NavLink href="/sell/start">Start selling</NavLink>}

      {seller && (
        <>
          <NavLink href="/dashboard">Dashboard</NavLink>
          {/* The catalogue check, which is the only way into listing anything. */}
          <NavLink href="/sell/attach">List a product</NavLink>
          <NavLink href="/listings">Listings</NavLink>
          <NavLink href="/proposals">Proposals</NavLink>
          <NavLink href="/analytics">Analytics</NavLink>
        </>
      )}

      {admin && (
        <>
          <NavLink href="/admin/escalations">Escalations</NavLink>
          <NavLink href="/admin/products">Products</NavLink>
          <NavLink href="/admin/metrics">Metrics</NavLink>
        </>
      )}

      <span className="ml-auto flex items-center gap-4">
        <NavLink href="/account">{session.name}</NavLink>
        <SignOutButton />
      </span>
    </>
  );
}

function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    // Drop the cached session so the navigation re-resolves as anonymous immediately.
    queryClient.setQueryData(queryKeys.user.current(), null);
    await queryClient.invalidateQueries();
    router.push('/');
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="text-zinc-600 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {pending ? 'Signing out' : 'Sign out'}
    </button>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      {children}
    </Link>
  );
}
