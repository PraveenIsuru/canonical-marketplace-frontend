'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { describe } from '@/components/product/VariantSelector';
import { LocationBar } from '@/components/seller/LocationBar';
import { SellerRow } from '@/components/seller/SellerRow';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';
import { useBuyerLocation } from '@/lib/location/useBuyerLocation';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { parseMoneyToMinor } from '@/lib/format/money';
import { paginationMetaSchema, sellerListingSchema } from '@/lib/schemas/catalogue';
import type { Coordinates } from '@/types/api';
import type { SellerListing, Variant } from '@/lib/schemas/catalogue';

type Sort = 'distance' | 'price' | 'rating';

interface Filters {
  variantId?: number;
  maxDistanceKm?: number;
  maxPrice: string;
  minRating?: number;
  availableOnly: boolean;
  sort?: Sort;
}

const EMPTY: Filters = { maxPrice: '', availableOnly: false };

/**
 * The filter, sort, and result panel for S-05.
 *
 * Client rendered because every control changes the query, and the whole point of the
 * screen is comparing sellers interactively rather than reloading the page per filter.
 */
export function SellerListPanel({
  slug,
  variants,
  initialSellers,
  initialMeta,
}: {
  slug: string;
  variants: Variant[];
  /** The server rendered unfiltered list, so the first paint needs no request. */
  initialSellers: SellerListing[];
  initialMeta: z.infer<typeof paginationMetaSchema>;
}) {
  const [filters, applyFilters] = useState<Filters>(EMPTY);

  // Read from the same external store the location bar writes to, so a location
  // restored on page load is reflected here without any message passing.
  const { coordinates } = useBuyerLocation();

  /*
   * The page number is scoped to the current filter and location signature.
   *
   * Derived during render rather than reset by an effect: a visitor on page 3 who
   * narrows the filters would otherwise land on an empty page 3 of a one page result
   * and conclude there are no sellers.
   */
  const signature = JSON.stringify({ filters, coordinates });
  const [pageState, setPageState] = useState({ signature, page: 1 });
  const page = pageState.signature === signature ? pageState.page : 1;

  const goToPage = (next: number) => setPageState({ signature, page: next });

  const maxPriceMinor = useMemo(
    () => (filters.maxPrice.trim() === '' ? undefined : parseMoneyToMinor(filters.maxPrice) ?? undefined),
    [filters.maxPrice],
  );

  // Distance sorting is offered only when a location is known. Offering it otherwise
  // would present an arbitrary ordering as a meaningful one.
  const canSortByDistance = coordinates !== null;
  const filtersActive =
    filters.variantId !== undefined ||
    filters.maxDistanceKm !== undefined ||
    maxPriceMinor !== undefined ||
    filters.minRating !== undefined ||
    filters.availableOnly;

  // True while the screen still shows exactly what the server rendered.
  const pristine = !filtersActive && coordinates === null && filters.sort === undefined && page === 1;

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: [
      ...queryKeys.products.sellers(slug, filters.variantId, coordinates),
      { ...filters, maxPriceMinor, page },
    ],
    queryFn: () => fetchSellerPage(slug, { ...filters, maxPriceMinor, coordinates, page }),
    staleTime: staleTimes.sellerList,
    placeholderData: (previous) => previous,
    // No request until something differs from what the server already rendered.
    enabled: pristine === false,
  });

  const results = data ?? { data: initialSellers, meta: initialMeta };

  return (
    <div className="flex flex-col gap-5">
      <LocationBar />

      <div className="grid gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
        {variants.length > 1 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Version</span>
            <select
              value={filters.variantId ?? ''}
              onChange={(event) =>
                applyFilters((f) => ({
                  ...f,
                  variantId: event.target.value === '' ? undefined : Number(event.target.value),
                }))
              }
              className={selectClass}
            >
              <option value="">Any version</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {describe(variant)}
                  {variant.seller_count === 0 ? ' (no sellers yet)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Maximum price</span>
          <input
            inputMode="decimal"
            placeholder="e.g. 2500.00"
            value={filters.maxPrice}
            onChange={(event) => applyFilters((f) => ({ ...f, maxPrice: event.target.value }))}
            className={selectClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Minimum rating</span>
          <select
            value={filters.minRating ?? ''}
            onChange={(event) =>
              applyFilters((f) => ({
                ...f,
                minRating: event.target.value === '' ? undefined : Number(event.target.value),
              }))
            }
            className={selectClass}
          >
            <option value="">Any rating</option>
            <option value="3">3 and above</option>
            <option value="4">4 and above</option>
            <option value="4.5">4.5 and above</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Within</span>
          <select
            value={filters.maxDistanceKm ?? ''}
            disabled={!canSortByDistance}
            onChange={(event) =>
              applyFilters((f) => ({
                ...f,
                maxDistanceKm: event.target.value === '' ? undefined : Number(event.target.value),
              }))
            }
            className={selectClass}
            title={canSortByDistance ? undefined : 'Share a location to filter by distance'}
          >
            <option value="">Any distance</option>
            <option value="10">10 km</option>
            <option value="50">50 km</option>
            <option value="120">120 km</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.availableOnly}
            onChange={(event) => applyFilters((f) => ({ ...f, availableOnly: event.target.checked }))}
          />
          <span>In stock only</span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Sort by</span>
          <select
            value={filters.sort ?? (canSortByDistance ? 'distance' : 'price')}
            onChange={(event) => applyFilters((f) => ({ ...f, sort: event.target.value as Sort }))}
            className={selectClass}
          >
            {canSortByDistance && <option value="distance">Distance</option>}
            <option value="price">Price</option>
            <option value="rating">Rating</option>
          </select>
        </label>

        {filtersActive && (
          <div className="flex items-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => applyFilters(() => EMPTY)}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {isError ? (
        <Alert tone="error" title="The seller list could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      ) : !pristine && isPending ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-28 w-full" />
            </li>
          ))}
        </ul>
      ) : results.data.length === 0 ? (
        filtersActive ? (
          <EmptyState
            title="No sellers match those filters"
            description="Try widening the price, distance, or rating, or clearing the filters entirely."
            action={
              <Button type="button" size="sm" onClick={() => applyFilters(() => EMPTY)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No sellers carry this product yet"
            description="The product stays in the catalogue, and sellers can list it at any time."
          />
        )
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            {results.meta.total} {results.meta.total === 1 ? 'seller' : 'sellers'}
            {isFetching ? ' (updating)' : ''}
          </p>

          <ul className="flex flex-col gap-3">
            {results.data.map((listing) => (
              <SellerRow key={`${listing.store.id}-${listing.variant_id}`} listing={listing} />
            ))}
          </ul>

          {results.meta.last_page > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-zinc-500 dark:text-zinc-400">
                Page {results.meta.current_page} of {results.meta.last_page}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= results.meta.last_page}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const selectClass =
  'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';

const pageSchema = z.object({
  data: z.array(sellerListingSchema),
  meta: paginationMetaSchema,
});

interface FetchOptions extends Omit<Filters, 'maxPrice'> {
  maxPriceMinor?: number;
  coordinates: Coordinates | null;
  page: number;
}

/**
 * A public read, so it goes straight to Laravel rather than through the authenticated
 * proxy. Parameter names match the API exactly; nothing here is invented.
 */
async function fetchSellerPage(
  slug: string,
  options: FetchOptions,
): Promise<{ data: SellerListing[]; meta: z.infer<typeof paginationMetaSchema> }> {
  const params = new URLSearchParams();

  if (options.variantId !== undefined) params.set('variant_id', String(options.variantId));
  if (options.coordinates) {
    params.set('lat', String(options.coordinates.lat));
    params.set('lng', String(options.coordinates.lng));
  }
  if (options.maxDistanceKm !== undefined && options.coordinates) {
    params.set('max_distance_km', String(options.maxDistanceKm));
  }
  if (options.maxPriceMinor !== undefined) params.set('max_price_minor', String(options.maxPriceMinor));
  if (options.minRating !== undefined) params.set('min_rating', String(options.minRating));
  if (options.availableOnly) params.set('available_only', '1');
  if (options.sort) params.set('sort', options.sort);
  if (options.page > 1) params.set('page', String(options.page));

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products/${encodeURIComponent(slug)}/sellers?${params}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!response.ok) throw new Error('The seller list could not be loaded.');

  return pageSchema.parse(await response.json());
}
