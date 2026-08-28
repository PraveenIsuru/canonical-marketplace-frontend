/**
 * Seller analytics (EP-39) and view recording (EP-52).
 *
 * Mirrors section 11.11 of development-docs/shared/api-contract.md. Nothing here
 * identifies a visitor, and there is no per user figure anywhere: EP-52 is a public
 * route that resolves no session, so the platform does not know who looked.
 */

/** One day in the range. Every date is present, including the ones with no views. */
export interface DailyViews {
  /** A UTC day, `YYYY-MM-DD`. */
  date: string;
  store_views: number;
  product_views: number;
}

/**
 * One product in the breakdown.
 *
 * `is_carried` is false for a product this store has detached from, whose historical
 * views are still counted. A carried product with no views appears as a zero rather
 * than vanishing.
 */
export interface ProductViewBreakdown {
  id: number;
  slug: string;
  name: string;
  store_views: number;
  product_views: number;
  is_carried: boolean;
}

/**
 * EP-39.
 *
 * **Two counts, and the difference between them is the point.** `store_views` reached
 * this store; `product_views` is all interest in the same products, whoever it
 * reached. Both totals are the sum of the `products` rows.
 */
export interface StoreAnalytics {
  /** Echoed back, because both bounds are optional on the request. */
  from: string;
  to: string;
  store_views: number;
  product_views: number;
  daily: DailyViews[];
  products: ProductViewBreakdown[];
}

/**
 * EP-52's answer.
 *
 * `store_id` is what the view was **actually** attributed to, which is null when no
 * context was sent and also when the store sent does not carry the product. Null is
 * not an error and must never be surfaced to the visitor.
 */
export interface RecordedView {
  recorded: boolean;
  store_id: number | null;
}
