'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getMyProposals } from '@/lib/api/proposals';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { ProposalRow } from '@/components/proposal/ProposalRow';
import { Alert, Card, EmptyState, Pagination, Skeleton } from '@/components/ui';

/**
 * S-26 Your proposals.
 *
 * Everything this store has submitted, whatever became of it. It answers the question
 * a seller has after confirmation sends them away: what happened to what I said?
 *
 * **Every status appears**, not only the ones still blocking. A list that dropped
 * resolved proposals would leave a seller who was approved last week unable to find
 * any trace of it, which reads as the submission having been lost.
 *
 * No confidence score appears, on any row, for any status. The seller who wrote the
 * proposal does not get to see how the AI scored it any more than a reviewer does.
 */
export function MyProposalsPanel() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...queryKeys.proposals.mine(), page],
    queryFn: () => getMyProposals(page),
    staleTime: staleTimes.proposalsToReview,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your proposals could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  const blocking = data.data.filter(
    (proposal) => proposal.status === 'pending' || proposal.status === 'escalated',
  );
  const settled = data.data.filter(
    (proposal) => proposal.status === 'approved' || proposal.status === 'rejected',
  );

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your proposals</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          When what you told us about a product differed from the catalogue, the sellers
          who already carry it review the difference. This is where those go.{' '}
          <Link href="/proposals/to-review" className="underline">
            Reviews waiting on you
          </Link>
        </p>
      </div>

      {data.data.length === 0 && (
        <EmptyState
          title="You have not proposed any changes"
          description="A proposal happens on its own when you describe a product differently from the catalogue. There is nothing to start here, and nothing has gone wrong."
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
        Still waiting comes first. A seller on this screen is most often looking for
        the thing that is blocking them, not for the history.
      */}
      {blocking.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Still waiting</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You cannot list these products until each one is decided. Nothing you entered
            has been lost.
          </p>
          {blocking.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </section>
      )}

      {settled.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Decided</h2>
          {settled.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} />
          ))}
        </section>
      )}

      <Pagination meta={data.meta} hrefFor={(next) => `/proposals?page=${next}`} />

      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Nobody edits a product record directly, including us. A change comes from a
          seller who knows the product, and the sellers who stock it decide on it. That
          is why this screen exists rather than an edit form.
        </p>
      </Card>
    </div>
  );
}
