'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminProposal,
  isForbidden,
  isProposalNotResolved,
  overrideProposal,
  type Decision,
} from '@/lib/api/admin-proposals';
import { getVersions } from '@/lib/api/versions';
import { queryKeys } from '@/lib/query/keys';
import { formatDateTime } from '@/lib/format/dates';
import { ResolutionReasonLabel } from '@/components/admin/ResolutionReason';
import { VoteList, VoteTally } from '@/components/admin/VoteTally';
import { ChangeComparison } from '@/components/proposal/ChangeComparison';
import { Alert, Button, Card, Dialog, Skeleton } from '@/components/ui';
import type { AdminDecisionResult, AdminProposalDetail } from '@/types/admin';

/**
 * S-36 Reversing a decision that has already been made.
 *
 * **This is not an undo, and the screen never calls it one.** Reversing an approval
 * writes a **further version**, removes nothing, and leaves the reversed version in the
 * chain where it was. The record moves forward to a state resembling the one before it;
 * it does not move backwards.
 *
 * Two things deliberately survive a reversal, and the confirmation says both:
 *
 *  - **Attribute options the approval added, and every combination generated from
 *    them.** Invariant 2 forbids removing a combination, so a reversal that stranded
 *    them could never be cleaned up.
 *  - **The proposing seller's attachment.** Reversing a claim about what a product *is*
 *    says nothing about whether that shop stocks it.
 *
 * Settling an escalation is a different endpoint on a different screen (S-33). This one
 * refuses anything that has not been decided yet, and says which screen wants it.
 */
