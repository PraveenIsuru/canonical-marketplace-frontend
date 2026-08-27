'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getVerification,
  isAttemptsExhausted,
  isFileTooLarge,
  isUnsupportedMedia,
  startVerification,
  submitVerification,
} from '@/lib/api/community';
import { ApiError, AiUnavailableError } from '@/lib/api/client';
import { useQueuedJob } from '@/lib/jobs/useQueuedJob';
import { queryKeys } from '@/lib/query/keys';
import { QueuedJobPanel } from '@/components/system/QueuedJobPanel';
import { Alert, Button, Card, Skeleton } from '@/components/ui';
import type { VerificationResult } from '@/types/community';

interface Props {
  slug: string;
  productName: string;
}

/**
 * S-15 Proving you own a product.
 *
 * The platform issues a code, the buyer writes it on paper and photographs it beside
 * the product, and that photograph is judged. The code is what makes the photograph
 * evidence of **present possession** rather than a picture found online, which is the
 * whole difference between this discussion and an unverified comment thread.
 *
 * Four rules govern this screen, each easy to break by being helpful:
 *
 *  - **The photograph is never shown back.** Not as a preview after upload, not on the
 *    outcome screen, not anywhere. It is deleted server side the moment the answer is
 *    decided, so by the time a response arrives there is nothing to display and no path
 *    to hold. The file input is cleared rather than turned into a thumbnail.
 *  - **A failure is an outcome, not an error.** It arrives as 200, and the screen says
 *    what was wrong and how many attempts are left, in the same register as a pass.
 *  - **Five attempts is final.** There is no appeal, no administrator reset, and no
 *    control here that implies either exists.
 *  - **Starting spends nothing.** The code can be re-shown, and is, so a buyer who
 *    closed the page does not think they have to burn an attempt to get it back.
 */
