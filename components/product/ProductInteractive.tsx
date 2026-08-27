'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { addToWishlist } from '@/lib/api/wishlist';
import { RequiresLogin } from '@/components/system/RequiresLogin';
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
 * The wishlist entry point (EP-37), wrapped in X-06.
 *
 * Bound to the **selected variant**, because a wishlist entry is saved per combination
 * rather than per product: the 128GB and the 256GB move in price independently, and an
 * alert on "the product" could not say which one got cheaper.
 *
 * An anonymous visitor sees the same control, and choosing it takes them to sign in and
 * straight back here with the variant they had chosen still in hand. The catalogue is
 * public and stays public; one saveable control does not turn a product page into a
 * login wall.
 */
function WishlistAffordance({ product, selected }: { product: ProductDetail; selected: Variant | null }) {
  const label = `Save ${selected ? describe(selected) : 'this'} to wishlist`;

  /*
   * The intent travels with the return path, so signing in finishes what the visitor
   * started rather than dropping them on a page with no memory of why they left it.
   */
  const returnTo = selected
    ? `/products/${product.slug}?save=${selected.id}`
    : `/products/${product.slug}`;

  return (
    <RequiresLogin
      returnTo={returnTo}
      action="save this"
      fallback={
        <Button variant="secondary" disabled>
          {label}
        </Button>
      }
    >
      <SaveToWishlist variant={selected} label={label} />
    </RequiresLogin>
  );
}

/**
 * The save itself, for a signed in visitor.
 *
 * A repeat save is **not an error**. EP-37 answers 200 with the existing item, because
 * a buyer pressing save twice meant it twice, so this reports saved either way and
 * never apologises for it.
 */
function SaveToWishlist({ variant, label }: { variant: Variant | null; label: string }) {
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const attempted = useRef<number | null>(null);

  const save = useCallback(async (variantId: number) => {
    setSaving(true);
    setFailed(false);

    try {
      await addToWishlist(variantId);
      setSaved(true);
    } catch {
      setFailed(true);
    }

    setSaving(false);
  }, []);

  /*
   * Finishing what X-06 started. A visitor who signed in from this page comes back with
   * `?save=<variant>`, and the save runs once rather than waiting for them to press the
   * button a second time.
   */
  useEffect(() => {
    const requested = Number(searchParams.get('save'));

    if (!Number.isInteger(requested) || requested < 1) return;
    if (attempted.current === requested) return;

    attempted.current = requested;
    void save(requested);
  }, [searchParams, save]);

  if (variant === null) {
    return (
      <Button variant="secondary" disabled>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        onClick={() => save(variant.id)}
        loading={saving}
        disabled={saving}
      >
        {label}
      </Button>

      {saved && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          Saved.{' '}
          <Link href="/wishlist" className="underline">
            Your wishlist
          </Link>
        </span>
      )}

      {failed && (
        <span className="text-xs text-red-600 dark:text-red-400">
          That could not be saved. Try again.
        </span>
      )}
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
