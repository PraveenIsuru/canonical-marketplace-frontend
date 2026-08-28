/**
 * The administrator catalogue (EP-60, EP-61, EP-43, EP-49).
 *
 * **Keyed by id, unlike every public product route, which is keyed by slug.** A slug is
 * a public address derived from a name and could be wrong about the record; an
 * administrator correcting that name should operate on the row rather than on a string
 * derived from the thing they are about to change. EP-49 is the one exception and
 * stays on the slug path, because it sits beside EP-48 which added the image.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { assertNoForbiddenFields, paginated } from '@/lib/schemas/common';
import {
  adminProductDetailSchema,
  adminProductSummarySchema,
  imageDeletedSchema,
} from '@/lib/schemas/admin';
import type { AdminProductDetail, AdminProductEdit, AdminProductSummary, ImageDeleted } from '@/types/admin';
import type { Paginated } from '@/types/api';

export type PaginatedAdminProducts = Paginated<AdminProductSummary>;

export interface ProductSearch {
  q?: string;
  category?: string;
  page?: number;
}

/**
 * EP-60 Every product, newest first.
 *
 * The purpose of this list is reaching the edit screen without typing an id, so the
 * search is a plain name match rather than the buyer's relevance ranked catalogue
 * search. An administrator is finding one known record, not discovering something.
 */
export async function getAdminProducts(search: ProductSearch = {}): Promise<PaginatedAdminProducts> {
  const payload = await apiFetch<unknown>('/api/admin/products', {
    query: { q: search.q, category: search.category, page: search.page },
  });

  assertNoForbiddenFields(payload, 'GET /api/admin/products');

  return parseResponse(paginated(adminProductSummarySchema), payload, 'GET /api/admin/products');
}

/**
 * EP-61 One product in full.
 *
 * **Every generated combination is returned, including ones no seller carries.** Render
 * all of them. Hiding an empty combination would be the first place somebody got the
 * idea one can be removed, and invariant 2 says none ever is.
 */
export async function getAdminProduct(id: number): Promise<AdminProductDetail> {
  const payload = await apiFetch<unknown>(`/api/admin/products/${id}`);

  assertNoForbiddenFields(payload, 'GET /api/admin/products/{id}');

  return parseResponse(adminProductDetailSchema, payload, 'GET /api/admin/products/{id}');
}

/**
 * EP-43 Edits a record directly.
 *
 * The one path into product data that is not a proposal. It writes an **administrator
 * originated version**, and the acting administrator is recorded server side and named
 * to nobody.
 *
 * Three rules the caller has to respect, because the endpoint enforces all three:
 *
 *  - **`specifications` replaces the map wholesale.** A key left out is removed. Send
 *    the complete map, not a patch of it.
 *  - **`attributes` is additive and merges by name.** An option list is widened, never
 *    narrowed, and sending a shorter list removes nothing.
 *  - **Naming an attribute the record does not define is refused** with
 *    `validation_failed`. Adding a dimension would leave every existing combination
 *    with no value for it, permanently. There is no client side control for it.
 *
 * A pending proposal on the same product neither blocks this nor is disturbed by it.
 */
export async function editAdminProduct(
  id: number,
  changes: AdminProductEdit,
): Promise<AdminProductDetail> {
  const payload = await apiFetch<unknown>(`/api/admin/products/${id}`, {
    method: 'PATCH',
    body: changes,
  });

  assertNoForbiddenFields(payload, 'PATCH /api/admin/products/{id}');

  return parseResponse(adminProductDetailSchema, payload, 'PATCH /api/admin/products/{id}');
}

/**
 * EP-49 Removes an image from a record.
 *
 * The only deletion path for an image, and administrator only: a seller may add one
 * through EP-48 and may never remove one, because an uploader who could remove an
 * image could remove one a later seller relies on.
 *
 * Unlike a community post this is a real deletion, row and file. There is nothing to
 * restore afterwards.
 *
 * Keyed by product **slug**, not id, because it sits on the public product path beside
 * the upload.
 */
export async function deleteProductImage(slug: string, imageId: number): Promise<ImageDeleted> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/images/${imageId}`,
    { method: 'DELETE' },
  );

  return parseResponse(imageDeletedSchema, payload, 'DELETE /api/products/{slug}/images/{id}');
}

/**
 * Field level errors from EP-43.
 *
 * The one worth handling by name is `attributes`, which is how the endpoint refuses a
 * new attribute on a record that already has combinations.
 */
export function editFieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fieldError(field) : undefined;
}
