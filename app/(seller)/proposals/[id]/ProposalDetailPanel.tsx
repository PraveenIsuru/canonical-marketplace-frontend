'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProposal,
  isAlreadyVoted,
  isNotEligibleToVote,
  isProposalNotFound,
  isReviewClosed,
  voteOnProposal,
} from '@/lib/api/proposals';
import { ApiError } from '@/lib/api/client';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { formatDate, timeRemaining } from '@/lib/format/dates';
import { ChangeComparison } from '@/components/proposal/ChangeComparison';
import { ProposalStatusBadge } from '@/components/proposal/ProposalStatusBadge';
import { Alert, Button, Card, Skeleton } from '@/components/ui';
import type { ProposalStatus, VoteChoice } from '@/types/proposal';

/**
 * S-27 and S-29, which are one screen because they are one resource.
 *
 * EP-29 serves the proposing seller and the reviewers from the same id and answers
 * `is_mine` to say which the caller is. Splitting this into two routes would mean a
 * reviewer and a proposer following the same link land in different places, and one of
 * them would find nothing there.
 *
 * So: the comparison renders for both, and the vote panel renders only for a reviewer
 * who may still vote. A store that is neither gets a 404 from the endpoint, which is
 * deliberate on the backend's part and not something to work around here.
 *
 * **No confidence score anywhere**, for either audience. **No per field control**: a
 * proposal is taken or left whole.
 */
export function ProposalDetailPanel({ id }: { id: number }) {
  const queryClient = useQueryClient();

  const [voting, setVoting] = useState(false);
  const [comment, setComment] = useState('');
  const [voteError, setVoteError] = useState<ApiError | null>(null);
  /** Set from EP-30's own response, which carries the status after the vote. */
  const [votedStatus, setVotedStatus] = useState<ProposalStatus | null>(null);

  const { data: proposal, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.proposals.detail(id),
    queryFn: () => getProposal(id),
    staleTime: staleTimes.proposalsToReview,
    retry: (count, caught) => !isProposalNotFound(caught) && count < 2,
  });

  async function castVote(choice: VoteChoice) {
    setVoting(true);
    setVoteError(null);

    try {
      const result = await voteOnProposal(id, {
        vote: choice,
        comment: comment.trim() === '' ? undefined : comment.trim(),
      });

      /*
       * The response carries the status after the vote, because this vote may have
       * been the last one outstanding and resolved the proposal on the spot. Rendering
       * from it means no polling and no second request to find out what happened.
       */
      setVotedStatus(result.proposal_status);

      // The queue and the seller's own list both change once a vote lands.
      await queryClient.invalidateQueries({ queryKey: queryKeys.proposals.detail(id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.proposals.toReview() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.proposals.mine() });
    } catch (caught) {
      setVoteError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'Your vote could not be recorded.'),
      );
    }

    setVoting(false);
  }

  /* ---------------------------------------------------------------- states */

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  /*
   * 404 covers both "no such proposal" and "none of your business", and the backend
   * makes them indistinguishable on purpose: which products a competitor is arguing
   * about is not public. So this says the same thing for both rather than guessing.
   */
  if (isError && isProposalNotFound(error)) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">This proposal is not available to you</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Either it does not exist, or it is about a product your store was not carrying
          when the review opened. Only the seller who proposed a change and the sellers
          who already stocked the product can see one.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/proposals" className="underline">
            Your proposals
          </Link>
          <Link href="/proposals/to-review" className="underline">
            Reviews waiting on you
          </Link>
        </div>
      </div>
    );
  }

  if (isError || !proposal) {
    return (
      <div className="py-8">
        <Alert tone="error" title="This proposal could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  const status = votedStatus ?? proposal.status;
  const isPendingStatus = status === 'pending';
  const remaining = isPendingStatus ? timeRemaining(proposal.review_closes_at) : null;
  const hasVoted = proposal.has_voted || votedStatus !== null;
  const canVote = proposal.can_vote && votedStatus === null;

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{proposal.product.name}</h1>
          <ProposalStatusBadge status={status} />
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {proposal.is_mine
            ? 'You described this product differently from the catalogue, so the sellers who already carry it are deciding.'
            : 'Another seller has described this product differently from the catalogue. You are being asked because you carry it.'}{' '}
          <Link href={`/products/${proposal.product.slug}`} className="underline" target="_blank">
            See the product page
          </Link>
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">What would change</h2>
        <ChangeComparison changes={proposal.changes} />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {/*
            Worth saying outright. A seller looking at the public product page during a
            review sees the old value and may take that for a bug.
          */}
          The catalogue still shows the current values. Nothing changes unless this is
          approved.
        </p>
      </Card>

      <Card className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="text-zinc-600 dark:text-zinc-400">
            {proposal.votes_cast} of {proposal.reviewer_count}{' '}
            {proposal.reviewer_count === 1 ? 'reviewer has' : 'reviewers have'} voted
          </span>
          {isPendingStatus ? (
            <span className="text-zinc-600 dark:text-zinc-400">
              Closes {formatDate(proposal.review_closes_at)}
              {remaining !== null && <>, about {remaining} from now</>}
            </span>
          ) : (
            proposal.resolved_at !== null && (
              <span className="text-zinc-600 dark:text-zinc-400">
                {/*
                  An escalated proposal has `resolved_at` set because the window closed,
                  but it is not decided and the seller is still blocked. Saying
                  "decided" here would be the cruellest possible wording.
                */}
                {status === 'escalated' ? 'Went to an administrator' : 'Decided'}{' '}
                {formatDate(proposal.resolved_at)}
              </span>
            )
          )}
        </div>
        {proposal.reviewer_count === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">
            Nobody else carries this product yet, so there is no one to review it. It
            goes to an administrator when the window closes.
          </p>
        )}
      </Card>

      <StatusExplanation status={status} isMine={proposal.is_mine} />

      {/* S-29. Only for a reviewer who may still vote. */}
      {canVote && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-medium">Your decision</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Does the proposed version describe the product you stock? A proposal is
              taken or left as a whole, so this covers every field above together.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="comment" className="text-sm font-medium">
              Anything to add? <span className="font-normal text-zinc-500">Optional</span>
            </label>
            <textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="For example, what your own unit says."
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Read by an administrator if the reviewers do not reach a majority.
            </p>
          </div>

          {voteError !== null && <VoteRefusal error={voteError} />}

          {/*
            Two actions, and only two. There is no third for abstaining: a reviewer with
            no view simply leaves, and reviewers who do not vote are left out of the
            count rather than counted as against.
          */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => castVote('approve')} loading={voting} disabled={voting}>
              This is correct
            </Button>
            <Button
              variant="secondary"
              onClick={() => castVote('reject')}
              loading={voting}
              disabled={voting}
            >
              This is wrong
            </Button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A vote cannot be changed once cast.
          </p>
        </Card>
      )}

      {/*
        Says why the buttons are not there, rather than showing dead ones. A disabled
        pair would imply this seller is not allowed, when for a proposer nobody is.
      */}
      {!canVote && <NoVoteReason isMine={proposal.is_mine} hasVoted={hasVoted} status={status} />}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/proposals/to-review" className="underline">
          Reviews waiting on you
        </Link>
        <Link href="/proposals" className="underline">
          Your proposals
        </Link>
      </div>
    </div>
  );
}

