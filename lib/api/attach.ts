/**
 * The attachment flow (EP-20, EP-23, EP-24, EP-48) and job polling (EP-50).
 *
 * Every call here is authenticated and goes through this application's own proxy at
 * `/api/proxy`, which attaches the Bearer token server side.
 *
 * One rule runs through the whole module and is easy to get backwards: **an empty
 * candidate list from EP-20 is a success, not a failure**. It is the answer that sends
 * a seller to the wizard. Nothing here throws on it, and nothing that renders it may
 * style it as an error.
 */

import { apiFetch, ApiError, AiUnavailableError } from '@/lib/api/client';
import {
  matchResultSchema,
  uploadedProductImageSchema,
  wizardSessionSchema,
  wizardSubmitResultSchema,
} from '@/lib/schemas/attach';
import { jobSchema } from '@/lib/schemas/common';
import type {
  MatchResult,
  ProductDraft,
  UploadedProductImage,
  WizardSession,
  WizardSubmission,
  WizardSubmitResult,
} from '@/types/attach';
import type { QueuedJob } from '@/types/api';

/** Turns a schema mismatch into a message naming the field the two sides disagree on. */
function parse<T>(schema: { safeParse: (value: unknown) => { success: boolean } }, payload: unknown, endpoint: string): T {
  const result = schema.safeParse(payload) as
    | { success: true; data: T }
    | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } };

  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(
      `${endpoint} returned an unexpected shape at "${first?.path.join('.') || '(root)'}": ${first?.message}. ` +
        'The API and development-docs/shared/api-contract.md disagree.',
    );
  }

  return result.data;
}

/*
|--------------------------------------------------------------------------
| Image rules, checked before anything is sent
|--------------------------------------------------------------------------
| Mirrors the API, which refuses with `unsupported_media_type` and `file_too_large`.
| Checking here as well is not duplication for its own sake: it lets the seller find
| out immediately, rather than after uploading five megabytes over a slow connection.
| The API stays the real authority, and both codes are still handled when they come.
*/

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5_242_880;
export const MAX_IMAGES_PER_PRODUCT = 8;

/** Returns a readable reason, or null when the file is acceptable. */
export function describeImageProblem(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return 'Images must be JPEG, PNG, or WebP.';
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return 'Images must be 5 MB or smaller.';
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| EP-20 Matching
|--------------------------------------------------------------------------
*/

/**
 * Runs duplicate detection over what the seller typed.
 *
 * **An empty `candidates` array is the successful answer that means "not in the
 * catalogue".** It routes to the wizard. It is not an empty state, not a miss, and not
 * something to offer a retry for.
 *
 * Where candidates come back the seller must choose one. There is no request field and
 * no endpoint anywhere that lets them overrule the result and declare their product
 * new, so do not build a control implying otherwise.
 *
 * Throws `AiUnavailableError` carrying a queued job id when the provider is down. That
 * is the X-01 panel's cue, not an error to show.
 */
export async function matchProduct(draft: ProductDraft, image?: File | null): Promise<MatchResult> {
  // multipart, because matching operates on text and on an uploaded photograph.
  const body = new FormData();
  body.set('name', draft.name);
  if (draft.description) body.set('description', draft.description);
  if (draft.category) body.set('category', draft.category);

  if (image) {
    const problem = describeImageProblem(image);
    if (problem) throw new ApiError(422, 'unsupported_media_type', problem);
    body.set('image', image);
  }

  const payload = await apiFetch<unknown>('/api/attach/match', { method: 'POST', body });

  return parse<MatchResult>(matchResultSchema, payload, 'POST /api/attach/match');
}

/*
|--------------------------------------------------------------------------
| EP-23 and EP-24 The wizard
|--------------------------------------------------------------------------
*/

/**
 * Opens a wizard session.
 *
 * The backend re-runs matching before it will open one, so this returns **422
 * `match_required`** if the catalogue does turn out to hold the product. That is not a
 * client bug to route around: it means the seller belongs in the confirmation flow,
 * and the screen sends them back to matching to see the candidate.
 */
export async function startWizard(draft: ProductDraft): Promise<WizardSession> {
  const payload = await apiFetch<unknown>('/api/attach/wizard/start', {
    method: 'POST',
    body: {
      name: draft.name,
      description: draft.description ?? undefined,
      category: draft.category ?? undefined,
    },
  });

  return parse<WizardSession>(wizardSessionSchema, payload, 'POST /api/attach/wizard/start');
}

/**
 * Submits the wizard and creates the canonical record.
 *
 * Everything this writes is permanent. There is no product deletion path and no way to
 * remove a generated combination, so the screen must be sure before it calls this.
 *
 * `variants_generated` in the result will usually exceed `attachments_created`. That is
 * the cross product against what this seller carries, and it is expected.
 */
export async function submitWizard(submission: WizardSubmission): Promise<WizardSubmitResult> {
  const payload = await apiFetch<unknown>('/api/attach/wizard/submit', {
    method: 'POST',
    body: submission,
  });

  return parse<WizardSubmitResult>(
    wizardSubmitResultSchema,
    payload,
    'POST /api/attach/wizard/submit',
  );
}

/*
|--------------------------------------------------------------------------
| EP-48 Images
|--------------------------------------------------------------------------
*/

/**
 * Uploads one image to a product that already exists.
 *
 * Keyed by slug, which is why this cannot run until EP-24 has answered. Files are held
 * in client state through the wizard and uploaded here afterwards.
 *
 * A failure here never undoes the product. The record is created and correct; an image
 * simply did not attach, and the seller is offered a retry.
 */
export async function uploadProductImage(
  slug: string,
  file: File,
  position?: number,
): Promise<UploadedProductImage> {
  const body = new FormData();
  body.set('image', file);
  if (position !== undefined) body.set('position', String(position));

  const payload = await apiFetch<unknown>(`/api/products/${encodeURIComponent(slug)}/images`, {
    method: 'POST',
    body,
  });

  return parse<UploadedProductImage>(
    uploadedProductImageSchema,
    payload,
    'POST /api/products/{slug}/images',
  );
}

/*
|--------------------------------------------------------------------------
| EP-50 Job polling
|--------------------------------------------------------------------------
*/

/**
 * The status of a queued AI job.
 *
 * `result_type` and `result` are null until the job completes, a failed job included.
 * A job belonging to somebody else answers 404, which the panel treats as a stale
 * stored id rather than as a problem worth reporting.
 */
export async function getJob(id: string): Promise<QueuedJob> {
  const payload = await apiFetch<unknown>(`/api/jobs/${encodeURIComponent(id)}`);

  return parse<QueuedJob>(jobSchema, payload, 'GET /api/jobs/{id}');
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/** The catalogue holds this product after all, so the wizard is the wrong place. */
export function isMatchRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'match_required';
}

export function isStoreRequired(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'store_required';
}

/** The provider is down, the work is queued, and the submission is not lost. */
export function isAiUnavailable(error: unknown): error is AiUnavailableError {
  return error instanceof AiUnavailableError;
}

/** The three image refusals, each of which the seller can act on differently. */
export function isImageRefusal(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    ['unsupported_media_type', 'file_too_large', 'image_limit_reached'].includes(error.code)
  );
}
