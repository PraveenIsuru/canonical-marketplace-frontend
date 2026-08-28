'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminProposal,
  isForbidden,
  isProposalNotEscalated,
  resolveEscalation,
  type Decision,
} from '@/lib/api/admin-proposals';
import { queryKeys } from '@/lib/query/keys';
import { formatMoney } from '@/lib/format/money';
import { formatDateTime } from '@/lib/format/dates';
import { BlockedFor } from '@/components/admin/BlockedFor';
import { ResolutionReasonDetail, ResolutionReasonLabel } from '@/components/admin/ResolutionReason';
import { VoteList, VoteTally } from '@/components/admin/VoteTally';
import { ChangeComparison } from '@/components/proposal/ChangeComparison';
import { Alert, Button, Card, Dialog, Skeleton } from '@/components/ui';
import type { AdminDecisionResult, AdminProposalDetail } from '@/types/admin';

/**
 * S-33 Settling one escalation.
 *
 * The most consequential write an administrator makes. A seller has been unable to
 * trade since they submitted, and this is the only thing in the platform that ends
 * that.
 *
 * **Both outcomes unblock them, and the screen says so before and after the decision.**
 * What blocked the seller was an unresolved proposal, not an unfavourable one.
 * Approval releases the listing they were waiting on and writes a version; rejection
 * writes neither and releases them to start again. Copy anywhere on this screen that
 * described rejection as leaving them blocked would be wrong.
 *
 * **Nothing here reverses anything.** Overriding a decision that has already been made
 * is S-36 and a different endpoint, and mixing the two would put "this creates a
 * further version" copy in front of somebody whose decision creates the first one.
 *
 * There is no per field control, per invariant 4: a proposal is taken or left whole.
 */
export function EscalationDecision({ id }: { id: number }) {
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [outcome, setOutcome] = useState<AdminDecisionResult | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.proposal(id),
    queryFn: () => getAdminProposal(id),
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (decision: Decision) => resolveEscalation(id, decision),
    onSuccess: (result) => {
      setConfirming(null);
      setOutcome(result);

      // The queue this came from, and the row itself. Both are now wrong.
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.escalations() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.proposal(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.metrics() });
    },
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Breadcrumb />
        {isForbidden(error) ? (
          <Alert tone="error" title="This is an administrator screen">
            Your account is not an administrator.
          </Alert>
        ) : (
          <Alert tone="error" title="This proposal could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        )}
      </div>
    );
  }

  // Resolved in this session. The confirmation replaces the actions rather than sitting
  // above them, so there is no way to decide twice from the same screen.
  if (outcome !== null) {
    return <Resolved outcome={outcome} proposal={data} />;
  }

  /*
   * Somebody else reached it first. Not a failure and not styled as one: two
   * administrators working the same queue is ordinary, and what this needs is a
   * refresh rather than a retry.
   */
  if (decide.isError && isProposalNotEscalated(decide.error)) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Breadcrumb />
        <Alert tone="info" title="Another administrator settled this first">
          <p>
            It is no longer escalated, so there is nothing left to decide here. The
            seller is no longer blocked either way.
          </p>
          <p className="mt-3 flex flex-wrap gap-4">
            <Link href="/admin/escalations" className="underline">
              Back to the queue
            </Link>
            <Link href={`/admin/proposals/${id}`} className="underline">
              See what they decided
            </Link>
          </p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <Breadcrumb />

      <div>
        <h1 className="text-2xl font-semibold">{data.product.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Proposed by {data.store.name}
        </p>
      </div>

      <Alert tone="warning" title="A seller is waiting on this">
        <p>
          <BlockedFor openedAt={data.review_opens_at} className="font-semibold" />. {data.store.name}{' '}
          cannot list this product until you decide.{' '}
          <strong className="font-medium">Either decision ends the wait.</strong>
        </p>
      </Alert>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Why this reached you</h2>
        <p className="text-sm font-medium">
          <ResolutionReasonLabel reason={data.resolution_reason} />
        </p>
        <ResolutionReasonDetail reason={data.resolution_reason} />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Submitted {formatDateTime(data.review_opens_at)}, review closed{' '}
          {formatDateTime(data.review_closes_at)}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What it would change</h2>
        <Card>
          <ChangeComparison changes={data.changes} />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What the sellers said</h2>
        <VoteTally proposal={data} />
        <VoteList votes={data.votes} />
      </section>

      <IntendedListing proposal={data} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Decide</h2>

        {decide.isError && !isProposalNotEscalated(decide.error) && (
          <Alert tone="error" title="The decision could not be recorded">
            Nothing has changed. Try again, and if it keeps failing the seller stays
            blocked, so it is worth chasing.
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setConfirming('approve')} disabled={decide.isPending}>
            Accept the change
          </Button>
          <Button
            variant="secondary"
            onClick={() => setConfirming('reject')}
            disabled={decide.isPending}
          >
            Reject the change
          </Button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A proposal is taken or left as a whole. There is no way to accept part of one,
          and no screen offers it.
        </p>
      </section>

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'approve' ? 'Accept this change?' : 'Reject this change?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming === 'approve' ? 'primary' : 'danger'}
              loading={decide.isPending}
              onClick={() => confirming && decide.mutate(confirming)}
            >
              {confirming === 'approve' ? 'Accept' : 'Reject'}
            </Button>
          </>
        }
      >
        {confirming === 'approve' ? (
          <ApproveWarning proposal={data} />
        ) : (
          <RejectWarning proposal={data} />
        )}
      </Dialog>
    </div>
  );
}

