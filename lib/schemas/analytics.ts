/**
 * Schemas for analytics and view recording (EP-39, EP-52).
 *
 * Mirrors section 11.11 of the contract. With no mock standing between these screens
 * and the API, these are what turn a shape mismatch into a message naming the field.
 */

import { z } from 'zod';

/** A UTC calendar day, exactly as the API sends and accepts it. */
export const utcDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const dailyViewsSchema = z.object({
  date: utcDateSchema,
  store_views: z.number().int(),
  product_views: z.number().int(),
});

export const productViewBreakdownSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  store_views: z.number().int(),
  product_views: z.number().int(),
  is_carried: z.boolean(),
});

export const storeAnalyticsSchema = z.object({
  from: utcDateSchema,
  to: utcDateSchema,
  store_views: z.number().int(),
  product_views: z.number().int(),
  daily: z.array(dailyViewsSchema),
  products: z.array(productViewBreakdownSchema),
});

/**
 * EP-52.
 *
 * `store_id` is nullable and that is a normal outcome rather than a degraded one: it
 * is null when no store context was sent, and also when the store sent no longer
 * carries the product.
 */
export const recordedViewSchema = z.object({
  recorded: z.boolean(),
  store_id: z.number().int().nullable(),
});

export type DailyViews = z.infer<typeof dailyViewsSchema>;
export type ProductViewBreakdown = z.infer<typeof productViewBreakdownSchema>;
export type StoreAnalytics = z.infer<typeof storeAnalyticsSchema>;
export type RecordedView = z.infer<typeof recordedViewSchema>;
