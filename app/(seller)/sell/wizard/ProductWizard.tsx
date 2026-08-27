'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  isAiUnavailable,
  isMatchRequired,
  startWizard,
  submitWizard,
} from '@/lib/api/attach';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { useQueuedJob } from '@/lib/jobs/useQueuedJob';
import { clearStoredDraft, clearStoredJobId, storeDraft } from '@/lib/jobs/storage';
import { useStoredDraft } from '@/lib/jobs/useStoredDraft';
import { wizardJobResultSchema } from '@/lib/schemas/attach';
import { queryKeys } from '@/lib/query/keys';
import {
  buildCombinations,
  cleanAttributes,
  combinationKey,
  duplicateAttributeNames,
} from '@/lib/attach/combinations';
import { parseMoneyToMinor } from '@/lib/format/money';
import { QueuedJobPanel } from '@/components/system/QueuedJobPanel';
import { AttributeEditor } from '@/components/seller/AttributeEditor';
import { CombinationPreview, type CarriedEntry } from '@/components/seller/CombinationPreview';
import { ImagePicker } from '@/components/seller/ImagePicker';
import { Alert, Button, Card, Input, Skeleton } from '@/components/ui';
import { WizardOutcome } from './WizardOutcome';
import type {
  AttributeDefinition,
  CarriedVariant,
  PendingImage,
  ProductDraft,
  WizardSession,
  WizardSubmitResult,
} from '@/types/attach';

const STEPS = [
  'Product details',
  'About the product',
  'Variations',
  'Versions and prices',
  'Photos',
  'Review',
] as const;

/** The currency every price on this form is entered in. */
const CURRENCY = 'LKR';

/**
 * S-25 New product wizard.
 *
 * Reached only when matching found nothing, and the API enforces that rather than
 * trusting this screen: opening a session re-runs the match, and answers 422
 * `match_required` if the catalogue does hold the product after all.
 *
 * Six steps, and the ordering is forced by two facts about the API.
 *
 * The questions come from the server and are answered against a session, so they
 * cannot be shown until a session exists. And images are keyed by product slug, which
 * does not exist until the submission succeeds, so files are held in client state
 * through step 5 and uploaded afterwards.
 *
 * Everything this screen creates is permanent. There is no product deletion path, and
 * no generated variant combination can ever be removed, by anyone. The review step and
 * the live combination count both exist so that is understood before the button is
 * pressed rather than afterwards.
 */
