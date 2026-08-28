'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlatformMetrics } from '@/lib/api/admin-moderation';
import { isForbidden } from '@/lib/api/admin-proposals';
import { queryKeys } from '@/lib/query/keys';
import { BlockedFor } from '@/components/admin/BlockedFor';
import { Alert, Card, Skeleton } from '@/components/ui';
import type { PlatformMetrics } from '@/types/admin';

/**
 * S-37 The platform at a glance.
 *
 * Counts rather than analytics. It answers "is anything wrong right now" rather than
 * "how are we doing", which is why there is no time series here and nothing to compare
 * a period against.
 *
 * **`oldest_escalation_opened_at` leads, because it is the only figure that names an
 * obligation rather than a fact.** Every other number describes the platform; that one
 * describes a person who cannot trade, and while it is set somebody is waiting.
 *
 * Nothing on this screen is per user. The closest is a count of people who have
 * verified something, which is a number and not a list.
 */
export function PlatformSnapshot() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.metrics(),
    queryFn: getPlatformMetrics,
    // Counts of the whole platform. Refetching on every focus would be expensive for
    // numbers that move slowly.
    staleTime: 60 * 1000,
    retry: false,
  });

  if (isPending) return <LoadingSnapshot />;

  if (isError) {
    return (
      <div className="py-8">
        {isForbidden(error) ? (
          <Alert tone="error" title="This is an administrator screen">
            Your account is not an administrator.
          </Alert>
        ) : (
          <Alert tone="error" title="The snapshot could not be loaded">
            <p>
              This endpoint counts the whole view table, which has no rollup
              aggregation, so a timeout here is more likely than on other screens.
            </p>
            <button type="button" onClick={() => refetch()} className="mt-2 underline">
              Try again
            </button>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Metrics</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Where the platform stands right now. Counts, not trends.
        </p>
      </div>

      <Obligation metrics={data} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Products">
          <Figure label="In the catalogue" value={data.products.total} />
          <Figure label="With at least one seller" value={data.products.with_sellers} />
          <Figure
            label="Nobody carries"
            value={data.products.without_sellers}
            // Not a fault. A product with no sellers stays visible and keeps its URL.
            hint="Still visible, still at their own address"
          />
        </Panel>

        <Panel title="Stores">
          <Figure label="Registered" value={data.stores.total} />
          <Figure label="Visible to buyers" value={data.stores.live} />
          <Figure
            label="Dark"
            value={data.stores.dark}
            hint="Holding no listings, so buyers cannot see them"
          />
        </Panel>

        <Panel title="Proposals">
          <Figure label="With the reviewers" value={data.proposals.pending} />
          <Figure
            label="Escalated"
            value={data.proposals.escalated}
            hint={data.proposals.escalated > 0 ? 'Each one is a blocked seller' : undefined}
          />
          <Figure label="Accepted" value={data.proposals.approved} />
          <Figure label="Rejected" value={data.proposals.rejected} />
        </Panel>

        <Panel title="Community">
          <Figure label="Posts" value={data.community.posts} hint="Removed posts are not counted" />
          <Figure label="People who have verified ownership" value={data.community.verified_users} />
        </Panel>

        <Panel title="Product page views">
          <Figure label="Last 7 days" value={data.views.last_7_days} />
          <Figure label="Last 30 days" value={data.views.last_30_days} />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Counted in UTC days. Nobody is identified: these pages are public and no
            account is recorded against a view.
          </p>
        </Panel>
      </div>
    </div>
  );
}

/**
 * The one number that is somebody waiting.
 *
 * Rendered above everything else when set, and as a plain reassurance when null. The
 * difference between "one seller has been blocked nine days" and a row in a grid of
 * counts is the difference between a screen that prompts action and one that reports.
 */
function Obligation({ metrics }: { metrics: PlatformMetrics }) {
  if (metrics.oldest_escalation_opened_at === null) {
    return (
      <Alert tone="success" title="Nothing is waiting on an administrator">
        No proposal has escalated. Nobody is blocked.
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="Somebody is blocked and waiting">
      <p>
        The longest waiting escalation has been open since{' '}
        <BlockedFor
          openedAt={metrics.oldest_escalation_opened_at}
          className="font-semibold"
        />
        . {metrics.proposals.escalated === 1
          ? 'One proposal is escalated'
          : `${metrics.proposals.escalated} proposals are escalated`}
        , and nothing except an administrator can settle them.
      </p>
      <p className="mt-2">
        <Link href="/admin/escalations" className="underline">
          Go to the queue
        </Link>
      </p>
    </Alert>
  );
}

/**
 * The loading state, which says what is taking the time after a few seconds.
 *
 * This endpoint counts the whole view table, which grows fastest in the system and has
 * no rollup aggregation behind it. A skeleton that just sat there would read as broken;
 * saying what is being counted turns a slow load into an expected one.
 */
function LoadingSnapshot() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4 py-8">
      <Skeleton className="h-8 w-40" />
      {slow && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
          Still counting. Every product page view ever recorded is included in these
          figures, and there is no precomputed rollup behind them.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <dl className="flex flex-col gap-1.5">{children}</dl>
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-zinc-600 dark:text-zinc-400">
        {label}
        {hint && (
          <span className="block text-xs text-zinc-500 dark:text-zinc-500">{hint}</span>
        )}
      </dt>
      <dd className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</dd>
    </div>
  );
}
