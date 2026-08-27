'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosts } from '@/lib/api/community';
import { queryKeys, staleTimes } from '@/lib/query/keys';
import { PostComposer } from '@/components/community/PostComposer';
import { PostThread } from '@/components/community/PostThread';
import { EmptyState, Skeleton } from '@/components/ui';
import type { PaginatedPosts } from '@/lib/api/community';

interface Props {
  slug: string;
  productName: string;
  /** Rendered on the server for the initial paint, so the page is indexable. */
  initial: PaginatedPosts;
}

/**
 * The interactive half of S-06.
 *
 * The first page of posts arrives already rendered from the server, so a reader with
 * no JavaScript, and a crawler, still get the discussion. This takes over for
 * composing, opening reply threads, and loading further pages.
 *
 * `getPosts` is a server side helper, so paging further is done through the same query
 * the server primed rather than a second code path.
 */
export function CommunityThread({ slug, productName, initial }: Props) {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: [...queryKeys.community.posts(slug), cursor],
    queryFn: () => getPosts(slug, cursor ?? undefined),
    staleTime: staleTimes.communityPosts,
    // The server already fetched the first page. Refetching it on mount would throw
    // away work and flash the list.
    initialData: cursor === null ? initial : undefined,
  });

  const posts = data?.data ?? initial.data;
  const nextCursor = data?.meta.next_cursor ?? initial.meta.next_cursor;

  function refresh() {
    setCursor(null);
    void queryClient.invalidateQueries({ queryKey: queryKeys.community.posts(slug) });
  }

  return (
    <div className="flex flex-col gap-6">
      <PostComposer slug={slug} productName={productName} onPosted={refresh} />

      {posts.length === 0 ? (
        <EmptyState
          title="Nobody has written about this yet"
          description="Owners can post here once they have proved they have the product. If you own it, you could be first."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostThread key={post.id} slug={slug} productName={productName} post={post} />
          ))}
        </div>
      )}

      {isFetching && <Skeleton className="h-24 w-full" />}

      {/*
        Cursor rather than page numbers, per the contract. A discussion gains rows at
        the top while somebody reads it, and page two of a numbered paginator would
        show them something they had already seen.
      */}
      {nextCursor !== null && (
        <button
          type="button"
          onClick={() => setCursor(nextCursor)}
          className="self-start text-sm underline"
        >
          Show older posts
        </button>
      )}
    </div>
  );
}
