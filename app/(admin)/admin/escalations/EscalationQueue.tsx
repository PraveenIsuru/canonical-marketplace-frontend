'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getEscalations, isForbidden } from '@/lib/api/admin-proposals';
import { queryKeys } from '@/lib/query/keys';
import { formatDate } from '@/lib/format/dates';
import { BlockedFor, blockedDays } from '@/components/admin/BlockedFor';
import { ResolutionReasonLabel } from '@/components/admin/ResolutionReason';
import { VoteTally } from '@/components/admin/VoteTally';
import { Alert, Card, EmptyState, Pagination, Skeleton } from '@/components/ui';
import type { AdminProposalSummary } from '@/types/admin';

/**
 * S-32 The escalation queue.
 *
 * **This is the screen the administrator surface exists for.** Every row is a seller
 * who cannot list a product until somebody here answers, and nothing else in the
 * platform can unblock them. The resolution matrix escalates on a tie, on nobody
 * voting, and on a well evidenced submission the incumbents rejected, and in each of
 * those cases the proposal stops and the seller waits.
 *
 * **Ordered oldest blocked first by the API, and not re-sorted here.** The row at the
 * top is whoever has been waiting longest, which is the only ordering this list should
 * ever have.
 */
export function EscalationQueue() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.admin.escalations(), page],
    queryFn: () => getEscalations(page),
    // A queue whose rows represent blocked people should not be minutes stale.
    staleTime: 30 * 1000,
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Header />

        {isForbidden(error) ? (
          <Alert tone="error" title="This is an administrator screen">
            Your account is not an administrator. The proxy let you through because you
            are signed in; the API decides the rest.
          </Alert>
        ) : (
          <Alert tone="error" title="The escalation queue could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <Header />

      {data.data.length === 0 ? (
        <EmptyState
          title="Nothing is waiting on you"
          description="No proposal has escalated. When one does, it appears here and a seller is blocked until you answer it."
        />
      ) : (
        <>
          <Alert tone="warning" title={countLabel(data.meta.total)}>
            Each of these is a seller who cannot list a product until it is decided.
            Approving or rejecting both end the wait; leaving it does not.
          </Alert>

          <ul className="flex flex-col gap-3">
            {data.data.map((proposal) => (
              <EscalationRow key={proposal.id} proposal={proposal} />
            ))}
          </ul>
        </>
      )}

      <Pagination meta={data.meta} hrefFor={(next) => `/admin/escalations?page=${next}`} />
    </div>
  );
}

function countLabel(total: number): string {
  return total === 1
    ? 'One seller is blocked and waiting'
    : `${total} sellers are blocked and waiting`;
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Escalations</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Proposals the sellers could not settle between them. Oldest first, so the seller
        who has waited longest is at the top.
      </p>
    </div>
  );
}

/**
 * One escalation.
 *
 * The blocked duration leads, in the largest type on the row, because it is the only
 * figure here that describes a person rather than a record. Everything else is context
 * for deciding; that is the reason for deciding today.
 */
function EscalationRow({ proposal }: { proposal: AdminProposalSummary }) {
  const days = blockedDays(proposal.review_opens_at);

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/admin/escalations/${proposal.id}`}
              className="text-lg font-medium underline"
            >
              {proposal.product.name}
            </Link>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Proposed by {proposal.store.name}
            </p>
          </div>

          <BlockedFor
            openedAt={proposal.review_opens_at}
            className={
              days >= 7
                ? 'shrink-0 rounded-md bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-300'
                : 'shrink-0 rounded-md bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Escalated because: </span>
            <ResolutionReasonLabel reason={proposal.resolution_reason} />
          </p>

          <VoteTally proposal={proposal} />

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Submitted {formatDate(proposal.review_opens_at)}, review closed{' '}
            {formatDate(proposal.review_closes_at)}
            {proposal.changed_fields.length > 0 && (
              <> · changes {proposal.changed_fields.join(', ')}</>
            )}
          </p>
        </div>

        <p className="text-sm">
          <Link href={`/admin/escalations/${proposal.id}`} className="underline">
            Read it and decide
          </Link>
        </p>
      </Card>
    </li>
  );
}
