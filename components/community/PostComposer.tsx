'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPost, getVerification, isNotVerified } from '@/lib/api/community';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Card, Skeleton } from '@/components/ui';

interface Props {
  slug: string;
  productName: string;
  /** Set when replying to a top level post. Threads are one level deep. */
  parentId?: number;
  onPosted: () => void;
}

/**
 * The composer, and its four states.
 *
 * **EP-33 is the only source of branching.** Whether somebody may post is never
 * inferred from the post list, from a flag on a post, or from anything held in the
 * browser: it is one call, and it answers every case.
 *
 *   anonymous            no session, so no call is made at all
 *   signed in, unverified   `is_verified: false`, `can_attempt: true`
 *   verified                `is_verified: true`
 *   exhausted               `is_verified: false`, `can_attempt: false`
 *
 * `can_attempt` and `is_verified` are **rendering hints**. EP-32 re-checks and answers
 * 403 `not_verified` regardless of what this decided, so that refusal is handled here
 * too rather than assumed impossible.
 */
export function PostComposer({ slug, productName, parentId, onPosted }: Props) {
  const { session, isLoading } = useSession();

  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const { data: state, isPending: stateLoading } = useQuery({
    queryKey: queryKeys.community.verification(slug),
    queryFn: () => getVerification(slug),
    // Anonymous visitors never ask. The endpoint is authenticated, and the catalogue
    // is browsable without an account.
    enabled: session !== null,
  });

  async function post() {
    if (body.trim() === '') return;

    setPosting(true);
    setError(null);

    try {
      await createPost(slug, {
        body: body.trim(),
        ...(parentId === undefined ? {} : { parent_id: parentId }),
      });

      setBody('');
      onPosted();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'That could not be posted.'),
      );
    }

    setPosting(false);
  }

  /* ------------------------------------------------------------- anonymous */

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (session === null) {
    return (
      <Card className="flex flex-col gap-2 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          Anyone can read this. Posting is for people who own {productName}.
        </p>
        <p>
          <Link
            href={`/login?next=${encodeURIComponent(`/products/${slug}/community`)}`}
            className="underline"
          >
            Sign in
          </Link>{' '}
          to get started.
        </p>
      </Card>
    );
  }

  if (stateLoading || !state) {
    return <Skeleton className="h-24 w-full" />;
  }

  /* ------------------------------------------------------------ exhausted */

  if (!state.is_verified && !state.can_attempt) {
    /*
     * Five attempts used. Final, and said without a way out, because there is none:
     * no appeal, no administrator reset, no attempt purchase. Offering a support link
     * would send somebody looking for help that does not exist.
     */
    return (
      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          You have used all five attempts to prove you own {productName}, so you cannot
          post in this discussion.
        </p>
        <p className="mt-2">
          This applies to this product only. Anything else you own can still be
          verified.
        </p>
      </Card>
    );
  }

  /* --------------------------------------------------------- not verified */

  if (!state.is_verified) {
    return (
      <Card className="flex flex-col gap-2 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          Posting here is for people who own {productName}. It takes a photograph of the
          product beside a code we give you.
        </p>
        {state.pending_code !== null && (
          <p className="text-zinc-600 dark:text-zinc-400">
            You already have a code waiting.
          </p>
        )}
        <p>
          <Link href={`/verify/${slug}`} className="underline">
            {state.pending_code === null ? 'Prove you own it' : 'Finish proving you own it'}
          </Link>
          {state.attempts_used > 0 && (
            <span className="text-zinc-500 dark:text-zinc-400">
              {' '}
              ({state.attempts_remaining} of five attempts left)
            </span>
          )}
        </p>
      </Card>
    );
  }

  /* -------------------------------------------------------------- verified */

  return (
    <Card className="flex flex-col gap-3">
      <label htmlFor={`composer-${parentId ?? 'root'}`} className="text-sm font-medium">
        {parentId === undefined ? `Write about ${productName}` : 'Write a reply'}
      </label>

      <textarea
        id={`composer-${parentId ?? 'root'}`}
        rows={parentId === undefined ? 4 : 3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="What have you noticed using it?"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {error !== null && (
        <Alert
          tone={isNotVerified(error) ? 'info' : 'error'}
          title={isNotVerified(error) ? 'You need to prove you own this first' : 'That could not be posted'}
        >
          {isNotVerified(error) ? (
            /*
             * Reachable even though the composer was shown: `is_verified` is a hint,
             * and the endpoint decides. Rather than a dead end, it points at the fix.
             */
            <p>
              <Link href={`/verify/${slug}`} className="underline">
                Prove you own {productName}
              </Link>{' '}
              and your post will go through.
            </p>
          ) : (
            error.fieldError('body') ?? error.message
          )}
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={post} loading={posting} disabled={body.trim() === '' || posting}>
          {parentId === undefined ? 'Post' : 'Reply'}
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Posting as {session.name}.
        </span>
      </div>
    </Card>
  );
}
