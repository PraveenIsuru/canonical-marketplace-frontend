'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { getMyListings } from '@/lib/api/confirmation';
import { queryKeys } from '@/lib/query/keys';
import { formatMoney } from '@/lib/format/money';
import { PendingProposalNotice } from '@/components/proposal/PendingProposalNotice';
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
 * Read only in this milestone. Editing a price, toggling availability, and detaching
 * are EP-25 and EP-26, which land at M8. Rendering a disabled price field would imply
 * the control exists and is merely closed to this seller, so the screen says plainly
 * that editing is still being built instead.
 */
export function ListingsPanel() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.stores.listings(),
    queryFn: getMyListings,
  });

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

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your listings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The products your store carries, and anything waiting on review.
        </p>
      </div>

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
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {listing.variants.map((variant) => (
                  <li
                    key={variant.attachment_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <span>
                      {Object.entries(variant.attribute_values).length === 0
                        ? 'Single default version'
                        : Object.entries(variant.attribute_values)
                            .map(([name, value]) => `${name}: ${value}`)
                            .join(', ')}
                    </span>

                    <span className="flex items-center gap-3">
                      {/* Divided by 100 for display only. The integer is what crosses
                          the wire and what is stored. */}
                      <span className="font-medium">
                        {formatMoney(variant.price_minor, variant.currency)}
                      </span>
                      {!variant.is_available && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          marked unavailable
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          {/*
            Said once, at the bottom, rather than as a disabled control on every row.
            A greyed out price field would imply the seller is not allowed to edit,
            when in fact nobody can yet.
          */}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Changing a price, marking something unavailable, and removing a listing are
            still being built.
          </p>
        </section>
      )}
    </div>
  );
}
