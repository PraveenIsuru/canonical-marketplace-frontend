/**
 * A seller's own listings, and a buyer's wishlist (EP-25, EP-26, EP-36 to EP-38).
 *
 * Mirrors section 11.9 of the contract.
 *
 * Every price here is an **integer in the smallest currency unit**. Divided by 100 for
 * display only, at the very edge, and never stored or sent as a float.
 */

/** What EP-25 accepts. Two fields, both optional, at least one required. */
export interface ListingUpdate {
  /** Integer in the smallest currency unit, and greater than zero. */
  price_minor?: number;
  is_available?: boolean;
}

/**
 * What EP-25 answers.
 *
 * Note what is not here: nothing about the product beyond its identity. A seller
 * changes what they charge and whether they have stock, and the record itself moves
 * only through a proposal.
 */
export interface UpdatedListing {
  attachment_id: number;
  variant_id: number;
  product: { id: number; slug: string; name: string };
  attribute_values: Record<string, string>;
  price_minor: number;
  currency: string;
  is_available: boolean;
}

/**
 * What EP-26 answers.
 *
 * `store_is_live` is recomputed from the remaining attachments before the response is
 * built, so a false here is the exact moment the seller's store stopped being visible
 * to buyers. It is in the response rather than left to a later refetch precisely so the
 * interface can say so immediately.
 */
export interface DetachResult {
  detached: true;
  store_is_live: boolean;
}

/**
 * One saved variant (EP-36).
 *
 * Saved per variant rather than per product, because a price alert is only meaningful
 * for a specific combination.
 */
export interface WishlistItem {
  /** The wishlist row's own id, which is what EP-38 deletes by. Not the variant id. */
  id: number;
  variant_id: number;
  attribute_values: Record<string, string>;
  product: { id: number; slug: string; name: string; primary_image_url: string | null };
  /**
   * The cheapest available listing right now, or **null when nobody carries it**.
   *
   * Null is a normal state rather than missing data: a buyer may save a combination no
   * seller stocks yet, and being emailed when one appears nearby is the point of doing
   * so. The screen says as much rather than treating it as an error.
   */
  lowest_price_minor: number | null;
  /** Null alongside a null price, since there is no listing to take a currency from. */
  currency: string | null;
  seller_count: number;
}

/** What EP-38 answers. */
export interface WishlistRemoval {
  removed: true;
}
