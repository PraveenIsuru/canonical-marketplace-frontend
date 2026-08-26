/**
 * Proposals, votes, and the attachment flow.
 *
 * Note what is absent: there is no confidence score or confidence band anywhere in
 * this file. Not optional, not nullable, absent. The score drives the resolution
 * matrix server side and never leaves the server. A field declared here would be a
 * field somebody eventually renders.
 */

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

export type EscalationReason = 'disagreement' | 'inactivity';

export interface VoteSummary {
  in_favour: number;
  against: number;
}

export interface ReviewerComment {
  store_name: string;
  comment: string;
  created_at: string;
}

export interface Proposal {
  id: number;
  product: { id: number; slug: string; name: string };
  proposing_store: { id: number; name: string };
  changes: Record<string, unknown>;
  current_values: Record<string, unknown>;
  status: ProposalStatus;
  review_opens_at: string;
  /** Null once escalated, because no deadline applies to an escalation. */
  review_closes_at: string | null;
  resolved_at: string | null;
  vote_summary: VoteSummary;
  escalation_reason: EscalationReason | null;
  comments: ReviewerComment[];
  /** A hint for rendering only. Eligibility is decided server side on the vote call. */
  can_vote: boolean;
  /** The caller's own vote, when they have already cast one. */
  my_vote: boolean | null;
}

/** Vote responses carry the post vote status, so the screen shows the outcome directly. */
export interface VoteResult {
  vote_recorded: true;
  proposal_status: ProposalStatus;
  resolved_at: string | null;
}

/** A candidate returned by AI matching. The match score is internal and is not returned. */
export interface MatchCandidate {
  product_id: number;
  slug: string;
  name: string;
  primary_image: { url: string } | null;
}

export interface ConfirmationQuestion {
  id: string;
  attribute_name: string;
  question: string;
}

export interface ConfirmationSession {
  session_id: string;
  product: { id: number; slug: string; name: string };
  questions: ConfirmationQuestion[];
}

export interface WizardSession {
  session_id: string;
  questions: ConfirmationQuestion[];
}

/**
 * One endpoint, two outcomes, distinguished by a field rather than a status code.
 *
 * No attachment is created alongside a proposal. The absence of an attachment row
 * is what blocks the proposing seller from selling that product.
 */
export type ConfirmationOutcome =
  | { outcome: 'attached'; attachment_ids: number[] }
  | { outcome: 'proposal_created'; proposal_id: number; review_closes_at: string };

export interface WizardResult {
  product: { id: number; slug: string; name: string };
  variants_generated: number;
  attachments_created: number;
  store_is_live: boolean;
}
