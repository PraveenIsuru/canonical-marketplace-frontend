'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getStoreAnalytics, isStoreRequired } from '@/lib/api/analytics';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { utcDaysAgo, utcDaysBetween, utcToday } from '@/lib/format/dates';
import { ViewsChart } from '@/components/seller/ViewsChart';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui';

/**
 * S-30 Analytics.
 *
 * How many people looked at what this store carries, over a date range. It answers a
 * question a seller cannot answer any other way, because this platform has no orders:
 * nothing here is a sale, and there is nothing downstream of a view to measure.
 *
 * **Two counts, and the gap between them is the screen.** Views that reached this
 * store, against every view of the same products. Forty views means nothing on its
 * own; forty out of three hundred means something.
 *
 * Days are **UTC days**, and that is stated on screen rather than silently corrected.
 * Shifting the labels to local time would make the daily bars disagree with the totals
 * the API computed, and a seller comparing the two would be right to trust neither.
 */

/** The presets, in days, counting back from today inclusive. */
const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export function AnalyticsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  const { data, isPending, isError, error, refetch } = useQuery({
    // Empty strings rather than undefined so the key is stable when the API is left to
    // apply its own default of the last thirty days.
    queryKey: queryKeys.stores.analytics(from ?? '', to ?? ''),
    queryFn: () => getStoreAnalytics({ from, to }),
    staleTime: staleTimes.analytics,
    retry: false,
  });

  function selectRange(days: number) {
    const params = new URLSearchParams();
    params.set('from', utcDaysAgo(days - 1));
    params.set('to', utcToday());
    router.push(`/analytics?${params}`);
  }

  /*
   * A seller with no store at all. The proxy let them through because they hold a
   * token, and only the API knows they have no shop, which is exactly the split the
   * build plan describes: the proxy is an optimistic check and this is the real one.
   */
  if (isError && isStoreRequired(error)) {
    return (
      <div className="py-8">
        <EmptyState
          title="You do not have a store yet"
          description="Analytics counts the people looking at products your shop carries, so there is nothing to count until you have one."
          action={
            <Link
              href="/sell/start"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Start selling
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          How many people looked at the products you carry, and how many of them arrived
          through your shop.
        </p>
      </div>

      <RangeControl
        active={data ? utcDaysBetween(data.from, data.to) : null}
        onSelect={selectRange}
      />

      {isPending && <AnalyticsSkeleton />}

      {isError && !isStoreRequired(error) && (
        <Alert tone="error" title="Your analytics could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      )}

      {data && (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {data.from} to {data.to}, counted in UTC days. An evening&apos;s traffic where
            you are may land on the next day&apos;s bar.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Headline
              value={data.store_views}
              label="Reached your store"
              hint="Views by people who arrived at the product through your shop."
            />
            <Headline
              value={data.product_views}
              label="All views of the same products"
              hint="Everyone who looked, however they got there. This includes the figure beside it."
            />
          </div>

          {/*
            The whole range is zero only when nobody looked at anything. Distinguished
            from having no listings at all, which is the empty state further down,
            because those need different things done about them.
          */}
          {data.product_views === 0 && data.products.length > 0 && (
            <Alert tone="info" title="Nobody looked at these products in this period">
              Nothing is wrong. Try a wider date range, or check back once your listings
              have been up for longer.
            </Alert>
          )}

          {data.daily.length > 0 && data.product_views > 0 && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">Day by day</h2>
              <ViewsChart daily={data.daily} />
            </Card>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">By product</h2>

            {data.products.length === 0 ? (
              <EmptyState
                title="You are not carrying anything yet"
                description="Once you list a product, the people looking at it show up here. Nothing has gone wrong and there is nothing to fix."
                action={
                  <Link
                    href="/sell/attach"
                    className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    List a product
                  </Link>
                }
              />
            ) : (
              <ProductBreakdown products={data.products} />
            )}
          </section>

          <Card className="text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              A view is counted when somebody opens a product page. It is attributed to
              your shop only when they arrived through it, so a buyer who found the
              product through search counts in the second figure and not the first.
              Nobody is identified: these pages are public and no account is recorded
              against a view.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * The range presets.
 *
 * `active` is derived from what the API answered rather than from what was asked for,
 * so a range the API adjusted is reflected honestly rather than showing a preset
 * highlighted that is not what is on screen.
 */
function RangeControl({
  active,
  onSelect,
}: {
  active: number | null;
  onSelect: (days: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">Showing</span>
      {RANGES.map((range) => {
        const selected = active === range.days;

        return (
          <button
            key={range.days}
            type="button"
            onClick={() => onSelect(range.days)}
            aria-pressed={selected}
            className={
              selected
                ? 'rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}

function Headline({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
    </Card>
  );
}

/**
 * The per product table.
 *
 * A product the seller has since detached from stays listed, marked as no longer
 * carried. Its views were genuinely earned while they stocked it, and dropping the row
 * would make the total stop matching its own parts.
 */
function ProductBreakdown({
  products,
}: {
  products: { id: number; slug: string; name: string; store_views: number; product_views: number; is_carried: boolean }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="py-2 pr-4 font-medium">
              Product
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              Yours
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              All
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-4">
                <Link href={`/products/${product.slug}`} className="underline">
                  {product.name}
                </Link>
                {!product.is_carried && (
                  <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                    no longer listed
                  </span>
                )}
                <span className="block">
                  <Link
                    href={`/versions/${product.slug}`}
                    className="text-xs text-zinc-500 underline dark:text-zinc-400"
                  >
                    Record history
                  </Link>
                </span>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{product.store_views}</td>
              <td className="py-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                {product.product_views}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
