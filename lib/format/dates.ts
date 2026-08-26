/**
 * Date formatting.
 *
 * The API sends ISO 8601 in UTC and never a pre-formatted string, so all display
 * formatting happens here.
 */

import { format, formatDistanceToNowStrict, isPast, parseISO } from 'date-fns';

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy');
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'd MMM yyyy, HH:mm');
}

/**
 * Time remaining on a review window.
 *
 * Returns null when the deadline has passed, so the caller renders the closed state
 * rather than a negative countdown. Also returns null for a null deadline, which is
 * what an escalated proposal carries, because no deadline applies to one.
 */
export function timeRemaining(iso: string | null): string | null {
  if (iso === null) return null;

  const deadline = parseISO(iso);
  if (isPast(deadline)) return null;

  return formatDistanceToNowStrict(deadline);
}

export function hasPassed(iso: string | null): boolean {
  if (iso === null) return false;
  return isPast(parseISO(iso));
}

export function formatRelative(iso: string): string {
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
}
