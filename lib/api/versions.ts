/**
 * The version chain (EP-46, EP-47).
 *
 * A product's history is a working document for the sellers responsible for that
 * record, and for administrators. Both calls are authenticated and go through this
 * application's proxy, which attaches the Bearer token server side.
 *
 * **Access is decided per request by the API**, never here. A seller who detaches
 * loses the history on their very next call, so these helpers surface the refusal
 * rather than trying to predict it. `canViewVersionHistory` in `lib/auth/guards.ts`
 * is a rendering hint and nothing more.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { assertNoForbiddenFields, paginated } from '@/lib/schemas/common';
import {
  assertNoVersionLeak,
  productVersionSchema,
  productVersionSnapshotSchema,
} from '@/lib/schemas/version';
import type { ProductVersion, ProductVersionSnapshot } from '@/types/product';
import type { Paginated } from '@/types/api';

export type PaginatedVersions = Paginated<ProductVersion>;

/*
|--------------------------------------------------------------------------
| EP-46 The chain
|--------------------------------------------------------------------------
*/

/**
 * A product's versions, newest first.
 *
 * **A rejected proposal is absent entirely**, and not because it is filtered out here:
 * a version row exists for an accepted proposal and an administrator edit and for
 * nothing else, so a rejected one was never written. Do not add a control that offers
 * to show them.
 */
export async function getVersions(slug: string, page = 1): Promise<PaginatedVersions> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/versions`,
    { query: { page } },
  );

  assertNoForbiddenFields(payload, 'GET /api/products/{slug}/versions');
  assertNoVersionLeak(payload, 'GET /api/products/{slug}/versions');

  return parseResponse(
    paginated(productVersionSchema),
    payload,
    'GET /api/products/{slug}/versions',
  );
}

/*
|--------------------------------------------------------------------------
| EP-47 One version
|--------------------------------------------------------------------------
*/

/**
 * One version with the whole record state as it stood.
 *
 * A snapshot rather than a diff. **There is no rollback control** on any screen that
 * reads this, and none is planned: an administrator wanting an old value back edits
 * forward, which writes a further version and leaves the record of how it got there
 * intact.
 */
export async function getVersion(slug: string, versionNumber: number): Promise<ProductVersionSnapshot> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/versions/${versionNumber}`,
  );

  assertNoForbiddenFields(payload, 'GET /api/products/{slug}/versions/{number}');
  assertNoVersionLeak(payload, 'GET /api/products/{slug}/versions/{number}');

  return parseResponse(
    productVersionSnapshotSchema,
    payload,
    'GET /api/products/{slug}/versions/{number}',
  );
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/**
 * The caller holds a store but does not carry this product.
 *
 * The refusal a seller meets the moment they detach, and the one this milestone's
 * blocked state exists for. Holding the seller role is not the qualification;
 * carrying *this* product is.
 */
export function isNotAttached(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'not_attached';
}

/** The caller holds no store at all, which is a different problem with a different fix. */
export function isStoreRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'store_required';
}

/** No such product, or no such version number on it. */
export function isVersionNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
