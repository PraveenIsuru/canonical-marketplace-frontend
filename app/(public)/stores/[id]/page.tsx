import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore } from '@/lib/api/catalogue';
import { formatMoney } from '@/lib/format/money';
import { Card, EmptyState } from '@/components/ui';

/**
 * S-07 Public store profile.
 *
 * Static with on demand revalidation. A store profile changes rarely, and it is
 * indexable, so it is prerendered like the product page.
 *
 * A dark store is not reachable here. The API answers 404 for one, and this renders
 * the not found boundary rather than an empty profile, because a store that is not
 * visible to buyers must not be discoverable by guessing an id either.
 */
export const revalidate = 300;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const store = await getStore(Number(id));

  if (!store) return { title: 'Store not found' };

  return {
    title: `${store.name}, ${store.city}`,
    description: `Contact details and products carried by ${store.name} in ${store.city}.`,
    alternates: { canonical: `/stores/${store.id}` },
  };
}

export default async function StorePage({ params }: Params) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) notFound();

  const store = await getStore(numericId);

  // Covers both a store that does not exist and one that is dark. The API does not
  // distinguish them, deliberately.
  if (!store) notFound();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{store.category}</p>
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        {store.rating !== null && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rated {store.rating.toFixed(1)} out of 5
          </p>
        )}
      </header>

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">Contact and address</h2>

        {/* Shown without a login. This disclosure is the point of the platform. */}
        <address className="flex flex-col gap-1 text-sm not-italic text-zinc-600 dark:text-zinc-400">
          <span>{store.address_line}</span>
          <span>{store.city}</span>
          <a href={`mailto:${store.contact_email}`} className="underline">
            {store.contact_email}
          </a>
          {store.contact_phone && (
            <a href={`tel:${store.contact_phone}`} className="underline">
              {store.contact_phone}
            </a>
          )}
        </address>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Located at {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
        </p>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          What this store carries
          <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {store.listings.length} {store.listings.length === 1 ? 'listing' : 'listings'}
          </span>
        </h2>

        {store.listings.length === 0 ? (
          <EmptyState
            title="Nothing listed right now"
            description="This store has no current listings."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {store.listings.map((listing) => (
              <li
                key={listing.attachment_id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex flex-col gap-0.5">
                  {/*
                    Carries the store context for EP-52, and this is the only place in
                    the application that does. A visitor following this link arrived at
                    the product *through* this store, so the view it records belongs to
                    them. A product reached from the catalogue or from search carries
                    no `store` parameter and is attributed to nobody.
                  */}
                  <Link
                    href={`/products/${listing.product.slug}?store=${store.id}`}
                    className="font-medium underline"
                  >
                    {listing.product.name}
                  </Link>
                  {Object.keys(listing.attribute_values).length > 0 && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {Object.values(listing.attribute_values).join(', ')}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-semibold">
                    {formatMoney(listing.price_minor, listing.currency)}
                  </span>
                  {listing.is_available ? (
                    <span className="text-xs text-green-700 dark:text-green-400">In stock</span>
                  ) : (
                    <span className="text-xs text-amber-700 dark:text-amber-500">Out of stock</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
