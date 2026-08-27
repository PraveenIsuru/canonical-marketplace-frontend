/**
 * Schemas for the discussion and for verification (EP-31 to EP-35, EP-57).
 *
 * Mirrors development-docs/shared/api-contract.md at **version 6**, section 11.10.
 */

import { z } from 'zod';

/** EP-31 and EP-57 item. A display name only, and no verified flag: see the type. */
export const communityPostSchema = z.object({
  id: z.number().int(),
  body: z.string(),
  author: z.object({ name: z.string() }),
  reply_count: z.number().int(),
  created_at: z.string(),
});

export const verificationOutcomeSchema = z.enum(['passed', 'failed', 'pending']);

/** EP-33. Every field the composer branches on, and nothing it has to infer. */
export const verificationStateSchema = z.object({
  is_verified: z.boolean(),
  attempts_used: z.number().int(),
  attempts_remaining: z.number().int(),
  can_attempt: z.boolean(),
  latest_outcome: verificationOutcomeSchema.nullable(),
  pending_code: z.string().nullable(),
  pending_job_id: z.string().nullable(),
});

/** EP-34. */
export const verificationStartSchema = z.object({
  code: z.string(),
  attempts_remaining: z.number().int(),
  expires_at: z.string().nullable(),
});

/**
 * EP-35.
 *
 * `outcome` is a two value enum rather than a boolean, matching the contract, so a
 * third outcome added later fails here instead of being read as a failure.
 */
export const verificationResultSchema = z.object({
  outcome: z.enum(['passed', 'failed']),
  reason: z.string().nullable(),
  attempts_remaining: z.number().int(),
});

/**
 * The guarantee this milestone turns on.
 *
 * Zod ignores keys it was not told about, so a backend regression that started sending
 * a photograph path would validate silently and sit in memory waiting for somebody to
 * render it. This reads the raw payload as text and refuses it.
 *
 * `attempts/` and `verification-photos` are the private disk's own shapes, and the
 * file extensions catch a path under any other name. Section 6 of the contract lists
 * photograph paths alongside the confidence score, and this is the boundary that keeps
 * that true from this side.
 */
export function assertNoPhotograph(payload: unknown, endpoint: string): void {
  const forbidden = [
    'photo_path',
    'photo_url',
    'photograph',
    'attempts/',
    'verification-photos',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
  ];

  const seen = JSON.stringify(payload) ?? '';

  for (const fragment of forbidden) {
    if (seen.includes(fragment)) {
      throw new Error(
        `${endpoint} returned "${fragment}", which looks like a verification photograph. ` +
          'Photographs are deleted once verification concludes and must never reach a client. ' +
          'See section 6 of development-docs/shared/api-contract.md.',
      );
    }
  }
}

export type CommunityPostShape = z.infer<typeof communityPostSchema>;
export type VerificationStateShape = z.infer<typeof verificationStateSchema>;
export type VerificationResultShape = z.infer<typeof verificationResultSchema>;
