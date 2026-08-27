'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getWishlist, removeFromWishlist } from '@/lib/api/wishlist';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { formatMoney } from '@/lib/format/money';
import { Alert, Card, EmptyState, Pagination, Skeleton } from '@/components/ui';
import type { WishlistItem } from '@/types/wishlist';

/**
 * S-14 Wishlist.
 *
 * What a buyer is watching, saved **per variant rather than per product**, because a
 * price alert is only meaningful for a specific combination: the 128GB and the 256GB
 * move independently, and "tell me when the phone gets cheaper" cannot be acted on.
 *
 * The alerts themselves have no screen and never will. They are email only, like every
 * notification in this platform, and there is no bell and no notification centre to
 * read past ones from. This page is the list, not an inbox.
 */
export function WishlistPanel() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...queryKeys.wishlist.all(), page],
    queryFn: () => getWishlist(page),
    staleTime: staleTimes.wishlist,
  });

  async function remove(item: WishlistItem) {
    setRemoving(item.id);
    setError(null);

    try {
      // By the wishlist row's own id, not the variant id. They are different numbers
      // and using the wrong one would delete somebody else's row or nothing at all.
      await removeFromWishlist(item.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all() });
    } catch {
      setError('That item could not be removed. Try again.');
    }

    setRemoving(null);
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your wishlist could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your wishlist</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Saved versions of products. We email you when one gets cheaper, or when a shop
          near you starts stocking it.
        </p>
      </div>

      {error !== null && <Alert tone="error">{error}</Alert>}

      {data.data.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          description="Save a version of a product from its page and we will email you when the price drops or a nearby shop starts carrying it."
          action={
            <Link
              href="/products"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Browse the catalogue
            </Link>
          }
        />
      )}

      {data.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.data.map((item) => (
            <WishlistRow
              key={item.id}
              item={item}
              removing={removing === item.id}
              onRemove={() => remove(item)}
            />
          ))}
        </ul>
      )}

      <Pagination meta={data.meta} hrefFor={(next) => `/wishlist?page=${next}`} />

      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Alerts arrive by email only. There is no message centre here, so keep an eye
          on the inbox for the address on your account.
        </p>
        <p className="mt-2">
          A nearby stock alert needs a location on your account.{' '}
          <Link href="/account" className="underline">
            Add or change yours
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

/** One saved variant, priced or not. */
function WishlistRow({
  item,
  removing,
  onRemove,
}: {
  item: WishlistItem;
  removing: boolean;
  onRemove: () => void;
}) {
  const describe =
    Object.entries(item.attribute_values).length === 0
      ? 'Single default version'
      : Object.entries(item.attribute_values)
          .map(([name, value]) => `${name}: ${value}`)
          .join(', ');

  // Divided by 100 for display only. The integer is what crosses the wire.
  const price = formatMoney(item.lowest_price_minor, item.currency);

  return (
    <li>
      <Card className="flex flex-wrap items-start gap-4">
        {item.product.primary_image_url ? (
          <Image
            src={item.product.primary_image_url}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
            No image
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Link href={`/products/${item.product.slug}`} className="font-medium underline">
            {item.product.name}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{describe}</p>

          {price !== null ? (
            <p className="mt-2 text-sm">
              <span className="font-medium">{price}</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {' '}
                from {item.seller_count} {item.seller_count === 1 ? 'seller' : 'sellers'}
              </span>
            </p>
          ) : (
            /*
             * A null price is a normal state, not an error and not missing data. A buyer
             * may save a combination nobody stocks yet, and being told when somebody
             * near them starts carrying it is exactly why they saved it.
             */
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Nobody carries this version yet. We will email you when a shop near you
              starts stocking it.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="text-sm underline disabled:opacity-50"
        >
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </Card>
    </li>
  );
}