/**
 * What approval will release.
 *
 * No attachment row exists while a proposal blocks a seller, so this is the listing
 * being withheld. Showing it before the decision is the difference between approving a
 * change and approving a change while knowing what goes on sale because of it.
 */
function IntendedListing({ proposal }: { proposal: AdminProposalDetail }) {
  if (proposal.intended_listing === null) return null;

  const { variant_ids, price_minor, currency } = proposal.intended_listing;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">What accepting would release</h2>
      <Card className="text-sm">
        <p>
          {proposal.store.name} would start carrying{' '}
          <strong className="font-medium">
            {variant_ids.length} {variant_ids.length === 1 ? 'combination' : 'combinations'}
          </strong>{' '}
          of this product at{' '}
          <strong className="font-medium">{formatMoney(price_minor, currency)}</strong>.
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          They recorded this when they submitted. It has been held back ever since, and
          that is what has been blocking them.
        </p>
      </Card>
    </section>
  );
}

function ApproveWarning({ proposal }: { proposal: AdminProposalDetail }) {
  return (
    <>
      <p>
        The change is applied to the shared record and a new version is written,
        attributed to {proposal.store.name} because the change is theirs.
      </p>
      <p className="mt-2">
        Their withheld listing is created and they can trade again immediately.
      </p>
      <p className="mt-2">
        Every seller carrying this product sees the corrected record from that moment.
      </p>
    </>
  );
}

function RejectWarning({ proposal }: { proposal: AdminProposalDetail }) {
  return (
    <>
      <p>
        The record is left exactly as it is. No version is written and no listing is
        created.
      </p>
      <p className="mt-2">
        <strong className="font-medium">{proposal.store.name} is unblocked anyway</strong>{' '}
        and can submit a fresh attempt straight away. What was stopping them was the
        unanswered question, not the answer.
      </p>
    </>
  );
}

/**
 * The confirmation, which has to be explicit about the thing most easily got wrong.
 *
 * `seller_unblocked` comes back true on both outcomes, and the copy keys off it rather
 * than off which button was pressed, so the two can never disagree.
 */
function Resolved({
  outcome,
  proposal,
}: {
  outcome: AdminDecisionResult;
  proposal: AdminProposalDetail;
}) {
  const approved = outcome.status === 'approved';

  return (
    <div className="flex flex-col gap-6 py-8">
      <Breadcrumb />

      <Alert tone="success" title={approved ? 'Accepted' : 'Rejected'}>
        <p>
          {approved
            ? 'The record is updated and every seller carrying this product now sees the corrected version.'
            : 'The record is unchanged. Nothing was written to the catalogue.'}
        </p>

        {outcome.seller_unblocked && (
          <p className="mt-2">
            <strong className="font-medium">{proposal.store.name} is no longer blocked.</strong>{' '}
            {approved
              ? `Their listing has been created${
                  outcome.attachments_created === 1
                    ? ''
                    : ` across ${outcome.attachments_created} combinations`
                }.`
              : 'They can submit a fresh attempt whenever they like.'}
          </p>
        )}

        <p className="mt-2 text-xs">
          {outcome.version_number === null
            ? 'No version was written, because nothing about the record changed.'
            : `Written as version ${outcome.version_number}.`}{' '}
          Decided {formatDateTime(outcome.resolved_at)}.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin/escalations" className="underline">
          Back to the queue
        </Link>
        <Link href={`/versions/${proposal.product.slug}`} className="underline">
          Record history
        </Link>
        <Link href={`/admin/proposals/${proposal.id}`} className="underline">
          This proposal
        </Link>
      </div>
    </div>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500 dark:text-zinc-400">
      <Link href="/admin/escalations" className="underline">
        Escalations
      </Link>
    </nav>
  );
}
