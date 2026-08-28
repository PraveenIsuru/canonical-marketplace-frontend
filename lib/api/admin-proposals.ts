/**
 * Administrator proposal work (EP-40, EP-41, EP-42, EP-58, EP-59).
 *
 * **The escalation queue is why this module exists.** The resolution matrix escalates
 * on a tie, on nobody voting, and on a well evidenced submission the incumbents
 * disagree with, and in each case the proposing seller cannot list the product until
 * an administrator answers. EP-41 is the only thing in the platform that ends that.
 *
 * Every call is authenticated and goes through this application's own proxy, which
 * attaches the Bearer token server side. Authorisation is the API's decision on every
 * request; `isAdmin` in `lib/auth/guards.ts` is a rendering hint and nothing more.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { assertNoForbiddenFields, paginated } from '@/lib/schemas/common';
import {
  adminDecisionResultSchema,
  adminProposalDetailSchema,
  adminProposalSummarySchema,
} from '@/lib/schemas/admin';
import type {
  AdminDecisionResult,
  AdminProposalDetail,
  AdminProposalSummary,
  ProposalStatus,
} from '@/types/admin';
import type { Paginated } from '@/types/api';

export type PaginatedAdminProposals = Paginated<AdminProposalSummary>;

/*
|--------------------------------------------------------------------------
| Reads
|--------------------------------------------------------------------------
*/

/**
 * EP-40 The escalation queue, oldest blocked first.
 *
 * The order is the queue's whole purpose: the row at the top is the seller who has
 * been unable to trade longest. Do not re-sort it on the client.
 */
export async function getEscalations(page = 1): Promise<PaginatedAdminProposals> {
  const payload = await apiFetch<unknown>('/api/admin/escalations', { query: { page } });

  assertNoForbiddenFields(payload, 'GET /api/admin/escalations');

  return parseResponse(
    paginated(adminProposalSummarySchema),
    payload,
    'GET /api/admin/escalations',
  );
}

/** EP-58 Every proposal, newest first, optionally filtered by status. */
export async function getAdminProposals(
  status?: ProposalStatus,
  page = 1,
): Promise<PaginatedAdminProposals> {
  const payload = await apiFetch<unknown>('/api/admin/proposals', { query: { status, page } });

  assertNoForbiddenFields(payload, 'GET /api/admin/proposals');

  return parseResponse(paginated(adminProposalSummarySchema), payload, 'GET /api/admin/proposals');
}

/**
 * EP-59 One proposal, with the change comparison, the votes, and their comments.
 *
 * The comments are the argument the administrator is being asked to settle and are the
 * most useful thing on the screen. `resolved_by` names the administrator who settled
 * it, and is **administrator to administrator only**: never render it anywhere a
 * seller can reach.
 */
export async function getAdminProposal(id: number): Promise<AdminProposalDetail> {
  const payload = await apiFetch<unknown>(`/api/admin/proposals/${id}`);

  assertNoForbiddenFields(payload, 'GET /api/admin/proposals/{id}');

  return parseResponse(adminProposalDetailSchema, payload, 'GET /api/admin/proposals/{id}');
}

/*
|--------------------------------------------------------------------------
| Decisions
|--------------------------------------------------------------------------
*/

export type Decision = 'approve' | 'reject';

/**
 * EP-41 Settles an escalated proposal.
 *
 * **Both outcomes unblock the proposing seller**, and the response says so through
 * `seller_unblocked`. Approval releases the listing they were waiting on and creates a
 * version; rejection creates neither and releases them to start a fresh attempt. Copy
 * that describes rejection as leaving them blocked is wrong.
 *
 * Refused with **409 `proposal_not_escalated`** when the proposal is in any other
 * state, which includes the ordinary race of two administrators working the same
 * queue. That is a refresh, not a fault.
 */
export async function resolveEscalation(
  id: number,
  decision: Decision,
): Promise<AdminDecisionResult> {
  const payload = await apiFetch<unknown>(`/api/admin/proposals/${id}/resolve`, {
    method: 'POST',
    body: { decision },
  });

  return parseResponse(
    adminDecisionResultSchema,
    payload,
    'POST /api/admin/proposals/{id}/resolve',
  );
}

/**
 * EP-42 Reverses a decision that has already been made.
 *
 * **This is not an undo.** Reversing an approval writes a **further version**, deletes
 * nothing, and removes no version from the chain. The record moves forward to a state
 * resembling the one before, and two things deliberately survive: any attribute
 * options the approval added along with every combination generated from them, and the
 * proposing seller's attachment.
 *
 * Requesting the outcome the proposal already holds is allowed and changes nothing but
 * the audit trail, recording that an administrator looked and let the decision stand.
 *
 * Refused with **409 `proposal_not_resolved`** when the proposal is still pending or
 * escalated. An escalated proposal has been decided by nobody, so there is nothing to
 * override; EP-41 is the endpoint for that.
 */
export async function overrideProposal(
  id: number,
  decision: Decision,
): Promise<AdminDecisionResult> {
  const payload = await apiFetch<unknown>(`/api/admin/proposals/${id}/override`, {
    method: 'POST',
    body: { decision },
  });

  return parseResponse(
    adminDecisionResultSchema,
    payload,
    'POST /api/admin/proposals/{id}/override',
  );
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/**
 * The proposal is no longer escalated.
 *
 * Almost always another administrator reaching it first. The screen should offer a
 * refresh rather than report a failure.
 */
export function isProposalNotEscalated(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'proposal_not_escalated';
}

/** Nobody has decided this proposal yet, so there is nothing to reverse. */
export function isProposalNotResolved(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'proposal_not_resolved';
}

/** Not an administrator. The proxy lets a token through; only the API knows. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'forbidden';
}
