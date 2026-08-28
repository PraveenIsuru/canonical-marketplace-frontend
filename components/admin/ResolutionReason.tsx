import type { ResolutionReason as Reason } from '@/types/admin';

/**
 * Why the matrix decided what it decided, said in words.
 *
 * The API sends a coded value so the platform can query it. An administrator needs the
 * sentence, and each of the six is a genuinely different situation with a different
 * bearing on what to do next: a tie means the reviewers disagreed, no votes means
 * nobody looked, and high confidence against means a well evidenced submission the
 * incumbents rejected.
 *
 * **The word "confidence" appears in two of these labels and no number ever does.**
 * The band is what the matrix read; the score is what section 6 forbids, and the API
 * sends neither. Saying that a submission was well evidenced is describing why the
 * proposal escalated, which is exactly what an administrator is owed.
 */
const REASONS: Record<Reason, { label: string; detail: string }> = {
  tie_no_majority: {
    label: 'The reviewers tied',
    detail:
      'Equal numbers voted each way, so there is no majority. It came here rather than defaulting, because defaulting would mean picking a side the reviewers deliberately did not pick.',
  },
  no_votes_cast: {
    label: 'Nobody voted',
    detail:
      'The window closed with no votes at all. That is not a rejection: nobody looked, and this is where an unreviewed proposal goes.',
  },
  high_confidence_peers_against: {
    label: 'A well evidenced submission the sellers rejected',
    detail:
      'The submission was strong but the sellers already carrying the product voted it down. That is genuine disagreement rather than a weak claim, which is why it was not simply rejected.',
  },
  high_confidence_peers_favour: {
    label: 'A well evidenced submission the sellers accepted',
    detail: 'Both the assessment and the reviewers agreed.',
  },
  low_confidence_peers_favour: {
    label: 'The sellers accepted it',
    detail: 'The reviewers who carry the product voted in favour.',
  },
  low_confidence_peers_against: {
    label: 'The sellers rejected it',
    detail: 'The reviewers who carry the product voted against.',
  },
};

export function ResolutionReasonLabel({ reason }: { reason: Reason | null }) {
  if (reason === null) {
    return <span>Still with the reviewers</span>;
  }

  return <span>{REASONS[reason].label}</span>;
}

export function ResolutionReasonDetail({ reason }: { reason: Reason | null }) {
  if (reason === null) return null;

  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">{REASONS[reason].detail}</p>
  );
}
