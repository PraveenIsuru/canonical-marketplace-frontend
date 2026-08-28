import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VersionHistoryPanel } from './VersionHistoryPanel';

export const metadata: Metadata = {
  title: 'Record history',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ slug: string }> };

/*
 * Route params are Promises in Next.js 16 and must be awaited.
 *
 * This does not live under `/products/[slug]/versions`, and that is not cosmetic. The
 * proxy matcher deliberately excludes `products` so public catalogue traffic never
 * resolves a session, and a protected page under that prefix would inherit the
 * exclusion and lose its login redirect.
 */
export default async function VersionHistoryPage({ params }: Params) {
  const { slug } = await params;

  return (
    <Suspense fallback={null}>
      <VersionHistoryPanel slug={slug} />
    </Suspense>
  );
}
