import Link from 'next/link';
import { formatDistance, formatMoney } from '@/lib/format/money';
import type { SellerListing } from '@/lib/schemas/catalogue';

/**
 * One seller.
 *
 * The contact block is shown to anonymous visitors. That is the purpose of this
 * screen, not an incidental disclosure: the platform works on contact and redirect,
 * and a buyer who cannot see how to reach a seller cannot buy anything.
 */
export function SellerRow({ listing }: { listing: SellerListing }) {
  const distance = formatDistance(listing.distance_km);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/stores/${listing.store.id}`} className="font-medium underline">
            {listing.store.name}
          </Link>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{listing.store.category}</span>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {listing.store.address_line}, {listing.store.city}
        </p>

        <dl className="flex flex-col gap-0.5 text-sm">
          <div className="flex gap-2">
            <dt className="sr-only">Email</dt>
            <dd>
              <a href={`mailto:${listing.store.contact_email}`} className="underline">
                {listing.store.contact_email}
              </a>
            </dd>
          </div>
          {listing.store.contact_phone && (
            <div className="flex gap-2">
              <dt className="sr-only">Phone</dt>
              <dd>
                <a href={`tel:${listing.store.contact_phone}`} className="underline">
                  {listing.store.contact_phone}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {listing.store.rating !== null && <span>Rated {listing.store.rating.toFixed(1)} out of 5</span>}
          {/*
            Rendered only when a distance is known. distance_km is null when the buyer
            shared no location, and "0 km" would wrongly read as next door.
          */}
          {distance !== null && <span>{distance} away</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <p className="text-lg font-semibold">{formatMoney(listing.price_minor, listing.currency)}</p>
        {listing.is_available ? (
          <span className="text-xs text-green-700 dark:text-green-400">In stock</span>
        ) : (
          // The seller keeps the listing and stays visible. Only the availability
          // filter excludes them.
          <span className="text-xs text-amber-700 dark:text-amber-500">Out of stock</span>
        )}
      </div>
    </li>
  );
}
