/**
 * Response schemas.
 *
 * With no mock standing between the screens and the API, these are what turn a
 * contract mismatch into a readable error naming the field, rather than
 * `undefined is not an object` three components later.
 *
 * Mirrors development-docs/shared/api-contract.md. Add a schema as each milestone's
 * endpoints land, not all at once.
 */

import { z } from 'zod';

export const paginationLinksSchema = z.object({
  first: z.string().nullable(),
  last: z.string().nullable(),
  prev: z.string().nullable(),
  next: z.string().nullable(),
});

export const paginationMetaSchema = z.object({
  current_page: z.number().int(),
  from: z.number().int().nullable(),
  last_page: z.number().int(),
  path: z.string(),
  per_page: z.number().int(),
  to: z.number().int().nullable(),
  total: z.number().int(),
});

/** Wraps any item schema in the length aware paginator shape. */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  });
}

/** Community posts paginate by cursor rather than page number. */
export function cursorPaginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({ next_cursor: z.string().nullable() }),
  });
}

/**
 * Money is always an integer in the smallest currency unit.
 *
 * A float arriving here means the backend emitted a decimal price, which the contract
 * forbids, and this is where that gets caught rather than after a rounding bug.
 */
export const priceMinorSchema = z.number().int();

/**
 * The store carried on the session.
 *
 * Deliberately minimal, and the backend keeps it that way: every authenticated page
 * makes this call. Its **presence** is the entire definition of the seller role, so
 * the navigation derives seller entries from whether this is null, not from a flag.
 *
 * The settings form uses EP-54, which returns the full record.
 */
export const sessionStoreSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  is_live: z.boolean(),
});

export const sessionUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  email_verified_at: z.string().nullable(),
  is_admin: z.boolean(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  store: sessionStoreSchema.nullable(),
});

export const jobSchema = z.object({
  id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  result_type: z
    .enum(['match_candidates', 'wizard_questions', 'confirmation_questions', 'verification_result'])
    .nullable(),
  result: z.unknown(),
});

/**
 * Guards the three fields that must never cross the wire.
 *
 * A single careless resource class on the backend breaks that guarantee, and it is
 * not the kind of thing a screen review catches. Run this over any payload where a
 * regression would be expensive.
 */
export function assertNoForbiddenFields(payload: unknown, context: string): void {
  const forbidden = ['confidence_score', 'confidence_band', 'created_by_store_id', 'photo_path'];
  const seen = JSON.stringify(payload);

  for (const field of forbidden) {
    if (seen.includes(`"${field}"`)) {
      throw new Error(
        `The API returned the forbidden field "${field}" from ${context}. ` +
          'See section 6 of the API contract.',
      );
    }
  }
}
