/**
 * Moderation and the platform snapshot (EP-44, EP-45).
 *
 * Two administrator capabilities that share nothing but who may use them.
 */

import { apiFetch } from '@/lib/api/client';
import { parseResponse } from '@/lib/api/parse';
import { platformMetricsSchema, postDeletedSchema } from '@/lib/schemas/admin';
import type { PlatformMetrics, PostDeleted } from '@/types/admin';

/**
 * EP-44 Removes a post from the discussion.
 *
 * **Soft deleted, never destroyed**, and its replies go with it. From every read path
 * it simply stops existing: no tombstone, no placeholder, no "removed by an
 * administrator" line. That is section 11.10 and it is also what the existing thread
 * already does with an absent post, so nothing on the reading side needs changing.
 *
 * `replies_hidden` counts the replies that went with a top level post, and is zero
 * when the post removed is itself a reply.
 *
 * **There is no endpoint that restores a post and none is planned.** Soft deletion is
 * how the row survives for the platform's own records, not a step towards an undelete,
 * and no interface should imply otherwise.
 */
export async function deleteCommunityPost(id: number): Promise<PostDeleted> {
  const payload = await apiFetch<unknown>(`/api/admin/community/posts/${id}`, {
    method: 'DELETE',
  });

  return parseResponse(postDeletedSchema, payload, 'DELETE /api/admin/community/posts/{id}');
}

/**
 * EP-45 The platform at a glance.
 *
 * Counts rather than analytics: it answers "is anything wrong right now" rather than
 * "how are we doing", and there is no time series or previous period to compare
 * against.
 *
 * **This can be slow and that is expected.** It counts the whole view table, which has
 * no rollup aggregation and grows fastest in the system. The screen should say what it
 * is counting rather than look broken.
 *
 * **Nothing on it is per user.** The closest is a count of people who have verified
 * something, which is a number and not a list.
 */
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const payload = await apiFetch<unknown>('/api/admin/metrics');

  return parseResponse(platformMetricsSchema, payload, 'GET /api/admin/metrics');
}