export function ProductWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session: user, isLoading: sessionLoading } = useSession();

  /*
   * The draft comes from browser storage, where the match screen left it, and edits on
   * step 1 are layered over it. Reading it as an external store rather than copying it
   * into state on mount keeps this render free of a cascading update, and means a
   * reload resumes with the same product rather than an empty form.
   */
  const storedDraft = useStoredDraft();
  const [edits, setEdits] = useState<Partial<ProductDraft>>({});

  const draft: ProductDraft | null = useMemo(() => {
    if (storedDraft === null) return null;

    return {
      name: edits.name ?? storedDraft.name,
      description: edits.description !== undefined ? edits.description : storedDraft.description,
      category: edits.category !== undefined ? edits.category : storedDraft.category,
    };
  }, [storedDraft, edits]);

  const [fetchedSession, setFetchedSession] = useState<WizardSession | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<'match_required' | string | null>(null);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [entries, setEntries] = useState<Record<string, CarriedEntry>>({});
  const [images, setImages] = useState<PendingImage[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<WizardSubmitResult | null>(null);

  const job = useQueuedJob('wizard');
  const opened = useRef(false);

  const combinations = useMemo(
    () => buildCombinations(cleanAttributes(attributes)),
    [attributes],
  );

  /**
   * Opens a session, or records why it cannot be opened.
   *
   * Every state change here happens after an await, deliberately. Setting state
   * synchronously from the effect below would cascade a second render before the
   * first had painted.
   */
  const startSession = useCallback(async (forDraft: ProductDraft, jobStart: (id: string) => void) => {
    try {
      const opened = await startWizard(forDraft);
      setFetchedSession(opened);
      setStartError(null);
    } catch (caught) {
      if (isMatchRequired(caught)) {
        /*
         * Not a client bug to route around. The catalogue holds this product, so the
         * seller belongs in the confirmation flow rather than here, and the honest
         * answer is to send them back to the candidates.
         */
        setStartError('match_required');
      } else if (isAiUnavailable(caught) && caught.queuedJobId) {
        jobStart(caught.queuedJobId);
      } else {
        setStartError(
          caught instanceof ApiError ? caught.message : 'The wizard could not be opened.',
        );
      }
    }

    setStarting(false);
  }, []);

  const jobStart = job.start;

  // Open a session against the draft the match screen left behind. Once only: this
  // costs a provider call and creates a session on the server.
  useEffect(() => {
    if (storedDraft === null || opened.current) return;
    opened.current = true;

    void startSession(storedDraft, jobStart);
  }, [storedDraft, startSession, jobStart]);

  /*
   * A queued session generation that finished, derived rather than copied into state.
   *
   * The job opened the session server side, so this is the same payload EP-23 would
   * have returned had the provider answered first time.
   */
  const sessionFromJob = useMemo(() => {
    if (job.job?.status !== 'completed' || job.job.result_type !== 'wizard_questions') return null;

    const parsed = wizardJobResultSchema.safeParse(job.job.result);

    return parsed.success ? parsed.data : null;
  }, [job.job]);

  const session = fetchedSession ?? sessionFromJob;

  function setAnswer(id: string, value: string) {
    setAnswers((previous) => ({ ...previous, [id]: value }));
  }

  function toggleCarried(key: string, carried: boolean) {
    setEntries((previous) => ({
      ...previous,
      [key]: { price: previous[key]?.price ?? '', carried },
    }));
  }

  function setPrice(key: string, price: string) {
    setEntries((previous) => ({
      ...previous,
      [key]: { price, carried: previous[key]?.carried ?? true },
    }));
  }

  /** The combinations the seller ticked, as the API wants them. */
  const carriedVariants = useMemo((): CarriedVariant[] => {
    return combinations
      .filter((combination) => entries[combinationKey(combination)]?.carried)
      .map((combination) => ({
        attribute_values: combination,
        price_minor: parseMoneyToMinor(entries[combinationKey(combination)]?.price ?? '') ?? 0,
        currency: CURRENCY,
      }));
  }, [combinations, entries]);

  const unanswered = (session?.questions ?? []).filter(
    (question) => (answers[question.id] ?? '').trim() === '',
  );
  const duplicateNames = duplicateAttributeNames(attributes);
  const pricesInvalid = carriedVariants.some((variant) => variant.price_minor <= 0);

  async function submit() {
    if (draft === null || session === null) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const submitted = await submitWizard({
        session_id: session.session_id,
        answers,
        name: draft.name,
        description: draft.description,
        category: draft.category ?? 'Uncategorised',
        attributes: cleanAttributes(attributes),
        carried_variants: carriedVariants,
      });

      // The session carries the store, and `is_live` has very likely just changed.
      // Invalidating it is what updates the navigation without a reload.
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stores.mine() });

      // The flow is over. Both stored values go, so a later visit starts clean rather
      // than resuming a session whose product now exists.
      clearStoredDraft();
      clearStoredJobId('wizard');
      setResult(submitted);
    } catch (caught) {
      if (isMatchRequired(caught)) {
        // The session expired while they worked. The catalogue may have gained this
        // very product since, so matching has to run again before a second attempt.
        setStartError('match_required');
        setFetchedSession(null);
        setSubmitting(false);
        return;
      }

      const error =
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'The product could not be created.');

      setSubmitError(error);

      /*
       * An unanswered question comes back keyed `answers.q3`, not as
       * `confirmation_incomplete`, which belongs to the M6 confirmation flow. Jumping
       * back to the question step puts the seller in front of the field the API named
       * rather than leaving them on a review screen with an error about something they
       * cannot see.
       */
      if (Object.keys(error.errors ?? {}).some((key) => key.startsWith('answers.'))) {
        setStep(1);
      }

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

  if (result !== null) {
    return <WizardOutcome result={result} images={images} />;
  }

  /*
   * Landed here directly, with nothing from the match screen.
   *
   * Sent back rather than offered a blank form, because the catalogue check is not a
   * formality: it decides whether this seller should be building a record at all, and
   * the API refuses the wizard with `match_required` if they skip it.
   */
  if (storedDraft === null) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">Start with the catalogue check</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          The wizard builds a record for a product the catalogue does not have yet, so
          we check whether it is already here first.
        </p>
        <Link href="/sell/attach" className="underline">
          Check the catalogue
        </Link>
      </div>
    );
  }

  if (startError === 'match_required') {
    return (
      <div className="flex flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold">This product is already in the catalogue</h1>
        {/*
          Framed as the system working, because it is. Duplicate records are what the
          platform exists to prevent, and finding an existing one is a good outcome.
        */}
        <Alert tone="info">
          <p>
            The catalogue already holds a record for this, so there is nothing to build.
            You join the existing record instead, which is what puts you on the same page
            as every other seller who carries it.
          </p>
          <p className="mt-2">
            Joining a record is being built and is not available yet. Nothing has been
            created.
          </p>
        </Alert>
        <Link href="/sell/attach" className="underline">
          Back to the catalogue check
        </Link>
      </div>
    );
  }

  if (job.jobId !== null && session === null) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <h1 className="text-2xl font-semibold">New product</h1>
        <QueuedJobPanel
          job={job.job}
          activity="Preparing your questions"
          onRetry={() => {
            job.dismiss();
            setStarting(true);
            setStartError(null);
            if (draft) void startSession(draft, jobStart);
          }}
          onDismiss={() => {
            job.dismiss();
            router.push('/sell/attach');
          }}
        />
        {draft && (
          <Card className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Your product</span>
            <span className="font-medium">{draft.name}</span>
            {draft.category && (
              <span className="text-zinc-500 dark:text-zinc-400">{draft.category}</span>
            )}
          </Card>
        )}
      </div>
    );
  }

  if (starting) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (startError !== null || session === null || draft === null) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Alert tone="error" title="The wizard could not be opened">
          {startError ?? 'Something went wrong.'}
        </Alert>
        <Link href="/sell/attach" className="underline">
          Back to the catalogue check
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------- steps */

  const canAdvance = (() => {
    if (step === 0) return draft.name.trim().length >= 2 && (draft.category ?? '').trim() !== '';
    if (step === 1) return unanswered.length === 0;
    if (step === 2) return duplicateNames.length === 0;
    if (step === 3) return carriedVariants.length > 0 && !pricesInvalid;
    return true;
  })();

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">New product</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The catalogue does not have this yet, so you are creating the record every
          seller of it will share.
        </p>
      </div>

      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={
              index === step
                ? 'font-medium text-zinc-900 dark:text-zinc-100'
                : index < step
                  ? 'text-zinc-500 line-through dark:text-zinc-500'
                  : 'text-zinc-400 dark:text-zinc-600'
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {submitError && !submitError.isValidationError && (
        <Alert tone="error">{submitError.message}</Alert>
      )}

      <Card className="flex flex-col gap-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-medium">Product details</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                These become the record everyone sees, so write them for a buyer rather
                than for your own stock list.
              </p>
            </div>

            <Input
              label="Product name"
              value={draft.name}
              onChange={(event) => {
                const next = { ...draft, name: event.target.value };
                setEdits(next);
                storeDraft(next);
              }}
              error={submitError?.fieldError('name')}
            />

            <Input
              label="Description"
              value={draft.description ?? ''}
              onChange={(event) => {
                const next = { ...draft, description: event.target.value || null };
                setEdits(next);
                storeDraft(next);
              }}
              hint="Optional."
              error={submitError?.fieldError('description')}
            />

            <Input
              label="Category"
              value={draft.category ?? ''}
              required
              onChange={(event) => {
                const next = { ...draft, category: event.target.value || null };
                setEdits(next);
                storeDraft(next);
              }}
              error={submitError?.fieldError('category')}
            />

            {/*
              The catalogue check ran against the name they first typed. Changing it a
              lot here could describe a product that does exist, and the check would not
              re-run on this step.
            */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              If you change the name substantially, go back and check the catalogue
              again. A different name may match a record that is already here.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-medium">About the product</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Written from a buyer&rsquo;s point of view. Every question needs an
                answer, because the answers are the record.
              </p>
            </div>

            {session.questions.map((question) => {
              const fieldError = submitError?.fieldError(`answers.${question.id}`);

              return (
                <div key={question.id} className="flex flex-col gap-1">
                  <label htmlFor={`q-${question.id}`} className="text-sm font-medium">
                    {question.text}
                  </label>
                  <textarea
                    id={`q-${question.id}`}
                    rows={2}
                    value={answers[question.id] ?? ''}
                    onChange={(event) => setAnswer(question.id, event.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  {fieldError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{fieldError}</p>
                  )}
                </div>
              );
            })}

            {/* Says how many remain rather than only disabling the button. */}
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {unanswered.length === 0
                ? `All ${session.questions.length} answered.`
                : `${session.questions.length - unanswered.length} of ${session.questions.length} answered.`}
            </p>
          </div>
        )}

        {step === 2 && (
          <>
            <AttributeEditor attributes={attributes} onChange={setAttributes} />
            {duplicateNames.length > 0 && (
              <Alert tone="error">
                Two variations are called {duplicateNames.join(' and ')}. Each needs its
                own name, or one would quietly replace the other.
              </Alert>
            )}
          </>
        )}

        {step === 3 && (
          <CombinationPreview
            combinations={combinations}
            entries={entries}
            currency={CURRENCY}
            onToggle={toggleCarried}
            onPrice={setPrice}
            errorFor={(key) => {
              const index = carriedVariants.findIndex(
                (variant) => combinationKey(variant.attribute_values) === key,
              );
              if (index < 0) return undefined;

              return (
                submitError?.fieldError(`carried_variants.${index}.price_minor`) ??
                submitError?.fieldError(`carried_variants.${index}.attribute_values`)
              );
            }}
          />
        )}

        {step === 4 && <ImagePicker images={images} onChange={setImages} />}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-medium">Review</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Once created, this record is permanent. It can be corrected later
                through a change proposal that other sellers review, but it cannot be
                deleted, and neither can any of its versions.
              </p>
            </div>

            <dl className="grid gap-1 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
              <dd>{draft.name}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Category</dt>
              <dd>{draft.category}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Questions answered</dt>
              <dd>{session.questions.length}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Versions created</dt>
              <dd>{combinations.length}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Versions you will list</dt>
              <dd>{carriedVariants.length}</dd>
              <dt className="text-zinc-500 dark:text-zinc-400">Photos</dt>
              <dd>{images.filter((i) => i.status !== 'failed').length}</dd>
            </dl>

            {unanswered.length > 0 && (
              <Alert tone="warning">
                {unanswered.length} question
                {unanswered.length === 1 ? '' : 's'} still needs an answer.{' '}
                <button type="button" onClick={() => setStep(1)} className="underline">
                  Go back to them
                </button>
              </Alert>
            )}

            <Button
              onClick={submit}
              loading={submitting}
              disabled={unanswered.length > 0 || carriedVariants.length === 0 || pricesInvalid}
            >
              Create this product
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>

        {step < STEPS.length - 1 && (
          <Button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          >
            Continue
          </Button>
        )}
      </div>

      {!canAdvance && step === 3 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {carriedVariants.length === 0
            ? 'Tick at least one version and give it a price to continue.'
            : 'Every version you list needs a price above zero.'}
        </p>
      )}
    </div>
  );
}