export function VerificationFlow({ slug, productName }: Props) {
  const queryClient = useQueryClient();

  const [photo, setPhoto] = useState<File | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const job = useQueuedJob('verification');

  const { data: state, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.community.verification(slug),
    queryFn: () => getVerification(slug),
  });

  /*
   * EP-33 is authoritative about an outstanding judgement, where the browser key is
   * not: a buyer can have verifications queued on two products, and one stored id
   * cannot tell them apart. So the API's answer seeds the panel.
   */
  useEffect(() => {
    if (state?.pending_job_id && job.jobId === null) {
      job.start(state.pending_job_id);
    }
  }, [state?.pending_job_id, job]);

  async function begin() {
    setStarting(true);
    setError(null);

    try {
      await startVerification(slug);
      await queryClient.invalidateQueries({ queryKey: queryKeys.community.verification(slug) });
      await refetch();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'Verification could not be started.'),
      );
    }

    setStarting(false);
  }

  async function submit() {
    if (photo === null) return;

    setSubmitting(true);
    setError(null);

    try {
      const outcome = await submitVerification(slug, photo);

      setResult(outcome);
      // Cleared rather than kept. There is nothing to preview and nothing to resubmit.
      setPhoto(null);

      await queryClient.invalidateQueries({ queryKey: queryKeys.community.verification(slug) });
      await refetch();
    } catch (caught) {
      if (caught instanceof AiUnavailableError && caught.queuedJobId) {
        // Not a failure. The photograph is with the platform and the panel takes over.
        job.start(caught.queuedJobId);
        setPhoto(null);
        setSubmitting(false);

        return;
      }

      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'That photograph could not be submitted.'),
      );
    }

    setSubmitting(false);
  }

  /* ---------------------------------------------------------------- states */

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !state) {
    return (
      <div className="py-8">
        <Alert tone="error" title="This could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Prove you own {productName}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Only people who own a product can discuss it here, which is what makes the
          discussion worth reading.{' '}
          <Link href={`/products/${slug}/community`} className="underline">
            Back to the discussion
          </Link>
        </p>
      </div>

      {/* X-01, the fifth flow. The photograph is with the platform either way. */}
      {job.jobId !== null && (
        <QueuedJobPanel
          job={job.job}
          activity="Checking your photograph"
          onDismiss={() => job.dismiss()}
        />
      )}

      {state.is_verified && <AlreadyVerified slug={slug} productName={productName} />}

      {!state.is_verified && !state.can_attempt && <Exhausted />}

      {result !== null && !state.is_verified && (
        <Outcome result={result} attemptsRemaining={state.attempts_remaining} />
      )}

      {!state.is_verified && state.can_attempt && (
        <>
          <AttemptCounter used={state.attempts_used} remaining={state.attempts_remaining} />

          {state.pending_code === null ? (
            <Card className="flex flex-col gap-3">
              <h2 className="font-medium">How this works</h2>
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                <li>We give you a short code.</li>
                <li>Write it on a piece of paper by hand.</li>
                <li>Photograph the paper next to the product.</li>
                <li>Upload that photograph here.</li>
              </ol>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                The code is what shows you have the product in front of you now, rather
                than a picture from somewhere else.
              </p>
              {/*
                Said plainly, because a buyer with five attempts is deciding how careful
                to be and deserves to know the cost of starting is nothing.
              */}
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Getting a code does not use up an attempt. Only sending a photograph
                does.
              </p>
              <div>
                <Button onClick={begin} loading={starting} disabled={starting}>
                  Get my code
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col gap-4">
              <div>
                <h2 className="font-medium">Write this code on paper</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  By hand, then photograph it beside {productName}.
                </p>
              </div>

              {/*
                Re-shown on every visit, from `pending_code`. A buyer who closed the page
                would otherwise assume the code was lost and that getting another cost
                them an attempt.
              */}
              <p className="rounded-md bg-zinc-100 px-4 py-3 text-center font-mono text-2xl tracking-widest dark:bg-zinc-800">
                {state.pending_code}
              </p>

              <div className="flex flex-col gap-1">
                <label htmlFor="photo" className="text-sm font-medium">
                  Your photograph
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setPhoto(event.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  className="text-sm"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  JPEG, PNG, or WebP, up to 5 MB. Make sure the code and the product are
                  both clearly visible.
                </p>
                {/*
                  No preview. The photograph is destroyed the moment the answer is
                  decided, and showing it back would suggest we keep it.
                */}
              </div>

              {error !== null && <SubmitProblem error={error} />}

              <div>
                <Button
                  onClick={submit}
                  loading={submitting}
                  disabled={photo === null || submitting || job.isWaiting}
                >
                  Send this photograph
                </Button>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                We delete the photograph as soon as we have checked it, whether it works
                or not. It is never shown to anyone.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** Where a buyer stands, out of five. */
function AttemptCounter({ used, remaining }: { used: number; remaining: number }) {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {used === 0
        ? 'You have five attempts for this product.'
        : `You have used ${used} of five attempts. ${remaining} left.`}
    </p>
  );
}

/** The result of the attempt just made. A failure is stated, not apologised for. */
function Outcome({
  result,
  attemptsRemaining,
}: {
  result: VerificationResult;
  attemptsRemaining: number;
}) {
  if (result.outcome === 'passed') {
    return (
      <Alert tone="success" title="That worked">
        {result.reason ?? 'Your photograph showed the code beside the product.'}
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="That one did not work">
      <p>{result.reason ?? 'The code was not clear enough in the photograph.'}</p>
      <p className="mt-2 text-sm">
        {attemptsRemaining > 0
          ? `You have ${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} left. Take another photograph with the code written clearly and well lit.`
          : 'That was your last attempt for this product.'}
      </p>
    </Alert>
  );
}

/** Already proven. Nothing further to do here. */
function AlreadyVerified({ slug, productName }: { slug: string; productName: string }) {
  return (
    <Alert tone="success" title="You have already proved you own this">
      <p>You can post in the discussion for {productName}.</p>
      <p className="mt-2">
        <Link href={`/products/${slug}/community`} className="underline">
          Go to the discussion
        </Link>
      </p>
    </Alert>
  );
}

/**
 * All five attempts used.
 *
 * Final, and the screen says so without offering a way out, because there is none:
 * no appeal, no administrator confirmation, and no attempt reset exist anywhere in
 * this platform by design. Implying otherwise would send somebody looking for support
 * that cannot help them.
 */
function Exhausted() {
  return (
    <Alert tone="info" title="You have used all five attempts for this product">
      <p>
        We cannot check any more photographs for this one, so you will not be able to
        post in its discussion.
      </p>
      <p className="mt-2 text-sm">
        This applies only to this product. Anything else you own can still be verified.
      </p>
    </Alert>
  );
}

/** The ways a submission is refused, each said in its own terms. */
function SubmitProblem({ error }: { error: ApiError }) {
  if (isUnsupportedMedia(error)) {
    return (
      <Alert tone="warning" title="That file type will not work">
        Photographs need to be JPEG, PNG, or WebP. A screenshot saved as something else
        will not go through.
      </Alert>
    );
  }

  if (isFileTooLarge(error)) {
    return (
      <Alert tone="warning" title="That photograph is too large">
        It needs to be 5 MB or smaller. Most phones let you send a smaller version.
      </Alert>
    );
  }

  if (isAttemptsExhausted(error)) {
    return (
      <Alert tone="info" title="You have used all five attempts">
        We cannot check any more photographs for this product.
      </Alert>
    );
  }

  return (
    <Alert tone="error" title="That could not be sent">
      {error.message}
    </Alert>
  );
}
