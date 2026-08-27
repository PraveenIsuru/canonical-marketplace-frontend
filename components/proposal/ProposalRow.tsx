import Link from 'next/link';
import { Card } from '@/components/ui';
import { formatDate, timeRemaining } from '@/lib/format/dates';
import { ProposalStatusBadge } from './ProposalStatusBadge';
import type { ProposalSummary } from '@/types/proposal';

interface Props {
  proposal: ProposalSummary;
  /** On the review queue, "you voted" is the useful fact. On your own list it is not. */
  showVoted?: boolean;
}

/**
 * One proposal in a list, used by both S-26 and S-28.
 *
 * The two screens read the same shape for different reasons, so the row is shared and
 * the wording around it is not. What differs is `showVoted`, because "you have voted"
 * is meaningful in a review queue and meaningless on a list of your own submissions,
 * where you are never the voter.
 */
export function ProposalRow({ proposal, showVoted = false }: Props) {
  const isPending = proposal.status === 'pending';
  const remaining = isPending ? timeRemaining(proposal.review_closes_at) : null;
  /*
   * An escalated proposal carries `resolved_at`, because the review window did finish.
   * It is not decided, though: an administrator still has to rule on it, and calling
   * that date a decision would tell a blocked seller the wait was over.
   */
  const isEscalated = proposal.status === 'escalated';

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={`/proposals/${proposal.id}`} className="font-medium underline">
          {proposal.product.name}
        </Link>
        <ProposalStatusBadge status={proposal.status} />
      </div>

      {proposal.changed_fields.length > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Under review: {proposal.changed_fields.join(', ')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {isPending ? (
          <span>
            Closes {formatDate(proposal.review_closes_at)}
            {remaining !== null && <>, about {remaining} from now</>}
          </span>
        ) : (
          proposal.resolved_at !== null && (
            <span>
              {isEscalated ? 'Went to an administrator' : 'Decided'}{' '}
              {formatDate(proposal.resolved_at)}
            </span>
          )
        )}

        {/*
          Votes cast against the reviewer set frozen when the proposal opened. Worth
          showing both numbers: a reviewer deciding whether their vote still matters
          wants to know how many others have spoken, and a proposer watching their
          submission wants to know anyone is looking at it at all.

          Not a tally of for and against. That would let a late reviewer vote with the
          crowd rather than on the product.
        */}
        <span>
          {proposal.votes_cast} of {proposal.reviewer_count}{' '}
          {proposal.reviewer_count === 1 ? 'reviewer has' : 'reviewers have'} voted
        </span>

        {showVoted && proposal.has_voted && (
          <span className="font-medium text-zinc-600 dark:text-zinc-300">You have voted</span>
        )}
      </div>
    </Card>
  );
}
