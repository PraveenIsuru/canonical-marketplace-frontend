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

/*
|--------------------------------------------------------------------------
| UTC days
|--------------------------------------------------------------------------
|
| Analytics ranges are UTC days, matching section 5 of the contract. These build and
| read `YYYY-MM-DD` strings without ever going through a local timezone, because a
| seller in Colombo asking for "today" and getting yesterday's bar is exactly the kind
| of off by one that only shows up in production.
*/

/** Today as a UTC calendar day. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A UTC calendar day, a whole number of days before today. */
export function utcDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * A short axis label for a UTC day, such as "20 Aug".
 *
 * The string is treated as a plain calendar date and never shifted, so the label always
 * names the same day the API counted.
 */
export function formatUtcDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return format(new Date(year, month - 1, date), 'd MMM');
}

/** Whole days between two UTC calendar days, inclusive of both ends. */
export function utcDaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}
