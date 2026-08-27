/**
 * Peer review (EP-27 to EP-30).
 *
 * The half of the platform that decides what a canonical record says. No seller edits
 * a product, so every change arrives as a proposal and is settled by the sellers who
 * already carry that product.
 *
 * Every call here is authenticated and goes through this application's own proxy at
 * `/api/proxy`, which attaches the Bearer token server side.
 *
 * One rule runs through the module: **a proposal is taken or left as a whole.** There
 * is no helper here that submits part of one, because no endpoint accepts part of one.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { paginated } from '@/lib/schemas/common';
import {
  assertNoConfidence,
  proposalDetailSchema,
  proposalSummarySchema,
  voteResultSchema,
} from '@/lib/schemas/proposal';
import type { ProposalDetail, ProposalSummary, VoteChoice, VoteResult } from '@/types/proposal';
import type { Paginated } from '@/types/api';

/*
 * The shared paginator from section 2, not a shape of this module's own. The build
 * plan is explicit that there is one list shape in this application and no second one
 * gets introduced.
 */
export type PaginatedProposals = Paginated<ProposalSummary>;

/*
|--------------------------------------------------------------------------
| EP-27 The caller's own proposals
|--------------------------------------------------------------------------
*/

/**
 * What this store has proposed, whatever became of it.
 *
 * Returns **every status**, not only the ones still blocking. A seller wants to know
 * that last week's submission was approved as much as they want to know what is still
 * outstanding, and a list that quietly dropped resolved proposals would read as the
 * submission having been lost.
 */
export async function getMyProposals(page = 1): Promise<PaginatedProposals> {
  const payload = await apiFetch<unknown>('/api/proposals/mine', { query: { page } });

  assertNoConfidence(payload, 'GET /api/proposals/mine');

  return parseResponse(paginated(proposalSummarySchema), payload, 'GET /api/proposals/mine');
}

/*
|--------------------------------------------------------------------------
| EP-28 The reviews assigned to this store
|--------------------------------------------------------------------------
*/

/**
 * The proposals this store was asked to review.
 *
 * Read from the frozen reviewer set recorded when each proposal opened, never from
 * what the store carries today. A store that attached to the product mid window is
 * not in that set and sees nothing here; a store that detached is still in it and is
 * still asked.
 *
 * Proposals this store has already voted on **stay in the list**, marked `has_voted`.
 * A reviewer who voted yesterday and comes back to check should find it where they
 * left it rather than conclude it vanished.
 */
export async function getProposalsToReview(page = 1): Promise<PaginatedProposals> {
  const payload = await apiFetch<unknown>('/api/proposals/to-review', { query: { page } });

  assertNoConfidence(payload, 'GET /api/proposals/to-review');

  return parseResponse(paginated(proposalSummarySchema), payload, 'GET /api/proposals/to-review');
}

/*
|--------------------------------------------------------------------------
| EP-29 One proposal, with the change comparison
|--------------------------------------------------------------------------
*/

/**
 * The proposal a reviewer votes on, and the one a proposer waits on.
 *
 * One endpoint serves both, and `is_mine` says which the caller is. A store that is
 * neither the proposer nor a frozen reviewer gets **404**, not 403: which products a
 * competitor is arguing about is not public, so the refusal does not confirm the
 * proposal exists.
 */
export async function getProposal(id: number): Promise<ProposalDetail> {
  const payload = await apiFetch<unknown>(`/api/proposals/${id}`);

  assertNoConfidence(payload, 'GET /api/proposals/{id}');

  return parseResponse(proposalDetailSchema, payload, 'GET /api/proposals/{id}');
}

/*
|--------------------------------------------------------------------------
| EP-30 Voting
|--------------------------------------------------------------------------
*/

export interface VoteSubmission {
  vote: VoteChoice;
  /** Optional free text. Useful to an administrator if the proposal escalates. */
  comment?: string;
}

/**
 * Votes on a proposal as a whole.
 *
 * The response carries the status **after** the vote, because this vote may have been
 * the last one outstanding and resolved the proposal on the spot. Render from what it
 * returns rather than polling: there is nothing to wait for, the answer is in hand.
 *
 * Three refusals the caller must handle, and none of them is a bug:
 *
 *  - **403 `not_eligible_to_vote`** means this store was not attached when the
 *    proposal opened. Eligibility was frozen then and does not change.
 *  - **409 `already_voted`** means this store has already voted. A vote is never
 *    revised.
 *  - **409 `review_closed`** means the window ran out, or the proposal already
 *    resolved, between reading it and voting.
 */
export async function voteOnProposal(id: number, submission: VoteSubmission): Promise<VoteResult> {
  const payload = await apiFetch<unknown>(`/api/proposals/${id}/vote`, {
    method: 'POST',
    body: submission,
  });

  assertNoConfidence(payload, 'POST /api/proposals/{id}/vote');

  return parseResponse(voteResultSchema, payload, 'POST /api/proposals/{id}/vote');
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/** This store was not attached when the proposal opened, so it never had a vote. */
export function isNotEligibleToVote(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'not_eligible_to_vote';
}

/** Already voted. The first vote stands and there is no way to change it. */
export function isAlreadyVoted(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'already_voted';
}

/** The window closed, or the proposal resolved, before this vote arrived. */
export function isReviewClosed(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'review_closed';
}

/**
 * Either the proposal does not exist or the caller has no business seeing it.
 *
 * Deliberately indistinguishable, which is the point of the backend answering 404
 * here. The screen says the same thing for both.
 */
export function isProposalNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