/** What each outcome means for the person reading it. */
function StatusExplanation({ status, isMine }: { status: ProposalStatus; isMine: boolean }) {
  if (status === 'approved') {
    return (
      <Alert tone="success" title="This change was accepted">
        {isMine
          ? 'The catalogue now says what you described, and the product has been added to your listings.'
          : 'The catalogue now says what was proposed, and a new version of the record was written.'}
      </Alert>
    );
  }

  if (status === 'rejected') {
    return (
      <Alert tone="info" title="This change was not accepted">
        {isMine
          ? 'The reviewers did not agree that the catalogue was wrong, so the record is unchanged. You are no longer blocked and can list this product by answering the questions again.'
          : 'The reviewers did not agree, so the record is unchanged.'}
      </Alert>
    );
  }

  if (status === 'escalated') {
    /*
     * Still blocking, and the seller is still owed an answer. There is deliberately no
     * control here to resolve it: administrator resolution is EP-41 and EP-42, which
     * are M11, and a button that did nothing would be worse than none.
     */
    return (
      <Alert tone="info" title="An administrator is deciding this one">
        {isMine
          ? 'The reviewers did not reach a majority, so it has gone to an administrator. You still cannot list this product until they decide, and there is no deadline on that step.'
          : 'The review window closed without a majority, so an administrator is deciding. There is nothing further for reviewers to do.'}
      </Alert>
    );
  }

  return null;
}

/** Why no vote buttons are shown. Never a disabled button, always a sentence. */
function NoVoteReason({
  isMine,
  hasVoted,
  status,
}: {
  isMine: boolean;
  hasVoted: boolean;
  status: ProposalStatus;
}) {
  if (isMine) {
    return (
      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        This is your own proposal, so you do not vote on it. A seller deciding their own
        case would decide it, and where they are the only other store the vote would be
        unanimous by construction.
      </Card>
    );
  }

  if (hasVoted) {
    return (
      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        Your vote is in. It cannot be changed, and the proposal stays open until the
        other reviewers decide or the window closes.
      </Card>
    );
  }

  if (status !== 'pending') {
    return (
      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        This proposal is decided, so there is nothing left to vote on.
      </Card>
    );
  }

  return (
    <Card className="text-sm text-zinc-600 dark:text-zinc-400">
      The review window has closed, so no further votes can be cast.
    </Card>
  );
}

/**
 * The three ways EP-30 refuses, each said plainly.
 *
 * None of them is a fault of the person reading it, so none is styled as an error the
 * user caused. The window closing between loading the page and pressing the button is
 * an ordinary race, not a mistake.
 */
function VoteRefusal({ error }: { error: ApiError }) {
  if (isAlreadyVoted(error)) {
    return (
      <Alert tone="info" title="You have already voted on this">
        Your first vote stands. A vote cannot be revised, because a window that can be
        renegotiated is not a deadline.
      </Alert>
    );
  }

  if (isNotEligibleToVote(error)) {
    return (
      <Alert tone="info" title="You were not asked to review this one">
        Only the stores carrying this product when the review opened can vote. Attaching
        to it since then does not add a vote, which is what stops a proposal gathering
        reviewers after the fact.
      </Alert>
    );
  }

  if (isReviewClosed(error)) {
    return (
      <Alert tone="info" title="This review has closed">
        It was decided while this page was open. Reload to see the outcome.
      </Alert>
    );
  }

  return (
    <Alert tone="error" title="Your vote could not be recorded">
      {error.message}
    </Alert>
  );
}
