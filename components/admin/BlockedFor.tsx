import { differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * How long the proposing seller has been unable to trade.
 *
 * Computed here rather than read from the API, which sends no such field: the backend
 * chose to send `review_opens_at` and let the client say what it means. That is the
 * right split, but it makes this the one place the arithmetic lives.
 *
 * Counted from **when the proposal opened**, not from when it escalated. The seller was
 * blocked the moment they submitted, and the days spent waiting on peers count as much
 * as the days spent waiting on an administrator.
 *
 * This is the most prominent number on the escalation queue on purpose. Every other
 * figure on that screen describes a proposal; this one describes a person who cannot
 * sell something.
 */
export function BlockedFor({ openedAt, className }: { openedAt: string; className?: string }) {
  const days = differenceInCalendarDays(new Date(), parseISO(openedAt));

  return (
    <span className={className}>
      {days <= 0 ? 'Blocked since today' : `Blocked ${days} ${days === 1 ? 'day' : 'days'}`}
    </span>
  );
}

/** The same number, for callers that need it without the markup. */
export function blockedDays(openedAt: string): number {
  return Math.max(0, differenceInCalendarDays(new Date(), parseISO(openedAt)));
}
