/**
 * Response schemas for the M2 catalogue endpoints.
 *
 * With no mock API standing between the screens and Laravel, these are what turn a
 * contract mismatch into a readable error naming the field, rather than
 * `undefined is not an object` three components later.
 *
 * Mirrors development-docs/shared/api-contract.md and the shapes the backend recorded
 * in its M2 milestone log entry. Nothing here is invented: every field was read off a
 * live response before being declared.
 */

import { z } from 'zod';

/*
 * Laravel's paginator also emits meta.links, an array of page link objects that the
 * contract does not document. It is additive and standard, so it is tolerated rather
 * than rejected. Zod strips unknown keys by default, which is exactly the behaviour
 * wanted here: extra fields never break a screen, missing ones always do.
 */
export const paginationMetaSchema = z.object({
  current_page: z.number().int(),
  from: z.number().int().nullable(),
  last_page: z.number().int(),
  per_page: z.number().int(),
  to: z.number().int().nullable(),
  total: z.number().int(),
});

export const paginationLinksSchema = z.object({
  first: z.string().nullable(),
  last: z.string().nullable(),
  prev: z.string().nullable(),
  next: z.string().nullable(),
});

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  });
}

export const productImageSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  position: z.number().int(),
});

/**
 * EP-08 catalogue card.
 *
 * lowest_price_minor and currency are null, never zero, when no live store carries the
 * product. Zero would render as free. seller_count counts distinct stores, so one
 * store carrying three variants counts once.
 */
export const productSummarySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  primary_image: productImageSchema.nullable(),
  lowest_price_minor: z.number().int().nullable(),
  currency: z.string().nullable(),
  seller_count: z.number().int(),
});

export const productAttributeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  options: z.array(z.string()),
  position: z.number().int(),
});

/**
 * EP-09 the canonical record.
 *
 * No owner, creator, or created_by_store_id field is declared. The backend does not
 * send one, and declaring it would be the first step towards rendering it.
 */
export const productSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  specifications: z.record(z.string(), z.unknown()),
  current_version_number: z.number().int(),
  seller_count: z.number().int(),
  images: z.array(productImageSchema),
  attributes: z.array(productAttributeSchema),
});

/**
 * EP-10 one generated combination.
 *
 * Combinations with seller_count 0 are returned by the API and must be rendered, not
 * filtered. Dropping them here would silently reintroduce variant removal.
 */
export const variantSchema = z.object({
  id: z.number().int(),
  product_id: z.number().int(),
  attribute_values: z.record(z.string(), z.string()),
  is_default: z.boolean(),
  seller_count: z.number().int(),
  lowest_price_minor: z.number().int().nullable(),
});

export const sellerStoreSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  category: z.string(),
  // Public by design. This disclosure is the purpose of the endpoint.
  contact_email: z.string(),
  contact_phone: z.string().nullable(),
  address_line: z.string(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  rating: z.number().nullable(),
});

/**
 * EP-11 one row of the seller list.
 *
 * distance_km is null when the caller supplied no coordinates. Null is not zero: the
 * client renders nothing rather than "0 km", which would read as next door.
 */
export const sellerListingSchema = z.object({
  store: sellerStoreSchema,
  variant_id: z.number().int(),
  attribute_values: z.record(z.string(), z.string()),
  price_minor: z.number().int(),
  currency: z.string(),
  is_available: z.boolean(),
  distance_km: z.number().nullable(),
});

/** EP-12. The endpoint returns data: null where no summary exists. */
export const sentimentSummarySchema = z.object({
  summary: z.string(),
  generated_at: z.string().nullable(),
});

export const storeListingSchema = z.object({
  attachment_id: z.number().int(),
  variant_id: z.number().int(),
  attribute_values: z.record(z.string(), z.string()),
  price_minor: z.number().int(),
  currency: z.string(),
  is_available: z.boolean(),
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
  }),
});

/** EP-13. Only ever returned for a live store; a dark one answers 404. */
export const publicStoreSchema = sellerStoreSchema.extend({
  is_live: z.boolean(),
  listings: z.array(storeListingSchema),
});

export const categorySchema = z.object({
  name: z.string(),
  product_count: z.number().int(),
});

/**
 * EP-14 buyer search.
 *
 * `mode` is **required and sits beside `data`**, not inside it. It is not optional and
 * must never be defaulted: the client shows its fallback notice from this field alone,
 * so a missing value has to fail loudly rather than quietly read as "ai".
 *
 * The backend is the single authority on which path served a query. There is no
 * client side fallback anywhere, because two layers deciding independently would
 * eventually disagree about what a visitor was actually shown.
 */
export const searchModeSchema = z.enum(['ai', 'keyword']);

export const searchResponseSchema = z.object({
  mode: searchModeSchema,
  data: z.array(productSummarySchema),
  links: paginationLinksSchema,
  meta: paginationMetaSchema,
});

export type SearchMode = z.infer<typeof searchModeSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductDetail = z.infer<typeof productSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type SellerListing = z.infer<typeof sellerListingSchema>;
export type SentimentSummary = z.infer<typeof sentimentSummarySchema>;
export type PublicStore = z.infer<typeof publicStoreSchema>;
export type Category = z.infer<typeof categorySchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
