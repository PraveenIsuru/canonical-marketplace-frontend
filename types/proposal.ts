/**
 * Peer review (EP-27 to EP-30), per section 11.8 of the contract.
 *
 * Note what is absent, and that it is absent rather than optional.
 *
 * There is **no `confidence_score` and no `confidence_band`**. They decide the
 * resolution matrix server side and are returned to nobody, the seller who wrote the
 * proposal included. A reviewer who could see the AI's assessment would be voting on
 * the assessment rather than on the product they actually stock, which is the one
 * thing peer review exists to avoid. Declaring the field here, even optionally, would
 * be the first step to somebody rendering it.
 *
 * There is also **no per field accept or reject state**. A proposal is taken or left
 * as a whole, and a type carrying per field decisions would invite a control that
 * invariant 4 forbids.
 *
 * This file replaced an M0 placeholder written before any of these endpoints existed.
 * The old shape guessed at `proposing_store`, `vote_summary`, `comments`, `my_vote`,
 * and `current_values`, none of which the API returns.
 */

import type { ProposalStatus } from '@/types/confirmation';

/*
 * Re-exported rather than declared again. M6 defined this for the blocked listings
 * entry, and two definitions of the same union drift the moment one gains a status.
 */
export type { ProposalStatus };

/** The product a proposal argues about. Never the store that proposed it. */
export interface ProposalProduct {
  id: number;
  slug: string;
  name: string;
}

/**
 * One proposal in a list (EP-27 and EP-28).
 *
 * `reviewer_count` is the frozen reviewer set recorded when the proposal opened, not
 * the number of stores carrying the product today. `votes_cast` counts votes actually
 * cast, and it is the denominator the matrix uses: a reviewer who does not vote is
 * excluded rather than counted as opposed.
 */
export interface ProposalSummary {
  id: number;
  status: ProposalStatus;
  review_opens_at: string;
  review_closes_at: string;
  /** Null while the proposal is still pending. */
  resolved_at: string | null;
  /** Which fields are argued about, so a row can say what rather than only that. */
  changed_fields: string[];
  product: ProposalProduct;
  votes_cast: number;
  reviewer_count: number;
  /** Describes the calling store, which is what separates outstanding from finished. */
  has_voted: boolean;
}

/**
 * One field under review.
 *
 * `from` is what the record says now and is null where it held nothing, which is a
 * real case rather than a defensive nullable: a seller can describe a specification
 * the record never had.
 */
export interface ProposalChange {
  attribute: string;
  from: string | null;
  to: string;
}

/**
 * One proposal in full (EP-29).
 *
 * `changes` is an array rather than an object so the order fields are reviewed in is
 * the order they are displayed in.
 */
export interface ProposalDetail {
  id: number;
  status: ProposalStatus;
  review_opens_at: string;
  review_closes_at: string;
  resolved_at: string | null;
  product: ProposalProduct;
  changes: ProposalChange[];
  votes_cast: number;
  reviewer_count: number;
  has_voted: boolean;
  /** True for the proposing store, which may read its own proposal but never vote. */
  is_mine: boolean;
  /**
   * A rendering hint and nothing more.
   *
   * True only when the caller is in the frozen reviewer set, has not already voted,
   * and the window is still open. EP-30 re-checks all three and refuses regardless of
   * what the client believed, because the window can close between the read and the
   * write.
   */
  can_vote: boolean;
}

/** The two things a reviewer may say. There is no third value for abstaining. */
export type VoteChoice = 'approve' | 'reject';

/**
 * What EP-30 answers, per section 11.6.
 *
 * It carries the status **after** the vote, because a vote can resolve the proposal
 * on the spot when it was the last one outstanding. The screen shows the outcome from
 * this response rather than polling for it.
 */
export interface VoteResult {
  vote_recorded: true;
  proposal_status: ProposalStatus;
  /** Set only when this vote resolved the proposal. */
  resolved_at: string | null;
}
