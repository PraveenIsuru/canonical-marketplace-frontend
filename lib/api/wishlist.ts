/**
 * Listing management and the wishlist (EP-25, EP-26, EP-36 to EP-38).
 *
 * Two audiences in one module, because they are two halves of the same M8 idea: what a
 * seller offers, and what a buyer is waiting for. Both go through this application's
 * proxy at `/api/proxy`, which attaches the Bearer token server side.
 *
 * **Every price crossing this boundary is an integer in the smallest currency unit.**
 * Nothing here divides by 100; that happens once, in the formatter, at render time.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { paginated } from '@/lib/schemas/common';
import {
  detachResultSchema,
  updatedListingSchema,
  wishlistItemSchema,
  wishlistRemovalSchema,
} from '@/lib/schemas/wishlist';
import type {
  DetachResult,
  ListingUpdate,
  UpdatedListing,
  WishlistItem,
} from '@/types/wishlist';
import type { Paginated } from '@/types/api';

export type PaginatedWishlist = Paginated<WishlistItem>;

/*
|--------------------------------------------------------------------------
| EP-25 and EP-26, a seller's own listings
|--------------------------------------------------------------------------
*/

/**
 * Changes a price, an availability flag, or both.
 *
 * **This is the whole of a seller's write access to the catalogue.** Nothing about the
 * product, the variant, or the attribute values is accepted, and none should ever be
 * added: the record is shared by every seller on it and changes only through a
 * proposal. A field added to `ListingUpdate` would be a hole in that rule.
 *
 * The API refuses a price of zero or below with `validation_failed` keyed on
 * `price_minor`. The form catches it first, so that is a backstop rather than the
 * normal path.
 */
export async function updateListing(
  attachmentId: number,
  changes: ListingUpdate,
): Promise<UpdatedListing> {
  const payload = await apiFetch<unknown>(`/api/attachments/${attachmentId}`, {
    method: 'PATCH',
    body: changes,
  });

  return parseResponse(updatedListingSchema, payload, 'PATCH /api/attachments/{id}');
}

/**
 * Stops carrying a variant.
 *
 * The response carries `store_is_live` **after** the removal, which is the point of
 * calling it rather than refetching: a seller who has just removed their last listing
 * has this instant made their store invisible to buyers, and they should be told then
 * rather than notice it later.
 *
 * The product is not affected. A canonical record is platform owned, outlives every
 * seller on it, and simply reports no sellers.
 */
export async function detachListing(attachmentId: number): Promise<DetachResult> {
  const payload = await apiFetch<unknown>(`/api/attachments/${attachmentId}`, {
    method: 'DELETE',
  });

  return parseResponse(detachResultSchema, payload, 'DELETE /api/attachments/{id}');
}

/*
|--------------------------------------------------------------------------
| EP-36 to EP-38, a buyer's wishlist
|--------------------------------------------------------------------------
*/

/** What this buyer is watching, with the cheapest current listing for each. */
export async function getWishlist(page = 1): Promise<PaginatedWishlist> {
  const payload = await apiFetch<unknown>('/api/wishlist', { query: { page } });

  return parseResponse(paginated(wishlistItemSchema), payload, 'GET /api/wishlist');
}

/**
 * Saves a variant.
 *
 * **A repeat save is not an error.** The API answers 200 with the existing item rather
 * than a conflict, because a buyer pressing save twice meant it twice. Nothing here
 * throws on that, and nothing that renders it may apologise for it.
 *
 * Saved per variant rather than per product, so the caller passes the combination the
 * buyer actually selected.
 */
export async function addToWishlist(variantId: number): Promise<WishlistItem> {
  const payload = await apiFetch<unknown>('/api/wishlist', {
    method: 'POST',
    body: { variant_id: variantId },
  });

  return parseResponse(wishlistItemSchema, payload, 'POST /api/wishlist');
}

/** Removes a saved variant, by the **wishlist row's own id**, not the variant id. */
export async function removeFromWishlist(itemId: number): Promise<void> {
  const payload = await apiFetch<unknown>(`/api/wishlist/${itemId}`, {
    method: 'DELETE',
  });

  parseResponse(wishlistRemovalSchema, payload, 'DELETE /api/wishlist/{id}');
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/**
 * Somebody else's listing, or one that no longer exists.
 *
 * The API answers 404 for both and makes them indistinguishable on purpose:
 * confirming that a listing exists but belongs to another store would tell a
 * competitor something about their inventory. The screen says the same for both.
 */
export function isListingNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** A price at or below zero, caught server side. Keyed on `price_minor`. */
export function isPriceRejected(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'validation_failed' &&
    error.errors?.price_minor !== undefined
  );
}
