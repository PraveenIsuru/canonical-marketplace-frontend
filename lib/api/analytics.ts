/**
 * Seller analytics (EP-39) and public view recording (EP-52).
 *
 * Two calls with opposite access levels, which is why they take different routes to
 * the API. EP-39 is a seller read and goes through this application's proxy, which
 * attaches the Bearer token server side. EP-52 is public and goes **straight to
 * Laravel**, deliberately, for the reason in `recordProductView` below.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { recordedViewSchema, storeAnalyticsSchema } from '@/lib/schemas/analytics';
import type { RecordedView, StoreAnalytics } from '@/types/analytics';

/*
|--------------------------------------------------------------------------
| EP-39 The seller's own view counts
|--------------------------------------------------------------------------
*/

export interface AnalyticsRange {
  /** `YYYY-MM-DD`, a UTC day. Optional; the API defaults to the last thirty days. */
  from?: string;
  to?: string;
}

/**
 * View counts for the calling store, over a date range.
 *
 * There is no store id parameter, here or on the endpoint. The caller's own store is
 * the only store this can answer about, so there is no version of this call that reads
 * somebody else's numbers.
 *
 * The response carries **two counts**: `store_views` reached this store, and
 * `product_views` is all interest in the same products. Render both. A single number
 * with nothing to compare it against does not tell a seller whether forty is good.
 *
 * Days are **UTC days**. A seller in Colombo will see an evening's traffic land on the
 * following day's bar, and correcting for that on the client would make the daily
 * series disagree with the totals.
 */
export async function getStoreAnalytics(range: AnalyticsRange = {}): Promise<StoreAnalytics> {
  const payload = await apiFetch<unknown>('/api/stores/mine/analytics', {
    // The client drops undefined and empty values rather than sending "undefined",
    // so an absent bound simply lets the API apply its own default.
    query: { from: range.from, to: range.to },
  });

  return parseResponse(storeAnalyticsSchema, payload, 'GET /api/stores/mine/analytics');
}

/*
|--------------------------------------------------------------------------
| EP-52 Recording a product page view
|--------------------------------------------------------------------------
*/

/**
 * Records that somebody looked at a product.
 *
 * **This does not go through `/api/proxy`.** The proxy attaches the Bearer token from
 * the httpOnly cookie, and EP-52 is a public route that resolves no session. Sending a
 * token to it would make an anonymous page view arrive looking authenticated, which is
 * what invariant 7 rules out. A cross origin request with no `credentials` sends no
 * cookie and no Authorization header, which is exactly what this call should be.
 *
 * `storeId` is passed **only when the visitor genuinely arrived through that store's
 * context**, meaning from the store's own page. It is omitted for the far commoner
 * case of reaching the product directly, from the catalogue, or from search. Sending
 * the id of a store the visitor merely saw listed would credit a seller who did not
 * earn the view, and the endpoint cannot tell the difference.
 *
 * A `store_id` naming a store that no longer carries the product comes back as null.
 * **That is not an error**: the seller detached between the page rendering and this
 * call, the view still happened, and only the attribution was dropped.
 */
export async function recordProductView(
  slug: string,
  storeId?: number,
): Promise<RecordedView | null> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  if (!base) return null;

  let response: Response;

  try {
    response = await fetch(`${base}/api/products/${encodeURIComponent(slug)}/views`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      // Omitted entirely rather than sent as null, so the request body says what the
      // contract says: the field is absent when there is no store context.
      body: JSON.stringify(storeId === undefined ? {} : { store_id: storeId }),
      // No cookie, no token. See the note above.
      credentials: 'omit',
      cache: 'no-store',
      // A view is worth recording, not worth delaying a page for. The browser is free
      // to finish this after the visitor has navigated away.
      keepalive: true,
    });
  } catch {
    // The API being unreachable must never surface on a product page. Nothing the
    // visitor came for depends on this call.
    return null;
  }

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (payload === null) return null;

  return parseResponse(
    recordedViewSchema,
    'data' in payload ? payload.data : payload,
    'POST /api/products/{slug}/views',
  );
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/** The caller holds no store at all, so there is nothing to report on. */
export function isStoreRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'store_required';
}
