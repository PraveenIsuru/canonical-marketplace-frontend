/**
 * Shapes shared by every endpoint.
 *
 * Mirrors sections 1, 2, 5, 7 and 8 of development-docs/shared/api-contract.md.
 * The backend owns that contract. Do not add a shape here that is not defined there.
 */

/** Laravel's length aware paginator. Almost every list endpoint returns this. */
export interface PaginationLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

export interface PaginationMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  path: string;
  per_page: number;
  to: number | null;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

/** Community posts paginate by cursor rather than page number. */
export interface CursorPaginated<T> {
  data: T[];
  meta: { next_cursor: string | null };
}

/**
 * Every error code the API can return, from section 7 of the contract.
 *
 * Clients branch on the code, never on the message. Messages may be reworded
 * freely; codes may not.
 */
export type ApiErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'store_required'
  | 'store_exists'
  | 'proposal_pending'
  | 'already_attached'
  | 'confirmation_incomplete'
  | 'match_required'
  | 'already_voted'
  | 'review_closed'
  | 'not_eligible_to_vote'
  | 'not_attached'
  | 'not_verified'
  | 'attempts_exhausted'
  | 'unsupported_media_type'
  | 'file_too_large'
  | 'image_limit_reached'
  | 'ai_unavailable'
  | 'rate_limited';

/** The three field error envelope. `errors` appears only on validation failures. */
export interface ApiErrorBody {
  code: string;
  message: string;
  errors?: Record<string, string[]>;
  /** Present only alongside `ai_unavailable`, at the top level rather than inside data. */
  queued_job_id?: string;
}

/** Money always crosses the boundary as an integer in the smallest currency unit. */
export interface Money {
  price_minor: number;
  currency: string;
}

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Added to the union by contract version 2. Seller catalogue search has queued jobs
 * of type `search_interpretation` since M3; the original list simply omitted it.
 */
export type JobResultType =
  | 'match_candidates'
  | 'wizard_questions'
  | 'confirmation_questions'
  /** Contract version 3. A queued confirmation submit, resumed by its outcome. */
  | 'confirmation_outcome'
  | 'verification_result'
  | 'search_interpretation'
  | null;

/** Polled by the X-01 queued job panel to recover a flow blocked by AI unavailability. */
export interface QueuedJob {
  id: string;
  status: JobStatus;
  result_type: JobResultType;
  result: unknown;
}

/** Buyer coordinates. Never sent as a formatted string. */
export interface Coordinates {
  lat: number;
  lng: number;
}
