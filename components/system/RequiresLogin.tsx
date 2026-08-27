'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/auth/useSession';

interface Props {
  /**
   * Where to send the visitor back to, and what to do when they arrive.
   *
   * Include any intent as a query parameter, so the screen can finish what they
   * started rather than dropping them back on a page with no memory of why they
   * signed in.
   */
  returnTo: string;
  /** What the action is, in a few words, for the prompt. */
  action: string;
  /** Rendered once there is a session. */
  children: ReactNode;
  /** Rendered while the session is still resolving, to avoid a flash of "sign in". */
  fallback?: ReactNode;
}

/**
 * X-06 The login wrapper.
 *
 * Wraps an action a signed out visitor cannot take. It does not block the page, and it
 * never hides what the action was: an anonymous visitor sees the same control they
 * would see signed in, and choosing it takes them to sign in and then straight back.
 *
 * The reason it wraps rather than guards a route is that this platform's public
 * catalogue is fully browsable without an account. Someone reading a product page has
 * done nothing wrong by not being signed in, and turning that page into a login wall
 * because it happens to carry one saveable control would trade the whole of the public
 * catalogue for one button.
 *
 * The session comes from `/api/auth/session`, like the rest of the client side session
 * handling. It is a **rendering hint only**: the endpoint behind the action checks the
 * token itself and refuses regardless of what this decided.
 */
export function RequiresLogin({ returnTo, action, children, fallback = null }: Props) {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/login?next=${encodeURIComponent(returnTo)}`}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Sign in to {action}
      </Link>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {/*
          Says what happens next. "Sign in" on its own reads like the start of a
          detour, and a visitor part way through choosing a variant wants to know they
          will not lose it.
        */}
        We will bring you straight back here.
      </span>
    </div>
  );
}
