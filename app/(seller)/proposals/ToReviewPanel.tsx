'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getProposalsToReview } from '@/lib/api/proposals';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { ProposalRow } from '@/components/proposal/ProposalRow';
import { Alert, Card, EmptyState, Pagination, Skeleton } from '@/components/ui';

/**
 * S-28 Reviews waiting on you.
 *
 * The proposals this store was asked to decide, because it already carried the product
 * when somebody described it differently.
 *
 * Two things about who appears here, both decided by the backend and neither
 * recomputable from what a store carries today. The reviewer set was frozen when each
 * proposal opened: a store that attached to the product afterwards is not in it, and a
 * store that has since detached still is. Eligibility is a fact about a moment.
 *
 * **Proposals this store has already voted on stay listed**, marked as voted. A
 * reviewer who voted yesterday and comes back to check should find it where they left
 * it. Hiding it would make a cast vote look like it never happened.
 */
export function ToReviewPanel() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: [...queryKeys.proposals.toReview(), page],
    queryFn: () => getProposalsToReview(page),
    staleTime: staleTimes.proposalsToReview,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your review queue could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  const outstanding = data.data.filter((proposal) => !proposal.has_voted);
  const voted = data.data.filter((proposal) => proposal.has_voted);

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Reviews waiting on you</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Another seller has described a product you carry differently from the
          catalogue. You are being asked because you stock it.{' '}
          <Link href="/proposals" className="underline">
            Your own proposals
          </Link>
        </p>
      </div>

      {data.data.length === 0 && (
        <EmptyState
          title="Nothing is waiting on you"
          description="You are asked to review a product only when another seller proposes a change to one you already carry. Nothing is outstanding right now."
          action={
            <Link href="/listings" className="underline">
              See your listings
            </Link>
          }
        />
      )}

      {outstanding.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            {outstanding.length === 1 ? 'One review outstanding' : `${outstanding.length} reviews outstanding`}
          </h2>
          {outstanding.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} showVoted />
          ))}
        </section>
      )}

      {voted.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">You have already voted</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            These are still open while the other reviewers decide. A vote cannot be
            changed once it is cast.
          </p>
          {voted.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} showVoted />
          ))}
        </section>
      )}

      <Pagination meta={data.meta} hrefFor={(next) => `/proposals/to-review?page=${next}`} />

      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          You are voting on whether the catalogue is right, not on the seller who asked.
          A proposal is taken or left as a whole, so there is nothing to accept part of.
        </p>
        <p className="mt-2">
          Not voting is a real option. Reviewers who say nothing are left out of the
          count rather than treated as being against it.
        </p>
      </Card>
    </div>
  );
}
