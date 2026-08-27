/**
 * The confirmation flow (EP-21, EP-22) and a seller's own listings (EP-19).
 *
 * Every call here is authenticated and goes through this application's own proxy at
 * `/api/proxy`, which attaches the Bearer token server side.
 *
 * One rule runs through the whole module: **a proposal is not a failure.** EP-22
 * answers 201 for both of its outcomes, and `proposal_created` means the seller
 * described something the record does not say and the sellers who carry it are now
 * checking. Nothing here throws on it, and nothing that renders it may style it as an
 * error.
 */

import { z } from 'zod';
import { apiFetch, ApiError, AiUnavailableError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { variantSchema as catalogueVariantSchema } from '@/lib/schemas/catalogue';
import {
  confirmationOutcomeSchema,
  confirmationSessionSchema,
  storeListingsSchema,
} from '@/lib/schemas/confirmation';
import type {
  ConfirmationOutcome,
  ConfirmationSession,
  StoreListings,
} from '@/types/confirmation';
import type { Variant as CatalogueVariant } from '@/types/product';

/*
|--------------------------------------------------------------------------
| EP-21 Start confirmation
|--------------------------------------------------------------------------
*/

/**
 * Opens confirmation for a product the catalogue already holds.
 *
 * Refuses in two ways the caller must handle, and neither is a bug:
 *
 *  - **409 `already_attached`** means the seller already carries this product, and
 *    they belong in their listings rather than in this flow.
 *  - **409 `proposal_pending`** means they have a submission on this product still
 *    under review, and no attachment can exist until it resolves.
 *
 * Throws `AiUnavailableError` with a queued job id when the provider is down. That is
 * the X-01 panel's cue, not an error to show.
 */
export async function startConfirmation(productId: number): Promise<ConfirmationSession> {
  const payload = await apiFetch<unknown>('/api/attach/confirm/start', {
    method: 'POST',
    body: { product_id: productId },
  });

  return parseResponse(confirmationSessionSchema, payload, 'POST /api/attach/confirm/start');
}

/*
|--------------------------------------------------------------------------
| EP-22 Submit confirmation
|--------------------------------------------------------------------------
*/

export interface ConfirmationSubmission {
  session_id: string;
  /** Keyed by the question ids the session returned. They mean nothing outside it. */
  answers: Record<string, string>;
  variant_ids: number[];
  /** Integer in the smallest currency unit. Never a float. */
  price_minor: number;
  currency?: string;
}

/**
 * Submits the answers.
 *
 * **Answers 201 for both outcomes.** Branch on `outcome` and nothing else: the two
 * payloads share no keys, so reading `attachment_ids` off a `proposal_created`
 * response gets `undefined` rather than an empty list, and treating that as "attached
 * with nothing" would tell a blocked seller they are live.
 *
 * Refuses with **422 `confirmation_incomplete`** when a question was left unanswered,
 * which is its own registered code rather than `validation_failed`. An expired session
 * comes back as `validation_failed` keyed on `session_id`, and the seller restarts at
 * EP-21 for the same product rather than going back through matching.
 */
export async function submitConfirmation(
  submission: ConfirmationSubmission,
): Promise<ConfirmationOutcome> {
  const payload = await apiFetch<unknown>('/api/attach/confirm/submit', {
    method: 'POST',
    body: submission,
  });

  return parseResponse(confirmationOutcomeSchema, payload, 'POST /api/attach/confirm/submit');
}

/*
|--------------------------------------------------------------------------
| EP-19 The seller's own listings
|--------------------------------------------------------------------------
*/

/**
 * What this store carries, and what it is blocked on.
 *
 * Two lists in one call, and the second is why. A product with a proposal under review
 * has **no attachment row at all**, so a screen built from `listings` alone would show
 * nothing and leave the seller wondering where their submission went.
 *
 * Not paginated. It returns an object with two arrays rather than a list.
 */
export async function getMyListings(): Promise<StoreListings> {
  const payload = await apiFetch<unknown>('/api/stores/mine/listings');

  return parseResponse(storeListingsSchema, payload, 'GET /api/stores/mine/listings');
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/** The seller already carries this product. They want their listings, not this flow. */
export function isAlreadyAttached(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'already_attached';
}

/** A submission on this product is still under review, so nothing can attach yet. */
export function isProposalPending(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'proposal_pending';
}

/** A question was left unanswered. Completion is mandatory and cannot be skipped. */
export function isConfirmationIncomplete(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'confirmation_incomplete';
}

/**
 * The 24 hour session ran out while the seller was answering.
 *
 * Reported as a validation failure keyed on `session_id`. The product is known and
 * still exists, so only the questions are stale: the seller restarts at EP-21 rather
 * than going back through matching.
 */
export function isExpiredSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'validation_failed' &&
    error.errors?.session_id !== undefined
  );
}

/** The provider is down, the work is queued, and the submission is not lost. */
export function isAiUnavailable(error: unknown): error is AiUnavailableError {
  return error instanceof AiUnavailableError;
}

/*
|--------------------------------------------------------------------------
| The product's versions, for the variant picker
|--------------------------------------------------------------------------
*/

/**
 * EP-10, fetched from the browser.
 *
 * The catalogue helpers all fetch server side, because the public pages are statically
 * generated. The confirmation screen is a client component and needs the same data at
 * interaction time, so it goes through the proxy like every other browser call.
 *
 * That is safe rather than merely convenient: a public route is defined not to change
 * behaviour when a token happens to be present, so the extra hop costs a request and
 * changes nothing about the answer.
 *
 * Every combination comes back, including ones no seller carries. The picker shows
 * them all, because a combination with no sellers is exactly what a new seller is
 * likely to be adding.
 */
export async function getProductVariants(slug: string): Promise<CatalogueVariant[]> {
  const payload = await apiFetch<unknown>(`/api/products/${encodeURIComponent(slug)}/variants`);

  return parseResponse(z.array(catalogueVariantSchema), payload, 'GET /api/products/{slug}/variants');
}
