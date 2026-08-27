import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalDetailPanel } from './ProposalDetailPanel';

export const metadata: Metadata = {
  title: 'Proposal',
  robots: { index: false, follow: false },
};

/** Next 16: route params arrive as a Promise and must be awaited. */
export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);

  // A non numeric id is not a proposal that could exist, so it never reaches the API.
  if (!Number.isInteger(numeric) || numeric < 1) {
    notFound();
  }

  return <ProposalDetailPanel id={numeric} />;
}
