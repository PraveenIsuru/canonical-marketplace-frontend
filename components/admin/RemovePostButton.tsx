'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCommunityPost } from '@/lib/api/admin-moderation';
import { queryKeys } from '@/lib/query/keys';
import { Button, Dialog } from '@/components/ui';

/**
 * The administrator remove on a community post (EP-44).
 *
 * Rendered only for an administrator, and that gate is a **rendering hint**: the API
 * refuses this for anybody else regardless of what the client believed. Its job is to
 * avoid showing a control that would only fail when pressed.
 *
 * **A removed post simply disappears**, along with its replies. No tombstone, no
 * "removed by an administrator" line, no placeholder, which is section 11.10 and also
 * what the thread already does with an absent post. Nothing on the reading side needed
 * changing to support this.
 *
 * **No administrator is named anywhere it lands.** The post is gone; who removed it is
 * not part of what a reader sees, and the platform does not publish a moderation
 * history.
 *
 * **There is no restore.** Soft deletion is how the row survives for the platform's own
 * records, not a step towards an undelete, and the confirmation says so rather than
 * implying a way back.
 */
export function RemovePostButton({
  postId,
  slug,
  isReply,
  replyCount,
}: {
  postId: number;
  slug: string;
  isReply: boolean;
  replyCount: number;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteCommunityPost(postId),
    onSuccess: () => {
      setConfirming(false);
      // The thread and any open reply list. The post is simply absent from both now.
      void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts(slug) });
      void queryClient.invalidateQueries({ queryKey: ['community', slug] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.metrics() });
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-red-700 underline dark:text-red-400"
      >
        {remove.isError ? 'Remove failed, try again' : 'Remove'}
      </button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={isReply ? 'Remove this reply?' : 'Remove this post?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              Remove
            </Button>
          </>
        }
      >
        <p>
          It disappears from the discussion straight away, with no note left in its
          place.
        </p>

        {!isReply && replyCount > 0 && (
          <p className="mt-2">
            Its {replyCount} {replyCount === 1 ? 'reply goes' : 'replies go'} with it. A
            thread does not survive its subject.
          </p>
        )}

        <p className="mt-2">
          <strong className="font-medium">There is no way to put it back.</strong> No
          screen anywhere restores a removed post.
        </p>
      </Dialog>
    </>
  );
}
