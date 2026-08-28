import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalOverride } from './ProposalOverride';

export const metadata: Metadata = {
  title: 'Proposal',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function AdminProposalPage({ params }: Params) {
  const { id } = await params;

  const proposalId = Number(id);
  if (!Number.isInteger(proposalId) || proposalId < 1) notFound();

  return <ProposalOverride id={proposalId} />;
}
