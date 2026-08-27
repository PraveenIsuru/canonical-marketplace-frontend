/**
 * Schemas for peer review (EP-27 to EP-30).
 *
 * Mirrors development-docs/shared/api-contract.md at **version 4**, section 11.8 for
 * the proposal shapes and section 11.6 for the vote response.
 *
 * These carry the same weight as the confirmation schemas. A vote applies a change to
 * a record every seller shares, or blocks a seller for three days, and neither is
 * undone by a refresh.
 */

import { z } from 'zod';
import { proposalStatusSchema } from '@/lib/schemas/confirmation';

/*
 * `proposalStatusSchema` is imported rather than redeclared. M6 defined it for the
 * blocked listings entry, and two copies of one union drift the moment a status is
 * added to only one of them.
 */
export { proposalStatusSchema };

const proposalProductSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
});

/**
 * EP-27 and EP-28 list item.
 *
 * No confidence field appears here and none is accepted. A payload that grew one
 * would be a contract violation, and `assertNoConfidence` below is what catches it at
 * the boundary rather than on a screen.
 */
export const proposalSummarySchema = z.object({
  id: z.number().int(),
  status: proposalStatusSchema,
  review_opens_at: z.string(),
  review_closes_at: z.string(),
  resolved_at: z.string().nullable(),
  changed_fields: z.array(z.string()),
  product: proposalProductSchema,
  votes_cast: z.number().int(),
  reviewer_count: z.number().int(),
  has_voted: z.boolean(),
});

/**
 * One field under review.
 *
 * `from` is nullable because the record can hold nothing for a specification a seller
 * describes. `to` is not: a change with no proposed value is not a change.
 */
export const proposalChangeSchema = z.object({
  attribute: z.string(),
  from: z.string().nullable(),
  to: z.string(),
});

/**
 * EP-29 detail.
 *
 * `changes` is an array, matching the contract, so the review order is the display
 * order. Modelling it as a record would lose that and would also make a per field
 * decision look natural, which it is not.
 */
export const proposalDetailSchema = z.object({
  id: z.number().int(),
  status: proposalStatusSchema,
  review_opens_at: z.string(),
  review_closes_at: z.string(),
  resolved_at: z.string().nullable(),
  product: proposalProductSchema,
  changes: z.array(proposalChangeSchema),
  votes_cast: z.number().int(),
  reviewer_count: z.number().int(),
  has_voted: z.boolean(),
  is_mine: z.boolean(),
  can_vote: z.boolean(),
});

/**
 * EP-30, section 11.6.
 *
 * `vote_recorded` is a literal rather than a boolean. The endpoint answers this shape
 * only on success, so a payload saying `false` would mean the contract had changed
 * under us, and failing here is better than rendering "your vote was recorded" over
 * a vote that was not.
 */
export const voteResultSchema = z.object({
  vote_recorded: z.literal(true),
  proposal_status: proposalStatusSchema,
  resolved_at: z.string().nullable(),
});

/**
 * The last line of defence on invariant 3.
 *
 * The schemas above simply do not describe a confidence field, and zod ignores keys it
 * was not told about, so a backend regression that started sending one would pass
 * validation silently and sit in memory waiting for somebody to render it. This reads
 * the raw payload as text and refuses it.
 *
 * `resolution_reason` is checked alongside the two obvious names because it encodes
 * which band applied (`high_confidence_peers_against` and the rest), so leaking it
 * would leak the band under a different name.
 */
export function assertNoConfidence(payload: unknown, endpoint: string): void {
  const forbidden = ['confidence_score', 'confidence_band', 'resolution_reason'];
  const seen = JSON.stringify(payload) ?? '';

  for (const field of forbidden) {
    if (seen.includes(`"${field}"`)) {
      throw new Error(
        `${endpoint} returned the forbidden field "${field}". The confidence score decides ` +
          'the resolution matrix server side and must never reach a client. See section 6 of ' +
          'development-docs/shared/api-contract.md.',
      );
    }
  }
}

export type ProposalSummaryShape = z.infer<typeof proposalSummarySchema>;
export type ProposalDetailShape = z.infer<typeof proposalDetailSchema>;
export type VoteResultShape = z.infer<typeof voteResultSchema>;
