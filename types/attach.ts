/**
 * The attachment flow: matching and the listing wizard (EP-20, EP-23, EP-24, EP-48).
 *
 * Note what is absent, deliberately.
 *
 * There is no confidence score and no confidence band anywhere in this file. Those
 * drive peer review resolution on the server and must never reach a screen. The
 * `match_score` below is a different thing entirely: it is how close a search result
 * was, it decides nothing, and it must never be labelled as confidence.
 *
 * There is also no `created_by_store_id`. A product created through the wizard is
 * platform owned, and the seller who ran the wizard gains no rights over it.
 */

/** The details a seller types before any AI call is made. Shared by EP-20 and EP-23. */
export interface ProductDraft {
  name: string;
  description: string | null;
  category: string | null;
}

/**
 * One product matching thinks the seller may be describing (EP-20).
 *
 * `primary_image_url` is null where the record holds no images, which is common for a
 * product a previous seller created through the wizard without uploading any.
 */
export interface MatchCandidate {
  product_id: number;
  slug: string;
  name: string;
  primary_image_url: string | null;
  /** Between 0 and 1. Search relevance, never a confidence score. */
  match_score: number;
}

/** EP-20. An empty array is a successful answer that routes the seller to the wizard. */
export interface MatchResult {
  candidates: MatchCandidate[];
}

/** One question the wizard puts to the seller. `id` is what answers are keyed by. */
export interface WizardQuestion {
  id: string;
  /** The fact the question establishes, for example "brand" or "in_the_box". */
  attribute: string;
  text: string;
}

/** EP-23. The session outlives the browser tab, which is why it carries an expiry. */
export interface WizardSession {
  session_id: string;
  questions: WizardQuestion[];
  expires_at: string;
}

/** One attribute the seller defines, with its options in the order they typed them. */
export interface AttributeDefinition {
  name: string;
  options: string[];
}

/** A combination the seller carries, and what they charge for it. */
export interface CarriedVariant {
  attribute_values: Record<string, string>;
  price_minor: number;
  currency: string;
}

/** The EP-24 request body. */
export interface WizardSubmission {
  session_id: string;
  answers: Record<string, string>;
  name: string;
  description: string | null;
  category: string;
  attributes: AttributeDefinition[];
  carried_variants: CarriedVariant[];
}

/**
 * EP-24, section 11.7 of the contract.
 *
 * `variants_generated` is the full cross product and will usually exceed
 * `attachments_created`, which counts only what this seller carries. That gap is
 * expected and must never be rendered as a warning or an inconsistency.
 */
export interface WizardSubmitResult {
  product: { id: number; slug: string; current_version_number: number };
  variants_generated: number;
  attachments_created: number;
  store_is_live: boolean;
}

/** EP-48. No storage path and no moderation status: images publish immediately. */
export interface UploadedProductImage {
  id: number;
  url: string;
  mime_type: string;
  position: number;
  uploaded_by_user_id: number | null;
}

/** A file the seller chose, held in client state until the product exists. */
export interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
}
