/**
 * Schemas for the version chain (EP-46, EP-47).
 *
 * Mirrors section 11.11 of the contract.
 *
 * Two fields are absent on purpose and their absence is asserted rather than assumed,
 * by `assertNoVersionLeak` below: no administrator is ever named, and there is no
 * proposal id. Zod ignores keys it was not told about, so without that check a
 * backend regression that started emitting either would validate silently.
 */

import { z } from 'zod';

/** The store whose accepted proposal produced a version. Null on an administrator edit. */
export const causingStoreSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const productVersionSchema = z.object({
  version_number: z.number().int(),
  created_at: z.string(),
  is_admin_originated: z.boolean(),
  caused_by_store: causingStoreSchema.nullable(),
  /** Empty on version 1, which created the record rather than changing it. */
  changed_fields: z.array(z.string()),
});

/**
 * The record state at one version.
 *
 * `specifications` is an object of unknown values because a specification map is free
 * form: the backend stores whatever the wizard captured, and the screen renders it as
 * text without caring what the values are.
 */
export const versionSnapshotFieldsSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  specifications: z.record(z.string(), z.unknown()),
  attributes: z.array(
    z.object({
      name: z.string(),
      options: z.array(z.string()),
      position: z.number().int(),
    }),
  ),
  variants: z.array(
    z.object({
      attribute_values: z.record(z.string(), z.string()),
      combination_hash: z.string(),
      is_default: z.boolean(),
    }),
  ),
});

export const productVersionSnapshotSchema = productVersionSchema.extend({
  snapshot: versionSnapshotFieldsSchema,
});

/**
 * Guards the fields a version response must not carry.
 *
 * `caused_by_user` and `proposal_id` are not forbidden by section 6 the way a
 * confidence score is, but both were left out of the contract deliberately and
 * rendering either would be wrong: one names a moderator to the sellers they moderate,
 * the other links somewhere most readers get a 404.
 */
export function assertNoVersionLeak(payload: unknown, context: string): void {
  const absent = ['caused_by_user', 'causing_admin', 'proposal_id'];
  const seen = JSON.stringify(payload);

  for (const field of absent) {
    if (seen.includes(`"${field}"`)) {
      throw new Error(
        `${context} returned "${field}", which section 11.11 leaves out of the version shapes. ` +
          'The API and development-docs/shared/api-contract.md disagree.',
      );
    }
  }
}

export type ProductVersion = z.infer<typeof productVersionSchema>;
export type ProductVersionSnapshot = z.infer<typeof productVersionSnapshotSchema>;
