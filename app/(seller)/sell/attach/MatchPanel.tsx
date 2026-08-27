'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { describeImageProblem, isAiUnavailable, matchProduct } from '@/lib/api/attach';
import {
  getMyListings,
  isAlreadyAttached,
  isProposalPending,
  startConfirmation,
} from '@/lib/api/confirmation';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { useQueuedJob } from '@/lib/jobs/useQueuedJob';
import { useStoredDraft } from '@/lib/jobs/useStoredDraft';
import { storeDraft, storeSelectedCandidate } from '@/lib/jobs/storage';
import { matchJobResultSchema } from '@/lib/schemas/attach';
import { QueuedJobPanel } from '@/components/system/QueuedJobPanel';
import { PendingProposalNotice } from '@/components/proposal/PendingProposalNotice';
import { Alert, Button, Card, Input, Skeleton } from '@/components/ui';
import type { MatchCandidate, ProductDraft } from '@/types/attach';
import type { BlockedProposal } from '@/types/confirmation';

/**
 * S-22 Match candidates.
 *
 * The gate the whole platform depends on. Before a seller can list anything, the
 * catalogue is asked whether it already holds the product they are describing.
 *
 * Two outcomes, and confusing them is the mistake this screen exists to avoid.
 *
 * **No candidates is a success.** It means the catalogue has nothing like this, and it
 * is the answer that opens the wizard. Nothing about it is rendered as a miss, an
 * empty state, or something to retry.
 *
 * **Candidates means the record already exists**, and the seller joins it rather than
 * writing a second one. Choosing one carries it into confirmation, where they answer
 * questions about the unit they stock.
 *
 * There is deliberately no control anywhere here that lets a seller declare a matched
 * product new. That is what the platform exists to prevent.
 */
