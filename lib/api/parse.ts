import type { ZodType } from 'zod';

/**
 * Validates a payload at the fetch boundary.
 *
 * With no mock standing between these screens and the API, this is what turns a
 * contract mismatch into a message naming the field the two sides disagree on, rather
 * than `undefined is not an object` three components later.
 *
 * The error names the endpoint as well as the field, because "the API and the contract
 * disagree" is only actionable if you know which call produced it.
 */
export function parseResponse<T>(schema: ZodType<T>, payload: unknown, endpoint: string): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const first = result.error.issues[0];

    throw new Error(
      `${endpoint} returned an unexpected shape at "${first?.path.join('.') || '(root)'}": ${first?.message}. ` +
        'The API and development-docs/shared/api-contract.md disagree.',
    );
  }

  return result.data;
}
