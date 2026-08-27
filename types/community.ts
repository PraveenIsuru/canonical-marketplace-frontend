/**
 * Community discussion and ownership verification (EP-31 to EP-35, EP-57).
 *
 * Mirrors section 11.10 of the contract at version 6.
 *
 * **No shape here carries a photograph path, a URL, or the file.** The photograph is
 * deleted the moment verification concludes, on a pass and on a failure alike, and by
 * the time a response reaches this application there is nothing left to point at. A
 * field declared here would be a field somebody eventually tries to render.
 *
 * This file replaced an M0 placeholder written before any of these endpoints existed.
 * It guessed at `author.id`, an `active_attempt` object, and a `WishlistEntry` that M8
 * later defined properly in `types/wishlist.ts`. None of those shapes are real.
 */

/**
 * One post, or one reply (EP-31, EP-57).
 *
 * The author is a **display name and nothing else**: no id, no email, and no store. A
 * user who runs a store posts here as a verified buyer like anyone else, and naming
 * their store would turn a discussion into advertising.
 *
 * There is no `is_verified` flag either, because an unverified author cannot post at
 * all. A field whose value is always true is one that will eventually be false by
 * accident.
 */
export interface CommunityPost {
  id: number;
  body: string;
  author: { name: string };
  /** Always 0 on a reply. Threads are one level deep and nothing nests further. */
  reply_count: number;
  created_at: string;
}

/** What EP-32 accepts. `parent_id` is omitted for a top level post. */
export interface CreatePost {
  body: string;
  parent_id?: number;
}

/** How a concluded attempt went. `pending` means started but not yet submitted. */
export type VerificationOutcome = 'passed' | 'failed' | 'pending';

/**
 * EP-33, and the **only** thing the composer branches on.
 *
 * Between them these answer every state the interface has to tell apart, so nothing is
 * inferred from the post list or from the shape of some other response.
 */
export interface VerificationState {
  is_verified: boolean;
  /** Concluded attempts only. Starting one costs nothing. */
  attempts_used: number;
  attempts_remaining: number;
  /**
   * A rendering hint, not a permission.
   *
   * False once verified or once the ceiling of five is reached. EP-34 and EP-35
   * re-check and refuse regardless of what the client believed, so this decides what
   * to draw and never whether something is allowed.
   */
  can_attempt: boolean;
  latest_outcome: VerificationOutcome | null;
  /**
   * The code from an attempt already started and not yet submitted.
   *
   * Surfaced so a buyer who closed the page sees the code they already wrote down,
   * rather than assuming they have to start over.
   */
  pending_code: string | null;
  /** An outstanding queued judgement, for the X-01 panel to resume from. */
  pending_job_id: string | null;
}

/** EP-34. Starting issues a code and spends no attempt. */
export interface VerificationStart {
  code: string;
  attempts_remaining: number;
  /** Null today: no timer expires a code, and nothing in the interface implies one. */
  expires_at: string | null;
}

/**
 * EP-35.
 *
 * A failure arrives as **200 with `outcome: "failed"`**, not as an error. The request
 * succeeded and the answer was no, and a buyer who photographed the wrong thing has
 * not made a bad request.
 *
 * `reason` survives the photograph deliberately, so somebody deciding whether to spend
 * another of their five attempts can be told what was wrong.
 */
export interface VerificationResult {
  outcome: 'passed' | 'failed';
  reason: string | null;
  attempts_remaining: number;
}
