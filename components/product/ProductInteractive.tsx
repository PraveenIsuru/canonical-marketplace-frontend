'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VariantSelector, describe } from '@/components/product/VariantSelector';
import { LocationBar } from '@/components/seller/LocationBar';
import { SellerRow } from '@/components/seller/SellerRow';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';
import { useBuyerLocation } from '@/lib/location/useBuyerLocation';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { sellerListingSchema } from '@/lib/schemas/catalogue';
import { z } from 'zod';
import type { Coordinates } from '@/types/api';
import type { ProductDetail, SellerListing, Variant } from '@/lib/schemas/catalogue';

/** The nearest few, with a link to the full list. */
const PREVIEW_COUNT = 5;

interface Props {
  product: ProductDetail;
  variants: Variant[];
  /** Rendered on the server for the initial paint, so the page is useful without JS. */
  initialSellers: SellerListing[];
}

/**
 * The interactive half of S-04.
 *
 * Selecting a variant filters the seller list and retargets the wishlist affordance
 * **without navigating**. The static shell above it, meaning the name, images,
 * specifications and summary, is untouched by any of this and stays prerendered.
 */
export function ProductInteractive({ product, variants, initialSellers }: Props) {
  const [selected, setSelected] = useState<Variant | null>(
    () => variants.find((variant) => variant.is_default) ?? variants[0] ?? null,
  );
  /*
   * Read from the same external store the location bar writes to. useSyncExternalStore
   * returns null on the server and during the first client render, so this cannot
   * cause a hydration mismatch, and no hydration flag is needed to guard it.
   */
  const { coordinates } = useBuyerLocation();

  /*
   * The server rendered list is already correct for the default variant with no
   * location, so no request is made until something actually differs from it.
   */
  const initialVariantId = variants.find((variant) => variant.is_default)?.id ?? variants[0]?.id;
  const needsFetch = coordinates !== null || (selected !== null && selected.id !== initialVariantId);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.products.sellers(product.slug, selected?.id, coordinates),
    queryFn: () => fetchSellers(product.slug, selected?.id, coordinates),
    staleTime: staleTimes.sellerList,
    enabled: needsFetch,
    placeholderData: (previous) => previous,
  });

  const sellers = data ?? initialSellers;
  const showing = sellers.slice(0, PREVIEW_COUNT);

  return (
    <div className="flex flex-col gap-8">
      <VariantSelector
        product={product}
        variants={variants}
        selected={selected}
        onSelect={setSelected}
      />

      <WishlistAffordance product={product} selected={selected} />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">
            Sellers{selected && variants.length > 1 ? ` for ${describe(selected)}` : ''}
          </h2>
          <Link href={`/products/${product.slug}/sellers`} className="text-sm underline">
            Full list, filters and sorting
          </Link>
        </div>

        <LocationBar />

        {isError ? (
          <Alert tone="error" title="The seller list could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        ) : needsFetch && isPending && data === undefined ? (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton className="h-28 w-full" />
              </li>
            ))}
          </ul>
        ) : showing.length === 0 ? (
          <EmptyState
            title={
              selected && selected.seller_count === 0 && variants.length > 1
                ? `No sellers carry ${describe(selected)} yet`
                : 'No sellers carry this product yet'
            }
            description="This product stays in the catalogue, and sellers can list it at any time."
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {showing.map((listing) => (
                <SellerRow key={`${listing.store.id}-${listing.variant_id}`} listing={listing} />
              ))}
            </ul>

            {sellers.length > PREVIEW_COUNT && (
              <Link href={`/products/${product.slug}/sellers`} className="text-sm underline">
                See all sellers
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The wishlist entry point.
 *
 * Bound to the selected variant, because a wishlist entry is saved per combination
 * rather than per product. The mutation itself belongs to M8, so this currently routes
 * an anonymous visitor to sign in and tells an authenticated one that it is coming,
 * rather than offering a control that would fail when clicked.
 */
function WishlistAffordance({ product, selected }: { product: ProductDetail; selected: Variant | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled title="Saving to a wishlist arrives with the wishlist screens">
        Save {selected ? describe(selected) : 'this'} to wishlist
      </Button>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        <Link href={`/login?next=/products/${product.slug}`} className="underline">
          Sign in
        </Link>{' '}
        to save items. Wishlists are saved per version.
      </span>
    </div>
  );
}

/**
 * Fetches the seller list from Laravel.
 *
 * A public read, so it goes to the API directly rather than through the authenticated
 * proxy. The response is parsed so a shape change fails here rather than rendering
 * undefined into the page.
 */
async function fetchSellers(
  slug: string,
  variantId: number | undefined,
  coordinates: Coordinates | null,
): Promise<SellerListing[]> {
  const params = new URLSearchParams();
  if (variantId !== undefined) params.set('variant_id', String(variantId));
  if (coordinates) {
    params.set('lat', String(coordinates.lat));
    params.set('lng', String(coordinates.lng));
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products/${encodeURIComponent(slug)}/sellers?${params}`,
    { headers: { Accept: 'application/json' } },
  );

  if (!response.ok) throw new Error('The seller list could not be loaded.');

  const body = await response.json();

  return z.array(sellerListingSchema).parse(body.data);
}
