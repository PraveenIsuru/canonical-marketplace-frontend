/**
 * The administrator surface (EP-40 to EP-45, EP-49, EP-58 to EP-61).
 *
 * Mirrors section 11.12 of development-docs/shared/api-contract.md.
 *
 * **No confidence field appears anywhere in this file.** Not optional, not nullable,
 * absent. Section 6 has no exceptions and an administrator is not one: somebody
 * settling a disagreement between a seller and the incumbents should decide on the
 * evidence, and the AI's number would anchor that exactly as it would anchor a
 * reviewer's vote. A field that does not exist in a type cannot be rendered by
 * accident.
 *
 * `created_by_store_id` is absent for the same reason it is absent from `Product`.
 */

/** The coded reason the resolution matrix recorded. Null while a proposal is pending. */
export type ResolutionReason =
  | 'high_confidence_peers_favour'
  | 'high_confidence_peers_against'
  | 'low_confidence_peers_favour'
  | 'low_confidence_peers_against'
  | 'no_votes_cast'
  | 'tie_no_majority';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

/** The store a proposal came from. Named to administrators, never to reviewers. */
export interface AdminStoreRef {
  id: number;
  name: string;
}

/**
 * One proposal as an administrator sees it (EP-40, EP-58).
 *
 * Carries two things the reviewer's shape does not: the proposing store, and the vote
 * split. Both exist because an administrator is doing the opposite job to a reviewer,
 * who must judge a claim without knowing whose it is.
 */
export interface AdminProposalSummary {
  id: number;
  status: ProposalStatus;
  resolution_reason: ResolutionReason | null;
  review_opens_at: string;
  review_closes_at: string;
  resolved_at: string | null;
  changed_fields: string[];
  product: { id: number; slug: string; name: string };
  store: AdminStoreRef;
  votes_cast: number;
  votes_in_favour: number;
  votes_against: number;
  reviewer_count: number;
}

/** One reviewer's vote, with the comment that is the argument being settled. */
export interface AdminProposalVote {
  store: AdminStoreRef;
  vote: 'approve' | 'reject';
  comment: string | null;
  cast_at: string;
}

/**
 * What approval will create.
 *
 * No attachment row exists while a proposal blocks a seller, so this is the listing
 * being withheld. Null on a proposal that recorded none.
 */
export interface IntendedListing {
  variant_ids: number[];
  price_minor: number;
  currency: string;
}

/** EP-59. The summary plus the three things a decision needs. */
export interface AdminProposalDetail extends AdminProposalSummary {
  changes: { attribute: string; from: string | null; to: string }[];
  votes: AdminProposalVote[];
  intended_listing: IntendedListing | null;
  /**
   * The administrator who settled it, null until one has.
   *
   * **Administrator to administrator only.** Never rendered on a seller facing screen,
   * which is the same rule section 11.11 states from the other side: a version never
   * names the administrator who caused it.
   */
  resolved_by: { id: number; name: string } | null;
}

/**
 * What EP-41 and EP-42 answer.
 *
 * `seller_unblocked` is true on **both** outcomes of EP-41, and that is the point of
 * the field. What blocked the seller was an unresolved proposal, not an unfavourable
 * one. Copy that describes rejection as leaving them blocked is wrong.
 */
export interface AdminDecisionResult {
  proposal_id: number;
  status: ProposalStatus;
  resolved_at: string;
  /** Null where the decision wrote no version, which is every EP-41 rejection. */
  version_number: number | null;
  attachments_created: number;
  seller_unblocked: boolean;
}

/** EP-60. Counts rather than contents: what says whether a record is healthy. */
export interface AdminProductSummary {
  id: number;
  slug: string;
  name: string;
  category: string;
  seller_count: number;
  variant_count: number;
  image_count: number;
  current_version_number: number | null;
  /** Covers pending **and** escalated. Both mean somebody is blocked on this record. */
  has_pending_proposal: boolean;
}

export interface AdminProductAttribute {
  id: number;
  name: string;
  options: string[];
  position: number;
}

/**
 * One generated combination.
 *
 * Every one appears, including the ones no seller carries. Hiding an empty combination
 * would be the first place somebody got the idea one can be removed, and invariant 2
 * says none ever is.
 */
export interface AdminProductVariant {
  id: number;
  attribute_values: Record<string, string>;
  is_default: boolean;
  seller_count: number;
}

export interface AdminProductImage {
  id: number;
  url: string;
  mime_type: string;
  position: number;
}

/** EP-61, and what EP-43 answers with. */
export interface AdminProductDetail extends AdminProductSummary {
  description: string | null;
  specifications: Record<string, unknown>;
  attributes: AdminProductAttribute[];
  variants: AdminProductVariant[];
  images: AdminProductImage[];
}

/**
 * EP-43's request body.
 *
 * **No `slug`**, because it is the record's public address and a rename breaks every
 * link keyed by it. **No `variants`**, because a combination is generated and never
 * written directly, which is invariant 2. Neither is optional here; neither exists.
 */
export interface AdminProductEdit {
  name?: string;
  description?: string | null;
  category?: string;
  /** Replaces the map wholesale. A key left out is removed. */
  specifications?: Record<string, string>;
  /** Additive, merged by name. An option list is widened, never narrowed. */
  attributes?: { name: string; options: string[] }[];
}

/** EP-45. Counts, not analytics, and nothing on it is per user. */
export interface PlatformMetrics {
  products: { total: number; with_sellers: number; without_sellers: number };
  stores: { total: number; live: number; dark: number };
  proposals: { pending: number; escalated: number; approved: number; rejected: number };
  community: { posts: number; verified_users: number };
  views: { last_7_days: number; last_30_days: number };
  /**
   * The one figure here that names an obligation rather than a fact.
   *
   * Null when nothing is escalated. While it is set, a seller is blocked and waiting.
   */
  oldest_escalation_opened_at: string | null;
}

export interface PostDeleted {
  deleted: boolean;
  replies_hidden: number;
}

export interface ImageDeleted {
  deleted: boolean;
  images_remaining: number;
}