export function ProposalOverride({ id }: { id: number }) {
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [outcome, setOutcome] = useState<AdminDecisionResult | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.proposal(id),
    queryFn: () => getAdminProposal(id),
    retry: false,
  });

  /*
   * The product's version chain, used only to warn that changes have landed since this
   * decision. EP-59 carries no version number of its own, so the proposal's version
   * cannot be named; what can be said honestly is that versions exist which were
   * written later, and a reversal will not touch them.
   */
  const versions = useQuery({
    queryKey: queryKeys.products.versions(data?.product.slug ?? ''),
    queryFn: () => getVersions(data!.product.slug),
    enabled: data !== undefined,
    retry: false,
  });

  const override = useMutation({
    mutationFn: (decision: Decision) => overrideProposal(id, decision),
    onSuccess: (result) => {
      setConfirming(null);
      setOutcome(result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.proposal(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.proposals() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.metrics() });
      if (data) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.products.versions(data.product.slug),
        });
      }
    },
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
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

  if (outcome !== null) {
    return <Overridden outcome={outcome} proposal={data} />;
  }

  const isResolved = data.status === 'approved' || data.status === 'rejected';

  /*
   * The decision that corresponds to the outcome the proposal already holds.
   *
   * The two vocabularies deliberately differ: a status is `approved`, a decision is
   * `approve`. Comparing them directly would silently be false forever and put the
   * reversal warning in front of somebody who asked to let the decision stand.
   */
  const standingDecision: Decision = data.status === 'approved' ? 'approve' : 'reject';

  // Versions written after this decision. A reversal moves the record forward from
  // wherever it is now, so anything landed since stays.
  const laterVersions =
    data.resolved_at === null
      ? []
      : (versions.data?.data ?? []).filter(
          (version) => Date.parse(version.created_at) > Date.parse(data.resolved_at!),
        );

  return (
    <div className="flex flex-col gap-6 py-8">
      <Breadcrumb />

      <div>
        <h1 className="text-2xl font-semibold">{data.product.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Proposed by {data.store.name} · currently{' '}
          <strong className="font-medium">{statusLabel(data.status)}</strong>
        </p>
      </div>

      {!isResolved && (
        <Alert tone="info" title="Nobody has decided this yet">
          <p>
            There is nothing to reverse. A proposal has to have been accepted or rejected
            before a decision can be overridden.
          </p>
          {data.status === 'escalated' && (
            <p className="mt-2">
              This one is escalated, which means it is waiting on an administrator.{' '}
              <Link href={`/admin/escalations/${data.id}`} className="underline">
                Settle it instead
              </Link>
              .
            </p>
          )}
          {data.status === 'pending' && (
            <p className="mt-2">
              It is still with the reviewers until {formatDateTime(data.review_closes_at)}.
            </p>
          )}
        </Alert>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">What was decided</h2>
        <p className="text-sm">
          <ResolutionReasonLabel reason={data.resolution_reason} />
          {data.resolved_at !== null && <> · {formatDateTime(data.resolved_at)}</>}
        </p>
        {/*
          Administrator to administrator only. This screen is behind the admin gate,
          which is the one place naming them is right; no seller facing screen does.
        */}
        {data.resolved_by !== null && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Settled by {data.resolved_by.name}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What it changed</h2>
        <Card>
          <ChangeComparison changes={data.changes} />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">What the sellers said</h2>
        <VoteTally proposal={data} />
        <VoteList votes={data.votes} />
      </section>

      {isResolved && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Reverse this decision</h2>

          <Alert tone="warning" title="Reversing writes a further version">
            <p>
              Nothing is deleted and no version leaves the chain. The record moves{' '}
              <strong className="font-medium">forward</strong> to a state resembling the
              one before this decision, and the version count goes up rather than down.
            </p>
            <p className="mt-2">
              This is not an undo and cannot be used as one. To go back again, reverse
              the reversal, which writes another version on top.
            </p>
          </Alert>

          {laterVersions.length > 0 && (
            <Alert
              tone="warning"
              title={`${laterVersions.length} ${laterVersions.length === 1 ? 'version has' : 'versions have'} been written since`}
            >
              <p>
                The record has changed since this decision. A reversal will not touch
                those later changes, so the result will not be the record as it stood
                back then.
              </p>
              <p className="mt-2">
                <Link href={`/versions/${data.product.slug}`} className="underline">
                  Read the history first
                </Link>
              </p>
            </Alert>
          )}

          {override.isError && isProposalNotResolved(override.error) && (
            <Alert tone="info" title="This is no longer a resolved proposal">
              Somebody changed it while this screen was open. Reload to see where it
              stands.
            </Alert>
          )}

          {override.isError && !isProposalNotResolved(override.error) && (
            <Alert tone="error" title="The override could not be recorded">
              Nothing has changed.
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant={data.status === 'approved' ? 'danger' : 'primary'}
              onClick={() => setConfirming(standingDecision === 'approve' ? 'reject' : 'approve')}
              disabled={override.isPending}
            >
              {data.status === 'approved' ? 'Reverse to rejected' : 'Reverse to accepted'}
            </Button>

            {/*
              Requesting the outcome it already holds. Allowed by the endpoint and worth
              offering: it records that an administrator looked and let the decision
              stand, which is more useful than a review that leaves no trace.
            */}
            <Button
              variant="secondary"
              onClick={() => setConfirming(standingDecision)}
              disabled={override.isPending}
            >
              Let it stand
            </Button>
          </div>
        </section>
      )}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === standingDecision ? 'Let this decision stand?' : 'Reverse this decision?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming === standingDecision ? 'primary' : 'danger'}
              loading={override.isPending}
              onClick={() => confirming && override.mutate(confirming)}
            >
              {confirming === standingDecision ? 'Let it stand' : 'Reverse'}
            </Button>
          </>
        }
      >
        {confirming === standingDecision ? (
          <p>
            Nothing about the record changes. This records that you reviewed the decision
            and agreed with it.
          </p>
        ) : (
          <ReversalWarning proposal={data} to={confirming} />
        )}
      </Dialog>
    </div>
  );
}

function ReversalWarning({
  proposal,
  to,
}: {
  proposal: AdminProposalDetail;
  to: Decision | null;
}) {
  if (to === 'approve') {
    return (
      <>
        <p>
          The change is applied and a new version is written, attributed to{' '}
          {proposal.store.name} because the change is theirs.
        </p>
        <p className="mt-2">Their withheld listing is created.</p>
      </>
    );
  }

  return (
    <>
      <p>
        A <strong className="font-medium">further version</strong> is written, marked as
        an administrator edit, putting the values back as they were. The version this
        reverses stays in the chain.
      </p>
      <p className="mt-2">Two things are left alone deliberately:</p>
      <ul className="mt-1 list-disc pl-5">
        <li>
          Any attribute options this approval added, and every combination generated from
          them. Combinations are never removed, by anybody.
        </li>
        <li>
          {proposal.store.name}&apos;s listing. Reversing a claim about what the product
          is says nothing about whether they stock it.
        </li>
      </ul>
    </>
  );
}

function Overridden({
  outcome,
  proposal,
}: {
  outcome: AdminDecisionResult;
  proposal: AdminProposalDetail;
}) {
  return (
    <div className="flex flex-col gap-6 py-8">
      <Breadcrumb />

      <Alert tone="success" title={`Now ${statusLabel(outcome.status)}`}>
        <p>
          {outcome.version_number === null
            ? 'No version was written, because nothing about the record changed.'
            : `Written as version ${outcome.version_number}. Nothing was removed: the chain is one version longer than it was.`}
        </p>
        {outcome.attachments_created > 0 && (
          <p className="mt-2">
            {proposal.store.name}&apos;s withheld listing has been created.
          </p>
        )}
        <p className="mt-2 text-xs">Recorded {formatDateTime(outcome.resolved_at)}.</p>
      </Alert>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/versions/${proposal.product.slug}`} className="underline">
          Record history
        </Link>
        <Link href="/admin/products" className="underline">
          Products
        </Link>
        <Link href="/admin/escalations" className="underline">
          Escalations
        </Link>
      </div>
    </div>
  );
}

function statusLabel(status: AdminProposalDetail['status']): string {
  return {
    pending: 'with the reviewers',
    approved: 'accepted',
    rejected: 'rejected',
    escalated: 'escalated',
  }[status];
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500 dark:text-zinc-400">
      <Link href="/admin/products" className="underline">
        Administration
      </Link>
    </nav>
  );
}
