import type { ProposalStatus } from '@/types/proposal';

const LABELS: Record<ProposalStatus, string> = {
  pending: 'Under review',
  approved: 'Approved',
  rejected: 'Not accepted',
  escalated: 'With an administrator',
};

/*
 * Approved is the only green one.
 *
 * `pending` and `escalated` are blue rather than amber on purpose. Both mean the
 * seller is still waiting, and neither is a warning: nothing has gone wrong, a
 * decision simply has not been reached. `rejected` is grey rather than red, because
 * the record disagreeing with a seller is an ordinary outcome of asking, not a fault
 * on their part.
 */
const TONES: Record<ProposalStatus, string> = {
  pending: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  approved: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  escalated: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

/** A proposal's status, worded for the person reading it rather than as a raw enum. */
export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
