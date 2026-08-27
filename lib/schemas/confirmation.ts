/**
 * Schemas for the confirmation flow and the listings dashboard (EP-19, EP-21, EP-22).
 *
 * Mirrors development-docs/shared/api-contract.md at **version 3**, plus the response
 * shapes recorded in the backend M6 entry of shared/milestone-log.md.
 *
 * These matter more here than anywhere so far. EP-22 either attaches a seller to a
 * shared record or blocks them from selling for three days, and neither is undone by a
 * refresh, so a shape misread is not something the seller can recover from.
 */

import { z } from 'zod';
import { priceMinorSchema } from '@/lib/schemas/common';

export const confirmationQuestionSchema = z.object({
  id: z.string(),
  attribute: z.string(),
  text: z.string(),
});

/**
 * EP-21.
 *
 * `current_value` is deliberately not in this schema. The API does not send it, and
 * adding it here would be the first step to rendering the answer we expect beside the
 * question, which is precisely what the flow is designed not to do.
 */
export const confirmationSessionSchema = z.object({
  session_id: z.string(),
  product_id: z.number().int(),
  questions: z.array(confirmationQuestionSchema),
  expires_at: z.string(),
});

/**
 * EP-22, section 11.4.
 *
 * A **discriminated union**, not one object with optional fields, and that is load
 * bearing rather than tidy. The two outcomes share no keys on purpose: a payload
 * claiming `attached` while carrying a `proposal_id` is a contract violation, and this
 * is where it should fail rather than three components later on a screen telling a
 * blocked seller they are live.
 */
export const confirmationOutcomeSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('attached'),
    attachment_ids: z.array(z.number().int()),
  }),
  z.object({
    outcome: z.literal('proposal_created'),
    proposal_id: z.number().int(),
    review_closes_at: z.string(),
  }),
]);

export const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'escalated']);

export const blockedProposalSchema = z.object({
  proposal_id: z.number().int(),
  status: proposalStatusSchema,
  review_opens_at: z.string(),
  review_closes_at: z.string(),
  changed_fields: z.array(z.string()),
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
  }),
});

export const listedVariantSchema = z.object({
  attachment_id: z.number().int(),
  variant_id: z.number().int(),
  attribute_values: z.record(z.string(), z.string()),
  price_minor: priceMinorSchema,
  currency: z.string(),
  is_available: z.boolean(),
});

export const storeListingSchema = z.object({
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    primary_image_url: z.string().nullable(),
  }),
  variants: z.array(listedVariantSchema),
});

/**
 * EP-19. Two arrays in one object.
 *
 * Both are required rather than optional. A missing `blocked` would be read as "no
 * blocked products", which is exactly the wrong thing to assume: a seller with a
 * pending proposal would be shown an empty dashboard and told they carry nothing.
 */
export const storeListingsSchema = z.object({
  listings: z.array(storeListingSchema),
  blocked: z.array(blockedProposalSchema),
});

/**
 * The result payload a completed confirmation job carries (EP-50, `result_type`
 * `confirmation_outcome`).
 *
 * The same union EP-22 returns, because the job completes the whole submission rather
 * than only the scoring. What the client resumes from is the outcome, never a score.
 */
export const confirmationJobResultSchema = confirmationOutcomeSchema;

export type ConfirmationSessionShape = z.infer<typeof confirmationSessionSchema>;
export type ConfirmationOutcomeShape = z.infer<typeof confirmationOutcomeSchema>;
export type StoreListingsShape = z.infer<typeof storeListingsSchema>;
