'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getProductVariants,
  isAiUnavailable,
  isAlreadyAttached,
  isConfirmationIncomplete,
  isExpiredSession,
  isProposalPending,
  startConfirmation,
  submitConfirmation,
} from '@/lib/api/confirmation';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { useQueuedJob } from '@/lib/jobs/useQueuedJob';
import { useSelectedCandidate } from '@/lib/jobs/useSelectedCandidate';
import { clearSelectedCandidate } from '@/lib/jobs/storage';
import { confirmationJobResultSchema } from '@/lib/schemas/confirmation';
import { queryKeys } from '@/lib/query/keys';
import { parseMoneyToMinor } from '@/lib/format/money';
import { QueuedJobPanel } from '@/components/system/QueuedJobPanel';
import { Alert, Button, Card, Skeleton } from '@/components/ui';
import { ConfirmationOutcomePanel } from './ConfirmationOutcomePanel';
import type { ConfirmationOutcome, ConfirmationSession } from '@/types/confirmation';
import type { Variant } from '@/types/product';

/** One currency for the submission. A selector is not part of this screen. */
const CURRENCY = 'LKR';

/**
 * S-24 Confirmation flow.
 *
 * The mandatory questions a seller answers before joining a record that already
 * exists. It is the only way a seller's knowledge reaches a canonical record, because
 * nobody edits one directly.
 *
 * Three rules govern this component and each is easy to break by being helpful:
 *
 *  - **There is no skip control anywhere, not even a disabled one.** Rendering a
 *    disabled skip would tell the seller the option exists and is merely unavailable
 *    to them, which is the opposite of true. Completion is mandatory.
 *  - **The record's own values are never shown.** The API deliberately does not send
 *    them. Putting the expected answer beside the question would turn confirmation
 *    into a yes or no exercise, and the value of the flow is that the seller describes
 *    their own unit unled.
 *  - **No confidence score appears.** It is scored server side from these answers and
 *    returned by no endpoint at any access level.
 */
