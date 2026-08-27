'use client';

import Link from 'next/link';
import { Alert, Card } from '@/components/ui';
import { formatDate, timeRemaining } from '@/lib/format/dates';
import type { ConfirmationOutcome } from '@/types/confirmation';

interface Props {
  outcome: ConfirmationOutcome;
  productName: string;
  productSlug: string | null;
}

/**
 * What the seller sees once EP-22 has answered.
 *
 * Two outcomes, both arriving as 201, told apart by `outcome` and nothing else. The
 * switch below is exhaustive over the discriminated union, so a third outcome added to
 * the contract later would fail to compile rather than fall through to a blank screen.
 *
 * **Neither of these is an error.** The proposal branch in particular is the platform
 * doing exactly what it exists to do: the seller described something the record does
 * not say, and the sellers who carry it are checking before it changes. It is rendered
 * in the same register as the success, not in red.
 */
export function ConfirmationOutcomePanel({ outcome, productName, productSlug }: Props) {
  if (outcome.outcome === 'attached') {
    return (
      <div className="flex flex-col gap-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold">You are now listing {productName}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your answers matched the record, so there was nothing to review and you were
            added straight away.
          </p>
        </div>

        <Alert tone="success" title="Buyers can find you on this product">
          Your store appears in the seller list for {productName}, alongside everyone
          else who carries it.
        </Alert>

        <Card className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">
            {outcome.attachment_ids.length === 1
              ? 'One version listed'
              : `${outcome.attachment_ids.length} versions listed`}
          </span>
        </Card>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/listings" className="underline">
            See your listings
          </Link>
          {productSlug && (
            <Link href={`/products/${productSlug}`} className="underline">
              View the product page
            </Link>
          )}
          <Link href="/sell/attach" className="underline">
            List something else
          </Link>
        </div>
      </div>
    );
  }

  const remaining = timeRemaining(outcome.review_closes_at);

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        {/*
          Worded as a submission that has gone somewhere, not as a rejection. The
          seller answered honestly and the answer differed; that difference is the
          thing the platform is built to capture rather than a mistake to report.
        */}
        <h1 className="text-2xl font-semibold">Your answers are with the other sellers</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          You described {productName} differently from the catalogue, so the sellers who
          already carry it are checking before the record changes.
        </p>
      </div>

      <Alert tone="info" title="This is how the catalogue stays accurate">
        <p>
          Nobody edits a product record directly. A change comes from a seller who
          knows the product, and the other sellers who stock it review it. That is what
          is happening now.
        </p>
        <p className="mt-2 text-sm">
          Review closes <strong>{formatDate(outcome.review_closes_at)}</strong>
          {remaining !== null && <>, about {remaining} from now</>}.
        </p>
      </Alert>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">While it is under review</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You cannot list {productName} yet. That is not a penalty: the record is being
          decided, and listing against a description that may be about to change would
          put the wrong thing in front of buyers.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          It appears on your listings page as under review, so you can see where it got
          to. Anything else you sell is unaffected.
        </p>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/listings" className="underline">
          See your listings
        </Link>
        {productSlug && (
          <Link href={`/products/${productSlug}`} className="underline">
            View the product page
          </Link>
        )}
        <Link href="/sell/attach" className="underline">
          List something else
        </Link>
      </div>

      {/*
        No link to a proposal detail screen and no vote tally, because neither exists
        yet. Both need endpoints that land at M7, and inventing a route here would send
        the seller somewhere that is not there.
      */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        A page showing how the review is going, with the votes as they come in, is still
        being built.
      </p>
    </div>
  );
}
