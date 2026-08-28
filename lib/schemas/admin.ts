/**
 * Schemas for the administrator surface (EP-40 to EP-45, EP-49, EP-58 to EP-61).
 *
 * Mirrors section 11.12 of the contract.
 *
 * **No confidence field is parsed here**, and `assertNoForbiddenFields` is run over
 * every administrator read besides. Zod ignores keys it was not told about, so without
 * that check a backend regression that started emitting a score would validate
 * silently and sit in memory waiting for somebody to render it. Section 6 has no
 * exceptions and an administrator is not one.
 */

import { z } from 'zod';
import { priceMinorSchema } from '@/lib/schemas/common';

export const resolutionReasonSchema = z.enum([
  'high_confidence_peers_favour',
  'high_confidence_peers_against',
  'low_confidence_peers_favour',
  'low_confidence_peers_against',
  'no_votes_cast',
  'tie_no_majority',
]);

export const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'escalated']);

const storeRefSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const adminProposalSummarySchema = z.object({
  id: z.number().int(),
  status: proposalStatusSchema,
  // Null while a proposal is still pending: the matrix has not decided anything yet.
  resolution_reason: resolutionReasonSchema.nullable(),
  review_opens_at: z.string(),
  review_closes_at: z.string(),
  resolved_at: z.string().nullable(),
  changed_fields: z.array(z.string()),
  product: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
  }),
  store: storeRefSchema,
  votes_cast: z.number().int(),
  votes_in_favour: z.number().int(),
  votes_against: z.number().int(),
  reviewer_count: z.number().int(),
});

export const adminProposalVoteSchema = z.object({
  store: storeRefSchema,
  vote: z.enum(['approve', 'reject']),
  comment: z.string().nullable(),
  cast_at: z.string(),
});

export const adminProposalDetailSchema = adminProposalSummarySchema.extend({
  changes: z.array(
    z.object({
      attribute: z.string(),
      // Null is a real case: a seller can describe a specification the record never held.
      from: z.string().nullable(),
      to: z.string(),
    }),
  ),
  votes: z.array(adminProposalVoteSchema),
  intended_listing: z
    .object({
      variant_ids: z.array(z.number().int()),
      price_minor: priceMinorSchema,
      currency: z.string(),
    })
    .nullable(),
  resolved_by: z
    .object({
      id: z.number().int(),
      name: z.string(),
    })
    .nullable(),
});

export const adminDecisionResultSchema = z.object({
  proposal_id: z.number().int(),
  status: proposalStatusSchema,
  resolved_at: z.string(),
  // Null where the decision wrote no version, which is every EP-41 rejection.
  version_number: z.number().int().nullable(),
  attachments_created: z.number().int(),
  seller_unblocked: z.boolean(),
});

export const adminProductSummarySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  seller_count: z.number().int(),
  variant_count: z.number().int(),
  image_count: z.number().int(),
  current_version_number: z.number().int().nullable(),
  has_pending_proposal: z.boolean(),
});

export const adminProductDetailSchema = adminProductSummarySchema.extend({
  description: z.string().nullable(),
  specifications: z.record(z.string(), z.unknown()),
  attributes: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      options: z.array(z.string()),
      position: z.number().int(),
    }),
  ),
  variants: z.array(
    z.object({
      id: z.number().int(),
      attribute_values: z.record(z.string(), z.string()),
      is_default: z.boolean(),
      seller_count: z.number().int(),
    }),
  ),
  images: z.array(
    z.object({
      id: z.number().int(),
      url: z.string(),
      mime_type: z.string(),
      position: z.number().int(),
    }),
  ),
});

export const platformMetricsSchema = z.object({
  products: z.object({
    total: z.number().int(),
    with_sellers: z.number().int(),
    without_sellers: z.number().int(),
  }),
  stores: z.object({
    total: z.number().int(),
    live: z.number().int(),
    dark: z.number().int(),
  }),
  proposals: z.object({
    pending: z.number().int(),
    escalated: z.number().int(),
    approved: z.number().int(),
    rejected: z.number().int(),
  }),
  community: z.object({
    posts: z.number().int(),
    verified_users: z.number().int(),
  }),
  views: z.object({
    last_7_days: z.number().int(),
    last_30_days: z.number().int(),
  }),
  // Null when nothing is escalated. While it is set, a seller is waiting.
  oldest_escalation_opened_at: z.string().nullable(),
});

export const postDeletedSchema = z.object({
  deleted: z.boolean(),
  replies_hidden: z.number().int(),
});

export const imageDeletedSchema = z.object({
  deleted: z.boolean(),
  images_remaining: z.number().int(),
});
