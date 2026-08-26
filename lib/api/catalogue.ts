/**
 * The public catalogue (EP-08 to EP-13, EP-53).
 *
 * Every call here is anonymous readable and is fetched **server side, straight to
 * Laravel**. It deliberately does not go through /api/proxy: the proxy exists to
 * attach a session token, and sending catalogue reads through it would resolve a
 * session on the highest traffic routes for no benefit, and make the responses
 * uncacheable into the bargain.
 *
 * Every response is parsed through a zod schema. With no mock API, a shape mismatch
 * has to fail loudly at the boundary rather than quietly three components later.
 */

import { z } from 'zod';
import { apiFetchServer, ApiError } from '@/lib/api/client';
import {
  categorySchema,
  paginated,
  productSchema,
  productSummarySchema,
  publicStoreSchema,
  sellerListingSchema,
  sentimentSummarySchema,
  variantSchema,
  type Category,
  type PaginationMeta,
  type ProductDetail,
  type ProductSummary,
  type PublicStore,
  type SellerListing,
  type SentimentSummary,
  type Variant,
} from '@/lib/schemas/catalogue';

/** How long a catalogue read may be reused. Product content changes only on a version. */
const CATALOGUE_REVALIDATE_SECONDS = 300;

export interface Paged<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Parses a response and, on failure, throws an error naming the offending field.
 *
 * The alternative is a screen rendering `undefined` and somebody spending an hour
 * deciding whether the bug is in the component, the fetch, or the API.
 */
function parse<T extends z.ZodTypeAny>(schema: T, payload: unknown, endpoint: string): z.infer<T> {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(
      `${endpoint} returned an unexpected shape at "${first?.path.join('.') || '(root)'}": ${first?.message}. ` +
        'The API and development-docs/shared/api-contract.md disagree.',
    );
  }

  return result.data;
}

/** EP-08 Catalogue listing. */
export async function getProducts(
  options: { category?: string; page?: number; perPage?: number; revalidate?: number } = {},
): Promise<Paged<ProductSummary>> {
  const payload = await apiFetchServer<unknown>('/api/products', {
    query: { category: options.category, page: options.page, per_page: options.perPage },
    // Stated per caller. Next takes the shortest revalidate across every fetch in a
    // route, so a hardcoded value here would quietly override a page that wanted a
    // longer one, which is what happened to the hourly home page.
    next: { revalidate: options.revalidate ?? CATALOGUE_REVALIDATE_SECONDS },
  });

  return parse(paginated(productSummarySchema), payload, 'GET /api/products');
}

/** EP-53 Categories. Derived server side, because category is a free string column. */
export async function getCategories(): Promise<Category[]> {
  const payload = await apiFetchServer<unknown>('/api/categories', {
    next: { revalidate: 3600 },
  });

  return parse(z.array(categorySchema), payload, 'GET /api/categories');
}

/**
 * EP-09 The canonical record.
 *
 * Returns null on 404 so the caller can render notFound() rather than an error
 * boundary. A mistyped slug is not a system failure.
 */
export async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const payload = await apiFetchServer<unknown>(`/api/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
    });

    return parse(productSchema, payload, 'GET /api/products/{slug}');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'not_found') return null;
    throw error;
  }
}

/**
 * EP-10 Every generated combination.
 *
 * Returned whole, including combinations with a seller count of zero. Filtering them
 * here would hide permanent parts of the catalogue.
 */
export async function getVariants(slug: string): Promise<Variant[]> {
  const payload = await apiFetchServer<unknown>(`/api/products/${encodeURIComponent(slug)}/variants`, {
    next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
  });

  return parse(z.array(variantSchema), payload, 'GET /api/products/{slug}/variants');
}

/**
 * EP-12 The sentiment summary.
 *
 * Null where none exists, so the caller omits the section entirely rather than
 * rendering an empty panel.
 */
export async function getSummary(slug: string): Promise<SentimentSummary | null> {
  const payload = await apiFetchServer<unknown>(`/api/products/${encodeURIComponent(slug)}/summary`, {
    next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
  });

  if (payload === null || payload === undefined) return null;

  return parse(sentimentSummarySchema, payload, 'GET /api/products/{slug}/summary');
}

/** The filter and sort inputs EP-11 accepts. Names match the API exactly. */
export interface SellerListOptions {
  variantId?: number;
  lat?: number;
  lng?: number;
  maxDistanceKm?: number;
  maxPriceMinor?: number;
  minRating?: number;
  availableOnly?: boolean;
  sort?: 'distance' | 'price' | 'rating';
  page?: number;
  /** Overrides the shared-list lifetime. Ignored for personalised requests. */
  revalidate?: number;
}

/**
 * EP-11 The seller list.
 *
 * Caching depends on whether the request is personalised, and the distinction matters.
 *
 * With coordinates or filters the result is specific to one visitor, so it must not be
 * cached: a shared entry would serve one buyer's distance ordering to another standing
 * somewhere else. Those calls pass `revalidate: 0`.
 *
 * Without coordinates the response is identical for everybody, which is exactly the
 * call the product page makes on the server. Caching it is what lets S-04 stay
 * statically generated, and the client refetches with real coordinates once known.
 */
export async function getSellers(slug: string, options: SellerListOptions = {}): Promise<Paged<SellerListing>> {
  const personalised =
    options.lat !== undefined ||
    options.lng !== undefined ||
    options.maxDistanceKm !== undefined ||
    options.maxPriceMinor !== undefined ||
    options.minRating !== undefined ||
    options.availableOnly === true ||
    options.sort !== undefined;

  const payload = await apiFetchServer<unknown>(`/api/products/${encodeURIComponent(slug)}/sellers`, {
    query: {
      variant_id: options.variantId,
      lat: options.lat,
      lng: options.lng,
      max_distance_km: options.maxDistanceKm,
      max_price_minor: options.maxPriceMinor,
      min_rating: options.minRating,
      // The API expects a boolean-ish value; omit it entirely when false so the
      // query string stays clean and the default applies.
      available_only: options.availableOnly ? 1 : undefined,
      sort: options.sort,
      page: options.page,
    },
    next: {
      // 30 seconds for the shared list: price and availability change independently of
      // the version chain, so there is no invalidation signal, only a short lifetime.
      revalidate: personalised ? 0 : (options.revalidate ?? 30),
    },
  });

  return parse(paginated(sellerListingSchema), payload, 'GET /api/products/{slug}/sellers');
}

/**
 * EP-13 The public store profile.
 *
 * Returns null on 404, which covers both a missing store and a dark one. The API
 * deliberately does not distinguish them, because a dark store is not visible to
 * buyers and must not be discoverable by guessing an id.
 */
export async function getStore(id: number): Promise<PublicStore | null> {
  try {
    const payload = await apiFetchServer<unknown>(`/api/stores/${id}`, {
      next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
    });

    return parse(publicStoreSchema, payload, 'GET /api/stores/{id}');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'not_found') return null;
    throw error;
  }
}
