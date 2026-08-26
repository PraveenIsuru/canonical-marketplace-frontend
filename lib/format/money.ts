/**
 * Money formatting.
 *
 * Prices cross the boundary as integers in the smallest currency unit. Division
 * happens here and nowhere else. Never store a float, never send one.
 */

/**
 * Formats a minor unit integer for display.
 *
 * Returns null for a null amount rather than "0.00", because a product with no
 * sellers has no price at all, which is different from a price of zero.
 */
export function formatMoney(priceMinor: number | null, currency: string | null): string | null {
  if (priceMinor === null || currency === null) return null;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(priceMinor / 100);
  } catch {
    // An unrecognised currency code should not blank the page.
    return `${currency} ${(priceMinor / 100).toFixed(2)}`;
  }
}

/** For a price range, as shown on a product card with several sellers. */
export function formatMoneyRange(
  lowMinor: number | null,
  highMinor: number | null,
  currency: string | null,
): string | null {
  const low = formatMoney(lowMinor, currency);
  if (low === null) return null;
  if (highMinor === null || highMinor === lowMinor) return low;

  return `${low} to ${formatMoney(highMinor, currency)}`;
}

/** Parses a user entered price into minor units. Returns null when not a valid amount. */
export function parseMoneyToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const minor = Math.round(Number.parseFloat(trimmed) * 100);
  // Zero and negative prices are rejected by the API. Catch it before the round trip.
  return minor > 0 ? minor : null;
}

/** Distance for the seller list. Null means no coordinates were supplied, so render nothing. */
export function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;

  return `${distanceKm.toFixed(1)} km`;
}
