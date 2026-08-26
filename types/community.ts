/**
 * Community discussion, ownership verification, and the wishlist.
 *
 * Note what is absent: no verification payload anywhere carries a photograph path
 * or URL. Photographs are deleted once verification concludes, whether it passed or
 * failed, and no screen ever displays one.
 */

export interface CommunityPost {
  id: number;
  body: string;
  author: { id: number; name: string };
  created_at: string;
  reply_count: number;
}

export interface CommunityReply {
  id: number;
  body: string;
  author: { id: number; name: string };
  created_at: string;
}

/** Drives the four composer states on the community screen. */
export interface VerificationState {
  is_verified: boolean;
  attempts_used: number;
  attempts_remaining: number;
  /** Present only while an attempt is open and awaiting a photograph. */
  active_attempt: { attempt_id: string; code: string } | null;
}

export interface VerificationStarted {
  attempt_id: string;
  code: string;
  attempts_remaining: number;
}

export interface VerificationResult {
  passed: boolean;
  /** The AI's stated reason, shown on failure. The AI decides alone; there is no appeal. */
  ai_reasoning: string;
  attempts_remaining: number;
}

export interface WishlistEntry {
  id: number;
  product: { id: number; slug: string; name: string };
  variant_id: number;
  attribute_values: Record<string, string>;
  lowest_price_minor: number | null;
  currency: string | null;
  seller_count: number;
}
