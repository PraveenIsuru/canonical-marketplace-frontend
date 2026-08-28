'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyListings } from '@/lib/api/confirmation';
import { queryKeys } from '@/lib/query/keys';
import { PendingProposalNotice } from '@/components/proposal/PendingProposalNotice';
import { ListingRow } from '@/components/seller/ListingRow';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui';
import type { BlockedProposal, StoreListing } from '@/types/confirmation';

/**
 * S-21 Listings.
 *
 * Two sections, from one call, and the second is the reason this screen is not just a
 * table of attachments.
 *
 * A product with a submission under review has **no attachment row at all**. The
 * absence of that row is what blocks the seller, so a screen built from `listings`
 * alone would show nothing for it and leave them believing their submission vanished.
 * `blocked` is what turns that silence into "the other sellers are checking".
 *
 * Editable as of M8. Each row carries a price, an availability toggle, and a detach,
 * which are EP-25 and EP-26 and the **entire** write surface a seller has over the
 * catalogue. Nothing here edits a product, an attribute, or a variant: those are shared
 * by every seller carrying the record and change only through a proposal.
 *
 * Removing the last listing makes the store invisible to buyers. That is warned about
 * before the seller commits, and confirmed afterwards from `store_is_live` in the
 * EP-26 response rather than discovered on some later refetch.
 */
export function ListingsPanel() {
  const queryClient = useQueryClient();

  /*
   * Set from the EP-26 response, not from a refetch. `store_is_live: false` means this
   * detach was the one that darkened the store, and the seller is told at that moment.
   */
  const [wentDark, setWentDark] = useState(false);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.stores.listings(),
    queryFn: getMyListings,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stores.listings() });
    // The store's own live flag rides on the session, which the dashboard reads.
    void queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your listings could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  const { listings, blocked } = data;
  const hasNothing = listings.length === 0 && blocked.length === 0;

  /*
   * Every attachment the store holds, across products. A store goes dark when its last
   * attachment goes, not its last product, so counting products here would fail to warn
   * a seller removing the second of two versions of one product.
   */
  const totalListedVariants = listings.reduce(
    (running, listing) => running + listing.variants.length,
    0,
  );

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your listings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The products your store carries, and anything waiting on review.
        </p>
      </div>

      {/*
        Straight from the EP-26 response. This is the moment the store stopped being
        visible to buyers, and it is said here rather than left to be noticed.
      */}
      {wentDark && (
        <Alert tone="warning" title="Your store is no longer visible to buyers">
          <p>
            That was your last listing, so your store has gone dark. Buyers cannot find
            it, and it will not appear on any product page until you list something
            again.
          </p>
          <p className="mt-2">
            <Link href="/sell/attach" className="underline">
              List a product
            </Link>{' '}
            to bring it back.
          </p>
        </Alert>
      )}

      {hasNothing && (
        <EmptyState
          title="You are not listing anything yet"
          description="Your store becomes visible to buyers once it carries at least one product. Registering is not enough on its own."
          action={
            <Link
              href="/sell/attach"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              List a product
            </Link>
          }
        />
      )}

      {/*
        Blocked first, deliberately. It is the thing a seller is most likely to be
        looking for: they submitted something, it is not in their listings, and they
        want to know where it went.
      */}
      {blocked.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Waiting on review</h2>
          {blocked.map((proposal: BlockedProposal) => (
            <PendingProposalNotice key={proposal.proposal_id} proposal={proposal} />
          ))}
        </section>
      )}

      {listings.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">
            {listings.length === 1 ? 'One product' : `${listings.length} products`}
          </h2>

          {listings.map((listing: StoreListing) => (
            <Card key={listing.product.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-4">
                {listing.product.primary_image_url ? (
                  <Image
                    src={listing.product.primary_image_url}
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
                  <Link
                    href={`/products/${listing.product.slug}`}
                    className="font-medium underline"
                  >
                    {listing.product.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {listing.variants.length === 1
                      ? '1 version listed'
                      : `${listing.variants.length} versions listed`}
                  </p>
                  {/*
                    M10. The way into S-31, and it is here rather than on the product
                    page because carrying the product is what opens the history. A
                    seller who detaches loses this on their next request.
                  */}
                  <Link
                    href={`/versions/${listing.product.slug}`}
                    className="mt-0.5 inline-block text-xs text-zinc-500 underline dark:text-zinc-400"
                  >
                    Record history
                  </Link>
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {listing.variants.map((variant) => (
                  <ListingRow
                    key={variant.attachment_id}
                    variant={variant}
                    productName={listing.product.name}
                    isLastListing={totalListedVariants === 1}
                    onDetached={(storeIsLive) => {
                      if (!storeIsLive) setWentDark(true);
                      refresh();
                    }}
                    onChanged={refresh}
                  />
                ))}
              </ul>
            </Card>
          ))}

          {/*
            The boundary of what a seller may change, said once rather than implied by
            what is missing. A seller who thinks a specification is wrong has a route,
            and it is not this screen.
          */}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            You set your own price and stock here. The product description, its
            specifications, and its versions are shared by everyone selling it, so
            changing one of those goes through the other sellers as a proposal.
          </p>
        </section>
      )}
    </div>
  );
}
