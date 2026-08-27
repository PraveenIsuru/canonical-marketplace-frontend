'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getMyStore, needsPinPlacement } from '@/lib/api/stores';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Card, Skeleton } from '@/components/ui';

/**
 * S-20 Seller dashboard, in its empty state.
 *
 * In this milestone the dashboard has exactly one job: say plainly that the store is
 * not visible to buyers yet, and what would change that. Everything else it will
 * eventually carry, meaning listings, pending proposals, and counters, depends on
 * endpoints that do not exist yet.
 *
 * Nothing here invents a listings table. A dashboard that showed an empty grid would
 * imply listings are a thing the seller has none of, when in fact the feature that
 * creates them has not shipped.
 */
export function SellerDashboard() {
  const { data: store, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.stores.mine(),
    queryFn: getMyStore,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your store could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  const needsPin = needsPinPlacement(store);

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {store.category} in {store.city}
        </p>
      </div>

      {/*
        The most important thing on the screen. `is_live` is derived from attachment
        count and nothing in onboarding can change it, so a seller who has just
        registered will otherwise wonder why buyers cannot find them.
      */}
      {store.is_live ? (
        <Alert tone="success" title="Your store is visible to buyers">
          Buyers can find you in seller lists for the products you carry.
        </Alert>
      ) : (
        <Alert tone="info" title="Your store is not visible to buyers yet">
          A store appears in seller lists only once it carries at least one product.
          Registering is not enough on its own, so nothing is wrong: there is simply a
          step still to come.
        </Alert>
      )}

      {needsPin && (
        <Alert tone="warning" title="Your location is not set">
          Buyers see sellers sorted by distance, so your store needs a place on the map
          before it can appear at all.{' '}
          <Link href="/sell/pin" className="underline">
            Place your pin
          </Link>
        </Alert>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">What happens next</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li className={needsPin ? '' : 'line-through opacity-60'}>
            Put your store on the map so buyers nearby can find it.
          </li>
          <li>
            Find a product you sell and attach your store to it, with your price. The
            platform keeps one record per product, so you join an existing record rather
            than writing a listing of your own.
          </li>
          <li>
            Once that first listing is approved, your store becomes visible in seller
            lists.
          </li>
        </ol>
        {/*
          The attach flow is M5. Saying so is more honest than a disabled button that
          gives no reason, and stops a seller hunting for a control that is not there.
        */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Attaching to a product is not available yet. It arrives with the listing flow.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">Store details</h2>
        <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-zinc-500 dark:text-zinc-400">Contact email</dt>
          <dd>{store.contact_email}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Contact phone</dt>
          <dd>{store.contact_phone ?? 'Not set'}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Address</dt>
          <dd>
            {store.address_line}, {store.city}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Location</dt>
          <dd>
            {store.latitude === null || store.longitude === null
              ? 'Not set'
              : `${store.latitude.toFixed(5)}, ${store.longitude.toFixed(5)}`}
            {store.geocode_source === 'manual_pin' && (
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">placed by hand</span>
            )}
          </dd>
        </dl>
        <Link href="/store/settings" className="text-sm underline">
          Edit store details
        </Link>
      </Card>
    </div>
  );
}
