'use client';

import Link from 'next/link';
import { Alert } from '@/components/ui';
import { formatDate, timeRemaining } from '@/lib/format/dates';
import type { BlockedProposal } from '@/types/confirmation';

interface Props {
  proposal: BlockedProposal;
  /** Off on the listings screen, where the product name is already the heading. */
  showProduct?: boolean;
}

/**
 * X-05 Pending proposal notice.
 *
 * Rendered on the dashboard, the listings screen, and the attachment entry screen. It
 * exists because a blocked product has **no attachment row at all**, so without it a
 * seller who submitted an answer the record disagreed with would see nothing anywhere
 * and conclude their submission had vanished.
 *
 * Deliberately not styled as an error. The seller did nothing wrong: they described
 * their unit, it differed from what the catalogue says, and the sellers who carry the
 * product are now checking. That is the platform working, and red would say otherwise.
 *
 * No confidence score appears here. The proposing seller does not get to see how the
 * AI scored them any more than a reviewer does.
 *
 * The detail stays inline as well as linked. M7 gave this a real destination at
 * `/proposals/{id}`, but a seller who sees this on their dashboard should not have to
 * navigate to learn what is under review and when it closes. The link is for the
 * vote count and the decision, which are the parts that change.
 */
export function PendingProposalNotice({ proposal, showProduct = true }: Props) {
  const isEscalated = proposal.status === 'escalated';
  const remaining = isEscalated ? null : timeRemaining(proposal.review_closes_at);

  return (
    <Alert
      tone="info"
      title={
        isEscalated
          ? 'This is waiting on an administrator'
          : 'Other sellers are reviewing your answers'
      }
    >
      {showProduct && (
        <p className="font-medium">
          <Link href={`/products/${proposal.product.slug}`} className="underline">
            {proposal.product.name}
          </Link>
        </p>
      )}

      <p className="mt-1">
        {isEscalated
          ? 'The review window closed without enough votes, so an administrator is deciding. There is no deadline on that step.'
          : 'You described this product differently from the catalogue, so the sellers who already carry it are checking before the record changes.'}
      </p>

      {/*
        Only for a pending proposal. An escalated one has no deadline, and showing a
        date that has already passed would read as something having gone wrong.
      */}
      {!isEscalated && (
        <p className="mt-2 text-sm">
          Review closes <strong>{formatDate(proposal.review_closes_at)}</strong>
          {remaining !== null && <>, about {remaining} from now</>}.
        </p>
      )}

      {proposal.changed_fields.length > 0 && (
        /*
          Naming the fields turns "something is being reviewed" into something the
          seller can actually recognise, and reassures them the rest of their answers
          agreed with the record.
        */
        <p className="mt-2 text-sm">
          Under review: {proposal.changed_fields.join(', ')}.
        </p>
      )}

      <p className="mt-2 text-sm">
        You cannot list this product until the review finishes. Nothing you entered has
        been lost.
      </p>

      <p className="mt-2 text-sm">
        <Link href={`/proposals/${proposal.proposal_id}`} className="underline">
          {isEscalated ? 'See where it got to' : 'See how the review is going'}
        </Link>
      </p>
    </Alert>
  );
}
