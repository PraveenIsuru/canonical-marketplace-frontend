import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { VersionSnapshotPanel } from './VersionSnapshotPanel';

export const metadata: Metadata = {
  title: 'Version',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ slug: string; number: string }> };

export default async function VersionPage({ params }: Params) {
  const { slug, number } = await params;

  const versionNumber = Number(number);

  /*
   * A version number that is not a positive whole number never existed, so this is the
   * not found boundary rather than a request the API would refuse. It also keeps a
   * junk segment from reaching the endpoint as a URL fragment.
   */
  if (!Number.isInteger(versionNumber) || versionNumber < 1) notFound();

  return <VersionSnapshotPanel slug={slug} versionNumber={versionNumber} />;
}
