import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EscalationDecision } from './EscalationDecision';

export const metadata: Metadata = {
  title: 'Escalation',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

export default async function EscalationPage({ params }: Params) {
  const { id } = await params;

  const proposalId = Number(id);

  // A junk segment never named a proposal, so this is the not found boundary rather
  // than a request the API would refuse.
  if (!Number.isInteger(proposalId) || proposalId < 1) notFound();

  return <EscalationDecision id={proposalId} />;
}
