/**
 * The confirmation flow and a seller's own listings (EP-19, EP-21, EP-22).
 *
 * Note what is absent, deliberately.
 *
 * There is no `confidence_score` and no `confidence_band`. They decide the resolution
 * matrix server side and are returned by no endpoint at any access level, so keeping
 * them out of these types means a careless addition fails to compile rather than
 * quietly rendering.
 *
 * There is no `current_value` on a question either. The API stores what the record
 * says so it can compare the answer, but never sends it: showing the seller the answer
 * we expect would turn confirmation into a yes or no exercise, and the whole value of
 * the flow is that they describe their own unit unled.
 */

/** One question put to a seller confirming a record that already exists. */
export interface ConfirmationQuestion {
  id: string;
  /** The field the answer is compared against: `name`, a spec key, or an attribute. */
  attribute: string;
  text: string;
}

/** EP-21. Sessions last 24 hours, which is why the deadline travels with them. */
export interface ConfirmationSession {
  session_id: string;
  product_id: number;
  questions: ConfirmationQuestion[];
  expires_at: string;
}

/**
 * EP-22, section 11.4 of the contract.
 *
 * A discriminated union rather than one shape with optional fields, and that is the
 * point. The two outcomes **share no keys**, so a component that forgets to branch on
 * `outcome` fails to compile instead of rendering an attached state for a seller who
 * is actually blocked.
 *
 * Both arrive as 201. Neither is an error, and `proposal_created` in particular is the
 * platform working rather than a failure to attach.
 */
export type ConfirmationOutcome =
  | { outcome: 'attached'; attachment_ids: number[] }
  | { outcome: 'proposal_created'; proposal_id: number; review_closes_at: string };

/** A proposal's lifecycle, as far as a seller's own screens are concerned. */
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';

/**
 * One product this seller cannot list, because their submission is under review.
 *
 * A blocked product has **no attachment row at all**, which is exactly why EP-19
 * returns these alongside the listings. Building a screen from listings alone would
 * hide the submission entirely.
 */
export interface BlockedProposal {
  proposal_id: number;
  /** Only `pending` and `escalated` are returned; a resolved proposal stops blocking. */
  status: ProposalStatus;
  review_opens_at: string;
  review_closes_at: string;
  /** Which fields are being argued about, so the notice can say what rather than only that. */
  changed_fields: string[];
  product: { id: number; slug: string; name: string };
}

/** One version of a product this seller carries. */
export interface ListedVariant {
  attachment_id: number;
  variant_id: number;
  attribute_values: Record<string, string>;
  /** Integer in the smallest currency unit. Divide by 100 for display only. */
  price_minor: number;
  currency: string;
  is_available: boolean;
}

/** One product this seller carries, with every version of it they list. */
export interface StoreListing {
  product: { id: number; slug: string; name: string; primary_image_url: string | null };
  variants: ListedVariant[];
}

/**
 * EP-19. Two lists in one object, not a paginator.
 *
 * `Paginated<T>` does not apply here and this is not a second list shape: it is one
 * response carrying two different things about the same store.
 */
export interface StoreListings {
  listings: StoreListing[];
  blocked: BlockedProposal[];
}
