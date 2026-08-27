'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReplies } from '@/lib/api/community';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { formatRelative } from '@/lib/format/dates';
import { PostComposer } from './PostComposer';
import { Card, Skeleton } from '@/components/ui';
import type { CommunityPost } from '@/types/community';

interface Props {
  slug: string;
  productName: string;
  post: CommunityPost;
}

/**
 * One post and, on request, its replies.
 *
 * Replies load when a reader opens the thread rather than with the page. A product
 * with a long discussion would otherwise pay for every reply on every visit, and most
 * readers open none of them.
 *
 * **A soft deleted post is simply absent**, and so are its replies. There is no
 * tombstone, no "removed by an administrator" line, and no placeholder. Inventing one
 * would advertise a moderation feature that does not exist yet and would leave a
 * conversation stub with its subject missing.
 */
export function PostThread({ slug, productName, post }: Props) {
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [replying, setReplying] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: queryKeys.community.replies(slug, post.id),
    queryFn: () => getReplies(slug, post.id),
    staleTime: staleTimes.communityPosts,
    enabled: open,
  });

  function refreshReplies() {
    setReplying(false);
    setOpen(true);
    void queryClient.invalidateQueries({ queryKey: queryKeys.community.replies(slug, post.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts(slug) });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* A display name and nothing else. No store, ever: a seller posts here as a
              verified buyer, and naming their shop would make this advertising. */}
          <span className="font-medium">{post.author.name}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatRelative(post.created_at)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm">{post.body}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        {post.reply_count > 0 && (
          <button type="button" onClick={() => setOpen((was) => !was)} className="underline">
            {open
              ? 'Hide replies'
              : `Show ${post.reply_count} ${post.reply_count === 1 ? 'reply' : 'replies'}`}
          </button>
        )}

        <button type="button" onClick={() => setReplying((was) => !was)} className="underline">
          {replying ? 'Cancel' : 'Reply'}
        </button>
      </div>

      {replying && (
        <PostComposer
          slug={slug}
          productName={productName}
          parentId={post.id}
          onPosted={refreshReplies}
        />
      )}

      {open && (
        <div className="flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
          {isPending && <Skeleton className="h-16 w-full" />}

          {data?.data.map((reply) => (
            <div key={reply.id}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-medium">{reply.author.name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRelative(reply.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{reply.body}</p>
            </div>
          ))}

          {data?.data.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              These replies are no longer here.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
