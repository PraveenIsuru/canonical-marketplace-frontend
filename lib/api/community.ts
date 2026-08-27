/**
 * The discussion and ownership verification (EP-31 to EP-35, EP-57).
 *
 * Two halves with different access levels, deliberately kept together because they are
 * one idea: the discussion is worth reading precisely because posting requires proving
 * you own the thing.
 *
 * **Reading is public and fetched server side**, like the rest of the catalogue, so a
 * product's discussion is prerendered and indexable. **Writing and verifying are
 * authenticated** and go through this application's proxy at `/api/proxy`.
 *
 * Every call runs `assertNoPhotograph` over the raw payload. Nothing here returns a
 * photograph, a path, or a URL, and that check is what catches it if the API ever
 * starts.
 */

import { apiFetch, apiFetchServer, ApiError } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { cursorPaginated } from '@/lib/schemas/common';
import {
  assertNoPhotograph,
  communityPostSchema,
  verificationResultSchema,
  verificationStartSchema,
  verificationStateSchema,
} from '@/lib/schemas/community';
import type {
  CommunityPost,
  CreatePost,
  VerificationResult,
  VerificationStart,
  VerificationState,
} from '@/types/community';
import type { CursorPaginated } from '@/types/api';

export type PaginatedPosts = CursorPaginated<CommunityPost>;

/*
|--------------------------------------------------------------------------
| EP-31, EP-57 Reading, public
|--------------------------------------------------------------------------
*/

/**
 * A product's top level posts, newest first (EP-31).
 *
 * Fetched server side and with no token, because a discussion of verified owners is
 * exactly the content worth having in a search index, and a public catalogue route
 * must not resolve a session.
 *
 * **Cursor paginated**, not page numbered. A discussion gains rows at the top while
 * somebody is reading it, and page two of a numbered paginator would show them a row
 * they had already seen.
 */
export async function getPosts(slug: string, cursor?: string): Promise<PaginatedPosts> {
  const payload = await apiFetchServer<unknown>(
    `/api/products/${encodeURIComponent(slug)}/community/posts`,
    { query: { cursor }, next: { revalidate: 30 } },
  );

  assertNoPhotograph(payload, 'GET /api/products/{slug}/community/posts');

  return parseResponse(
    cursorPaginated(communityPostSchema),
    payload,
    'GET /api/products/{slug}/community/posts',
  );
}

/**
 * Replies to one post, oldest first (EP-57).
 *
 * Fetched from the browser rather than the server: replies load when a reader opens a
 * thread, which is an interaction rather than part of the initial paint. Public, so it
 * carries no token and the extra hop changes nothing about the answer.
 *
 * A soft deleted parent answers 404 and its replies are gone with it. There is no
 * tombstone to render, by design.
 */
export async function getReplies(
  slug: string,
  postId: number,
  cursor?: string,
): Promise<PaginatedPosts> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/community/posts/${postId}/replies`,
    { query: { cursor } },
  );

  assertNoPhotograph(payload, 'GET /api/products/{slug}/community/posts/{id}/replies');

  return parseResponse(
    cursorPaginated(communityPostSchema),
    payload,
    'GET /api/products/{slug}/community/posts/{id}/replies',
  );
}

/*
|--------------------------------------------------------------------------
| EP-32 Writing
|--------------------------------------------------------------------------
*/

/**
 * Writes a post or a reply.
 *
 * Refused with **403 `not_verified`** unless the caller has verified **this** product.
 * That is checked server side every time, so a screen that believed otherwise gets
 * corrected here rather than silently posting.
 */
export async function createPost(slug: string, post: CreatePost): Promise<CommunityPost> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/community/posts`,
    { method: 'POST', body: post },
  );

  assertNoPhotograph(payload, 'POST /api/products/{slug}/community/posts');

  return parseResponse(communityPostSchema, payload, 'POST /api/products/{slug}/community/posts');
}

/*
|--------------------------------------------------------------------------
| EP-33, EP-34, EP-35 Verifying
|--------------------------------------------------------------------------
*/

/**
 * The state every composer decision comes from (EP-33).
 *
 * The single source. Nothing about whether somebody may post is inferred from the post
 * list, from a previous response, or from anything held in the browser.
 */
export async function getVerification(slug: string): Promise<VerificationState> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/verification`,
  );

  assertNoPhotograph(payload, 'GET /api/products/{slug}/verification');

  return parseResponse(verificationStateSchema, payload, 'GET /api/products/{slug}/verification');
}

/**
 * Issues the code the buyer writes down and photographs (EP-34).
 *
 * **Starting spends no attempt**, and starting again returns the same code rather than
 * a new one, so a reload does not invalidate what somebody has already written on
 * paper. Refused with 403 once verified or once five attempts are used.
 */
export async function startVerification(slug: string): Promise<VerificationStart> {
  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/verification/start`,
    { method: 'POST' },
  );

  assertNoPhotograph(payload, 'POST /api/products/{slug}/verification/start');

  return parseResponse(
    verificationStartSchema,
    payload,
    'POST /api/products/{slug}/verification/start',
  );
}

/**
 * Submits the photograph (EP-35).
 *
 * Multipart, because it carries a file. **A failure comes back as 200 with
 * `outcome: "failed"`**, not as an error: the request succeeded and the answer was no.
 * Nothing here throws on that, and nothing that renders it may style it as a fault.
 *
 * The photograph is destroyed server side the moment the answer is decided. There is
 * nothing to show back and no path to hold.
 *
 * Throws `AiUnavailableError` with a queued job id when the provider is down, which is
 * the X-01 panel's cue.
 */
export async function submitVerification(slug: string, photo: File): Promise<VerificationResult> {
  const form = new FormData();
  form.append('photo', photo);

  const payload = await apiFetch<unknown>(
    `/api/products/${encodeURIComponent(slug)}/verification/submit`,
    { method: 'POST', body: form },
  );

  assertNoPhotograph(payload, 'POST /api/products/{slug}/verification/submit');

  return parseResponse(
    verificationResultSchema,
    payload,
    'POST /api/products/{slug}/verification/submit',
  );
}

/*
|--------------------------------------------------------------------------
| Error helpers
|--------------------------------------------------------------------------
*/

/**
 * The caller has not verified this product.
 *
 * Reachable even when the screen believed otherwise, because `can_attempt` and
 * `is_verified` are rendering hints and the endpoint decides.
 */
export function isNotVerified(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'not_verified';
}

/** Five attempts used on this product. Final: there is no appeal and no reset. */
export function isAttemptsExhausted(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'attempts_exhausted';
}

/** The photograph was not JPEG, PNG, or WebP. */
export function isUnsupportedMedia(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'unsupported_media_type';
}

/** The photograph was over 5 MB. */
export function isFileTooLarge(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'file_too_large';
}