export function MatchPanel() {
  const router = useRouter();
  const { session, isLoading } = useSession();

  /*
   * The form is what the seller has typed *this visit*, layered over whatever was
   * stored last time. Kept as edits rather than copied into state on mount, because
   * seeding state from storage in an effect causes a cascading render and seeding it
   * as an initial value disagrees with the server's HTML.
   */
  const storedDraft = useStoredDraft();
  const [edits, setEdits] = useState<Partial<Record<'name' | 'description' | 'category', string>>>({});

  const form = {
    name: edits.name ?? storedDraft?.name ?? '',
    description: edits.description ?? storedDraft?.description ?? '',
    category: edits.category ?? storedDraft?.category ?? '',
  };

  const [image, setImage] = useState<File | null>(null);
  const [imageProblem, setImageProblem] = useState<string | null>(null);

  const [fresh, setFresh] = useState<MatchCandidate[] | null>(null);
  const [selected, setSelected] = useState<MatchCandidate | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  /** Starting confirmation for the chosen candidate, and what blocks it. */
  const [confirming, setConfirming] = useState(false);
  const [blockedProposal, setBlockedProposal] = useState<BlockedProposal | null>(null);

  const job = useQueuedJob('match');

  /*
   * A queued match that finished stands in for the response the seller never got.
   *
   * Derived during render rather than copied into state, and parsed rather than
   * trusted: it crossed the wire like any other payload.
   */
  const fromJob = useMemo(() => {
    if (job.job?.status !== 'completed' || job.job.result_type !== 'match_candidates') return null;

    const parsed = matchJobResultSchema.safeParse(job.job.result);

    return parsed.success ? parsed.data.candidates : null;
  }, [job.job]);

  const candidates = fresh ?? fromJob;

  function update(field: 'name' | 'description' | 'category') {
    return (event: { target: { value: string } }) =>
      setEdits((previous) => ({ ...previous, [field]: event.target.value }));
  }

  function chooseImage(file: File | null) {
    setImage(file);
    setImageProblem(file === null ? null : describeImageProblem(file));
  }

  /**
   * Carries a chosen candidate into confirmation.
   *
   * Confirmation is opened on the next screen rather than here, so this only records
   * which product was chosen and navigates. Two refusals are handled before it gets
   * that far, because both are better answered on this screen than after a navigation:
   *
   *  - `already_attached`: the seller carries this product, so their listings are what
   *    they actually wanted.
   *  - `proposal_pending`: they have a submission out on it, and X-05 says where it
   *    got to rather than only refusing.
   */
  async function confirmCandidate(candidate: MatchCandidate) {
    setConfirming(true);
    setBlockedProposal(null);
    setError(null);

    storeSelectedCandidate({
      product_id: candidate.product_id,
      slug: candidate.slug,
      name: candidate.name,
    });

    try {
      // Asked here so the refusals land on this screen. The confirmation screen opens
      // its own session; a second call there is cheap and keeps that screen standalone.
      await startConfirmation(candidate.product_id);

      router.push('/sell/confirm');
    } catch (caught) {
      if (isAlreadyAttached(caught)) {
        router.push('/listings');

        return;
      }

      if (isProposalPending(caught)) {
        // The listings call is what knows the dates and the fields under review, so
        // the notice is filled in from there rather than from the refusal.
        const listings = await getMyListings().catch(() => null);
        const pending = listings?.blocked.find(
          (entry) => entry.product.id === candidate.product_id,
        );

        setBlockedProposal(pending ?? null);
        setConfirming(false);

        return;
      }

      if (isAiUnavailable(caught) && caught.queuedJobId) {
        // Not a failure. The confirmation screen picks the job up and resumes.
        router.push('/sell/confirm');

        return;
      }

      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'Confirmation could not be started.'),
      );
      setConfirming(false);
    }
  }

  function draftFrom(): ProductDraft {
    return {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      category: form.category.trim() === '' ? null : form.category.trim(),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (imageProblem !== null) return;

    setPending(true);
    setError(null);
    setFresh(null);
    setSelected(null);

    // A previous queued result must not linger behind a new question.
    if (job.jobId !== null) job.dismiss();

    const draft = draftFrom();
    storeDraft(draft);

    try {
      const result = await matchProduct(draft, image);

      /*
       * The one decision this screen makes.
       *
       * An empty array is not an error and not an empty state. It is the catalogue
       * saying it does not hold this product, which is precisely the condition the
       * wizard requires, so the seller goes straight there.
       */
      if (result.candidates.length === 0) {
        router.push('/sell/wizard');
        return;
      }

      setFresh(result.candidates);
      setPending(false);
    } catch (caught) {
      if (isAiUnavailable(caught) && caught.queuedJobId) {
        // Not a failure. The work is queued and the panel takes over from here.
        job.start(caught.queuedJobId);
        return;
      }

      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'The catalogue could not be checked just now.'),
      );
      setPending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Rendering hint only. Every one of these endpoints refuses independently with
  // `store_required`, so this exists to avoid showing a form that could only fail.
  if (!session?.store) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">You need a store first</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Listing a product attaches your store to it, so the store has to exist before
          there is anything to attach.
        </p>
        <Link href="/sell/start" className="underline">
          Register your store
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">List a product</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The platform keeps one record per product, shared by everyone who sells it. So
          we check whether it is already here before you build a new one.
        </p>
      </div>

      {job.jobId !== null && (
        <QueuedJobPanel
          job={job.job}
          activity="Checking the catalogue"
          onRetry={() => {
            job.dismiss();
            setPending(false);
          }}
          onDismiss={() => {
            job.dismiss();
            setPending(false);
          }}
        />
      )}

      {error && !error.isValidationError && <Alert tone="error">{error.message}</Alert>}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Product name"
          name="name"
          required
          value={form.name}
          onChange={update('name')}
          hint="As it appears on the box. Brand and model together work best."
          error={error?.fieldError('name')}
          disabled={job.isWaiting}
        />

        <Input
          label="Description"
          name="description"
          value={form.description}
          onChange={update('description')}
          hint="Optional. A line about what it is helps us tell similar models apart."
          error={error?.fieldError('description')}
          disabled={job.isWaiting}
        />

        <Input
          label="Category"
          name="category"
          value={form.category}
          onChange={update('category')}
          hint="Optional, for example Audio or Home."
          error={error?.fieldError('category')}
          disabled={job.isWaiting}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="match-image" className="text-sm font-medium">
            Photo of the product
          </label>
          <input
            id="match-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={job.isWaiting}
            onChange={(event) => chooseImage(event.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-800"
          />
          {/*
            A photo here is used to answer one question and is then discarded. It does
            not become a product image, and saying so avoids a seller assuming they
            have already uploaded their gallery.
          */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Optional, and not kept. It helps identify the product and is discarded once
            the check is done. JPEG, PNG, or WebP, up to 5 MB.
          </p>
          {imageProblem && <p className="text-xs text-red-600 dark:text-red-400">{imageProblem}</p>}
        </div>

        <Button
          type="submit"
          loading={pending}
          disabled={job.isWaiting || imageProblem !== null || form.name.trim().length < 2}
        >
          Check the catalogue
        </Button>

        {job.isWaiting && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A check is already running. It will appear above when it finishes, rather
            than starting a second one.
          </p>
        )}
      </form>

      {blockedProposal !== null && (
        /*
          X-05. The seller cannot start confirmation on a product they already have a
          submission out on, and this says where it got to rather than only refusing.
        */
        <PendingProposalNotice proposal={blockedProposal} />
      )}

      {candidates !== null && candidates.length > 0 && (
        <CandidateList
          candidates={candidates}
          selected={selected}
          onSelect={(candidate) => {
            setSelected(candidate);
            setBlockedProposal(null);
          }}
          onConfirm={confirmCandidate}
          confirming={confirming}
          productName={form.name.trim()}
        />
      )}
    </div>
  );
}

/**
 * The candidates, and what a seller can do with them today.
 *
 * Selecting one carries it into confirmation, where the seller answers questions about
 * the unit they stock. There is no "none of these" control: a seller may not overrule
 * the match result to declare their product new, and a genuine difference surfaces as a
 * proposal during confirmation rather than as a second catalogue record.
 */
function CandidateList({
  candidates,
  selected,
  onSelect,
  onConfirm,
  confirming,
  productName,
}: {
  candidates: MatchCandidate[];
  selected: MatchCandidate | null;
  onSelect: (candidate: MatchCandidate) => void;
  onConfirm: (candidate: MatchCandidate) => void;
  confirming: boolean;
  productName: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">
          {candidates.length === 1
            ? 'This product is already in the catalogue'
            : 'These products are already in the catalogue'}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          You join the record that is already here rather than creating a second one for
          the same product. That is what keeps every buyer looking at one page with
          every seller on it.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => {
          const isSelected = selected?.product_id === candidate.product_id;

          return (
            <li key={candidate.product_id}>
              <Card
                className={`flex flex-col gap-3 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {candidate.primary_image_url ? (
                    <Image
                      src={candidate.primary_image_url}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                      No image
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{candidate.name}</p>
                    {/*
                      Relevance, described as relevance. This is not the confidence
                      score that drives peer review, which never leaves the server and
                      must never be shown or named on any screen.
                    */}
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {Math.round(candidate.match_score * 100)}% match to what you typed
                    </p>
                    <Link
                      href={`/products/${candidate.slug}`}
                      className="mt-1 inline-block text-sm underline"
                    >
                      View the product page
                    </Link>
                  </div>

                  <Button
                    size="sm"
                    variant={isSelected ? 'primary' : 'secondary'}
                    onClick={() => onSelect(candidate)}
                  >
                    {isSelected ? 'Selected' : 'This is mine'}
                  </Button>
                </div>

                {isSelected && (
                  <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Next you answer a few questions about the unit you stock. If your
                      answers match the record you are listed straight away. If any
                      differ, the sellers who already carry it review the difference
                      first, which is how the record stays accurate for everyone.
                    </p>
                    <div>
                      <Button
                        size="sm"
                        loading={confirming}
                        onClick={() => onConfirm(candidate)}
                      >
                        Confirm this product
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {/*
        No "none of these is mine" control, and its absence is deliberate rather than
        an omission. A seller may not overrule the match result to declare their
        product new, and the API refuses the wizard with `match_required` if they try.
        Offering the button would promise something the platform will not do.
      */}
      <Alert tone="info">
        <p>
          If none of these is {productName || 'your product'}, change the name to
          something closer to what is printed on the box and check again. A closer name
          finds a closer match, or none at all, and no match is what opens the new
          product wizard.
        </p>
      </Alert>
    </section>
  );
}
