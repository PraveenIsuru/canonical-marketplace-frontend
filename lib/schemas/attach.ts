/**
 * Schemas for the attachment flow (EP-20, EP-23, EP-24, EP-48).
 *
 * Mirrors development-docs/shared/api-contract.md at **version 2**, plus the response
 * shapes recorded in the backend M5 entry of shared/milestone-log.md.
 *
 * With no mock standing between these screens and the API, these are what turn a
 * contract mismatch into a readable error naming the field. That matters more here
 * than anywhere else so far: EP-24 writes a canonical product that has no deletion
 * path, so a shape misread is not something a refresh fixes.
 */

import { z } from 'zod';
import { priceMinorSchema } from '@/lib/schemas/common';

/**
 * One match candidate.
 *
 * `match_score` is search relevance and nothing more. It is **not** the confidence
 * score that section 6 of the contract forbids exposing, which is written to a
 * proposal and drives peer review resolution server side. Never label this as
 * confidence anywhere in the interface.
 */
export const matchCandidateSchema = z.object({
  product_id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  primary_image_url: z.string().nullable(),
  match_score: z.number(),
});

/**
 * EP-20.
 *
 * An empty array parses successfully and is a **successful answer**, not an empty
 * state to apologise for. It is what routes the seller into the wizard.
 */
export const matchResultSchema = z.object({
  candidates: z.array(matchCandidateSchema),
});

export const wizardQuestionSchema = z.object({
  id: z.string(),
  attribute: z.string(),
  text: z.string(),
});

/**
 * EP-23.
 *
 * `expires_at` is not in the api specification and was added by the backend at M5. A
 * session lasts 24 hours, and a client that cannot see the deadline cannot warn
 * anyone about it.
 */
export const wizardSessionSchema = z.object({
  session_id: z.string(),
  questions: z.array(wizardQuestionSchema),
  expires_at: z.string(),
});

/** EP-24, matching section 11.7 of the contract. */
export const wizardSubmitResultSchema = z.object({
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    current_version_number: z.number().int(),
  }),
  variants_generated: z.number().int(),
  attachments_created: z.number().int(),
  store_is_live: z.boolean(),
});

/** EP-48. */
export const uploadedProductImageSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  mime_type: z.string(),
  position: z.number().int(),
  uploaded_by_user_id: z.number().int().nullable(),
});

/**
 * The result payload a completed match job carries (EP-50, `result_type`
 * `match_candidates`).
 *
 * `image_considered` is false whenever the job ran from the queue. A match image is
 * transient and is gone by the time the retry happens, so the answer came from text
 * alone and the seller is told so rather than left to assume otherwise.
 */
export const matchJobResultSchema = z.object({
  candidates: z.array(matchCandidateSchema),
  image_considered: z.boolean().optional(),
});

/** The result payload a completed wizard job carries (`result_type` `wizard_questions`). */
export const wizardJobResultSchema = wizardSessionSchema;

export const carriedVariantSchema = z.object({
  attribute_values: z.record(z.string(), z.string()),
  price_minor: priceMinorSchema.min(1),
  currency: z.string().length(3),
});

export type MatchCandidateShape = z.infer<typeof matchCandidateSchema>;
export type WizardSessionShape = z.infer<typeof wizardSessionSchema>;
export type WizardSubmitResultShape = z.infer<typeof wizardSubmitResultSchema>;
