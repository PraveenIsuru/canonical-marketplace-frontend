/**
 * Schemas for listing management and the wishlist (EP-25, EP-26, EP-36 to EP-38).
 *
 * Mirrors development-docs/shared/api-contract.md at **version 5**, section 11.9.
 */

import { z } from 'zod';
import { priceMinorSchema } from '@/lib/schemas/common';

/** EP-25. What a seller's own listing looks like after they changed it. */
export const updatedListingSchema = z.object({
  attachment_id: z.number().int(),
  variant_id: z.number().int(),
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
  }),
  attribute_values: z.record(z.string(), z.string()),
  price_minor: priceMinorSchema,
  currency: z.string(),
  is_available: z.boolean(),
});

/**
 * EP-26.
 *
 * `detached` is a literal rather than a boolean. The endpoint answers this shape only
 * on success, so a `false` would mean the contract had changed underneath us, and
 * failing here beats telling a seller their listing is gone when it is not.
 */
export const detachResultSchema = z.object({
  detached: z.literal(true),
  store_is_live: z.boolean(),
});

/**
 * EP-36 item.
 *
 * **`lowest_price_minor` and `currency` are both nullable**, together, when nobody
 * carries the variant. The contract's example in 11.9 shows a populated pair and does
 * not say the null case exists, but the API returns it: a variant with no available
 * listing has no price and nothing to take a currency from. Mirrored as the API
 * actually behaves, and raised with the backend rather than guessed at, because a
 * schema that refused null here would break the wishlist's most ordinary state.
 */
export const wishlistItemSchema = z.object({
  id: z.number().int(),
  variant_id: z.number().int(),
  attribute_values: z.record(z.string(), z.string()),
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    primary_image_url: z.string().nullable(),
  }),
  lowest_price_minor: priceMinorSchema.nullable(),
  currency: z.string().nullable(),
  seller_count: z.number().int(),
});

/** EP-38. */
export const wishlistRemovalSchema = z.object({
  removed: z.literal(true),
});

export type UpdatedListingShape = z.infer<typeof updatedListingSchema>;
export type DetachResultShape = z.infer<typeof detachResultSchema>;
export type WishlistItemShape = z.infer<typeof wishlistItemSchema>;