export function ConfirmationFlow() {
  const queryClient = useQueryClient();
  const { session: user, isLoading: sessionLoading } = useSession();
  const candidate = useSelectedCandidate();

  const [fetchedSession, setFetchedSession] = useState<ConfirmationSession | null>(null);
  const [starting, setStarting] = useState(true);
  const [startRefusal, setStartRefusal] = useState<'already_attached' | 'proposal_pending' | string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [carried, setCarried] = useState<number[]>([]);
  const [price, setPrice] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [outcome, setOutcome] = useState<ConfirmationOutcome | null>(null);

  const job = useQueuedJob('confirmation');
  const opened = useRef(false);
  const jobStart = job.start;

  /**
   * Opens a session and loads the product's versions.
   *
   * Every state change happens after an await, deliberately. Setting state
   * synchronously from the effect below would cascade a second render before the
   * first had painted.
   */
  const begin = useCallback(
    async (productId: number, slug: string, onQueued: (id: string) => void) => {
      try {
        const [opened, loaded] = await Promise.all([
          startConfirmation(productId),
          getProductVariants(slug),
        ]);

        setFetchedSession(opened);
        setVariants(loaded);
        setStartRefusal(null);
      } catch (caught) {
        if (isAlreadyAttached(caught)) {
          setStartRefusal('already_attached');
        } else if (isProposalPending(caught)) {
          setStartRefusal('proposal_pending');
        } else if (isAiUnavailable(caught) && caught.queuedJobId) {
          onQueued(caught.queuedJobId);
        } else {
          setStartRefusal(
            caught instanceof ApiError ? caught.message : 'Confirmation could not be opened.',
          );
        }
      }

      setStarting(false);
    },
    [],
  );

  // Once only: opening a session costs a provider call and creates one server side.
  useEffect(() => {
    if (candidate === null || opened.current) return;
    opened.current = true;

    void begin(candidate.product_id, candidate.slug, jobStart);
  }, [candidate, begin, jobStart]);

  /*
   * A queued submission that finished while the seller was away.
   *
   * The job completed the whole submission, so its result is the same outcome EP-22
   * would have returned. Derived during render rather than copied into state, and
   * parsed rather than trusted.
   */
  const outcomeFromJob = useMemo(() => {
    if (job.job?.status !== 'completed' || job.job.result_type !== 'confirmation_outcome') {
      return null;
    }

    const parsed = confirmationJobResultSchema.safeParse(job.job.result);

    return parsed.success ? parsed.data : null;
  }, [job.job]);

  const resolved = outcome ?? outcomeFromJob;
  const session = fetchedSession;

  const questions = session?.questions ?? [];
  const answered = questions.filter((q) => (answers[q.id] ?? '').trim() !== '').length;
  const allAnswered = questions.length > 0 && answered === questions.length;
  const priceMinor = parseMoneyToMinor(price);
  const canSubmit = allAnswered && carried.length > 0 && priceMinor !== null;

  async function submit() {
    if (session === null || priceMinor === null) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitConfirmation({
        session_id: session.session_id,
        answers,
        variant_ids: carried,
        price_minor: priceMinor,
        currency: CURRENCY,
      });

      // The store may have just gone live, and a proposal may have just blocked a
      // product. Both change what the dashboard and listings should say.
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stores.listings() });

      clearSelectedCandidate();
      setOutcome(result);
    } catch (caught) {
      if (isAiUnavailable(caught) && caught.queuedJobId) {
        // Not a failure. The submission is saved and the panel takes over.
        job.start(caught.queuedJobId);
        setSubmitting(false);

        return;
      }

      setSubmitError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'The submission could not be completed.'),
      );
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- states */

  if (sessionLoading) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user?.store) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">You need a store first</h1>
        <Link href="/sell/start" className="underline">
          Register your store
        </Link>
      </div>
    );
  }

  if (resolved !== null) {
    return (
      <ConfirmationOutcomePanel
        outcome={resolved}
        productName={candidate?.name ?? 'this product'}
        productSlug={candidate?.slug ?? null}
      />
    );
  }

  /*
   * Landed here without choosing a product. Sent back rather than shown a blank form,
   * because confirmation only means anything against a specific record.
   */
  if (candidate === null) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">Choose a product first</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Confirmation is about one product in the catalogue, so we need to know which
          one before we can ask you anything.
        </p>
        <Link href="/sell/attach" className="underline">
          Check the catalogue
        </Link>
      </div>
    );
  }

  if (startRefusal === 'already_attached') {
    return (
      <div className="flex flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold">You already sell {candidate.name}</h1>
        <Alert tone="info">
          <p>
            There is nothing to confirm, because your store is already on this product.
            Your price and availability are managed from your listings.
          </p>
        </Alert>
        <Link href="/listings" className="underline">
          Go to your listings
        </Link>
      </div>
    );
  }

  if (startRefusal === 'proposal_pending') {
    return (
      <div className="flex flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold">This one is already under review</h1>
        {/*
          Not an error. They submitted answers earlier, the answers differed from the
          record, and the other sellers are still deciding.
        */}
        <Alert tone="info" title="Other sellers are reviewing your answers">
          <p>
            You have already answered the questions for {candidate.name}, and what you
            said is being checked by the sellers who carry it. You can list it once that
            finishes.
          </p>
        </Alert>
        <Link href="/listings" className="underline">
          See it on your listings
        </Link>
      </div>
    );
  }

  if (job.jobId !== null && session === null) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold">Confirm {candidate.name}</h1>
        <QueuedJobPanel
          job={job.job}
          activity="Preparing your questions"
          onRetry={() => {
            job.dismiss();
            setStarting(true);
            void begin(candidate.product_id, candidate.slug, jobStart);
          }}
          onDismiss={() => job.dismiss()}
        />
      </div>
    );
  }

  if (starting) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Alert tone="error" title="Confirmation could not be opened">
          {startRefusal ?? 'Something went wrong.'}
        </Alert>
        <Link href="/sell/attach" className="underline">
          Back to the catalogue check
        </Link>
      </div>
    );
  }

  const expired = submitError !== null && isExpiredSession(submitError);
  const incomplete = submitError !== null && isConfirmationIncomplete(submitError);

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Confirm {candidate.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          This product is already in the catalogue and shared by everyone who sells it.
          Answering these tells us the unit you stock is the same one, and flags it if
          it is not.{' '}
          <Link href={`/products/${candidate.slug}`} className="underline" target="_blank">
            See the product page
          </Link>
        </p>
      </div>

      {/*
        X-01, for a submission the provider could not score. The seller's answers stay
        on screen behind it.
      */}
      {job.jobId !== null && (
        <QueuedJobPanel
          job={job.job}
          activity="Submitting your answers"
          onDismiss={() => job.dismiss()}
        />
      )}

      {expired && (
        <Alert tone="warning" title="These questions have expired">
          <p>
            A confirmation lasts a day, and this one ran out. The product has not
            changed, so you only need fresh questions.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              setSubmitError(null);
              setFetchedSession(null);
              setAnswers({});
              setStarting(true);
              void begin(candidate.product_id, candidate.slug, jobStart);
            }}
          >
            Start again
          </Button>
        </Alert>
      )}

      {incomplete && (
        <Alert tone="warning" title="Every question needs an answer">
          The flow cannot be part completed. Fill in the ones left blank and submit
          again.
        </Alert>
      )}

      {submitError && !expired && !incomplete && !submitError.isValidationError && (
        <Alert tone="error">{submitError.message}</Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">About the unit you stock</h2>
          {/* Progress, not just a disabled button. The seller should be able to see
              how far off they are without hunting for empty fields. */}
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {answered} of {questions.length} answered
          </span>
        </div>

        {questions.map((question) => {
          const fieldError = submitError?.fieldError(`answers.${question.id}`);

          return (
            <div key={question.id} className="flex flex-col gap-1">
              <label htmlFor={`q-${question.id}`} className="text-sm font-medium">
                {question.text}
              </label>
              {/*
                No current value beside it, and none available to render even if
                someone tried: the API does not send it.
              */}
              <textarea
                id={`q-${question.id}`}
                rows={2}
                value={answers[question.id] ?? ''}
                onChange={(event) =>
                  setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))
                }
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              {fieldError && <p className="text-xs text-red-600 dark:text-red-400">{fieldError}</p>}
            </div>
          );
        })}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-medium">Which versions do you stock?</h2>

        {variants === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="flex flex-col gap-2">
            {variants.map((variant) => (
              <li key={variant.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`v-${variant.id}`}
                  checked={carried.includes(variant.id)}
                  onChange={(event) =>
                    setCarried((previous) =>
                      event.target.checked
                        ? [...previous, variant.id]
                        : previous.filter((id) => id !== variant.id),
                    )
                  }
                  className="h-4 w-4"
                />
                <label htmlFor={`v-${variant.id}`} className="text-sm">
                  {Object.entries(variant.attribute_values).length === 0
                    ? 'Single default version'
                    : Object.entries(variant.attribute_values)
                        .map(([name, value]) => `${name}: ${value}`)
                        .join(', ')}
                  {/* A version nobody stocks is a normal thing to be adding, so it is
                      described rather than flagged. */}
                  {variant.seller_count === 0 && (
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                      no sellers yet
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium">
            Your price for these
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{CURRENCY}</span>
            <input
              id="price"
              inputMode="decimal"
              value={price}
              placeholder="0.00"
              onChange={(event) => setPrice(event.target.value)}
              className="w-40 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {price !== '' && priceMinor === null && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Enter an amount above zero, for example 4599.00.
            </p>
          )}
        </div>
      </Card>

      {/*
        There is deliberately no skip control here, and no disabled one either. A
        disabled skip would say the option exists and is merely closed to this seller,
        which is not true of anyone.
      */}
      <div className="flex flex-col gap-2">
        <Button onClick={submit} loading={submitting} disabled={!canSubmit || job.isWaiting}>
          Submit these answers
        </Button>

        {/* Says why, rather than leaving a dead button to be puzzled over. */}
        {!canSubmit && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {!allAnswered
              ? `Every question needs an answer before you can submit. ${questions.length - answered} still to go.`
              : carried.length === 0
                ? 'Tick at least one version you stock.'
                : 'Enter your price for the versions you stock.'}
          </p>
        )}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          If your answers match the record you are listed straight away. If any differ,
          the sellers who already carry this product review the difference first.
        </p>
      </div>
    </div>
  );
}
