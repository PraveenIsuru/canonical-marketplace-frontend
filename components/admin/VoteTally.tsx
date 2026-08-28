import { formatRelative } from '@/lib/format/dates';
import type { AdminProposalSummary, AdminProposalVote } from '@/types/admin';

/**
 * The split, which reviewers never see and an administrator always needs.
 *
 * `votes_in_favour` and `votes_against` sum to `votes_cast`, and `reviewer_count` is
 * the frozen reviewer set recorded when the proposal opened. The gap between the two is
 * the reviewers who said nothing.
 *
 * **Silence is shown as silence, not as opposition.** Non voters are excluded from the
 * matrix's denominator, which is why a proposal can be approved on one vote out of
 * five, and an administrator reading "2 of 5 voted" needs to understand that as three
 * people not looking rather than three people objecting.
 */
export function VoteTally({ proposal }: { proposal: AdminProposalSummary }) {
  const silent = proposal.reviewer_count - proposal.votes_cast;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span>
        <strong className="font-semibold">{proposal.votes_in_favour}</strong> in favour
      </span>
      <span>
        <strong className="font-semibold">{proposal.votes_against}</strong> against
      </span>
      {silent > 0 && (
        <span className="text-zinc-500 dark:text-zinc-400">
          {silent} did not vote, which counts as neither
        </span>
      )}
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {proposal.reviewer_count} {proposal.reviewer_count === 1 ? 'reviewer' : 'reviewers'} were
        asked
      </span>
    </div>
  );
}

/**
 * What each reviewer actually said.
 *
 * The comments are the argument the administrator is being asked to settle, and are
 * the most useful thing on the screen. A reviewer who did not vote is absent from the
 * array rather than present with a null vote, because silence is not a position.
 */
export function VoteList({ votes }: { votes: AdminProposalVote[] }) {
  if (votes.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nobody voted before the window closed. There is no reviewer opinion to weigh
        here, which is why this needs deciding rather than counting.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {votes.map((vote) => (
        <li
          key={`${vote.store.id}-${vote.cast_at}`}
          className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium">{vote.store.name}</span>
            <span
              className={
                vote.vote === 'approve'
                  ? 'text-xs font-medium text-green-700 dark:text-green-400'
                  : 'text-xs font-medium text-amber-700 dark:text-amber-500'
              }
            >
              voted to {vote.vote === 'approve' ? 'accept' : 'reject'}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatRelative(vote.cast_at)}
            </span>
          </div>

          {vote.comment === null ? (
            <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-500">
              No comment left
            </p>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm">{vote.comment}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
