import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MyProposalsPanel } from './MyProposalsPanel';

export const metadata: Metadata = {
  title: 'Your proposals',
  robots: { index: false, follow: false },
};

/*
 * `useSearchParams` needs a Suspense boundary above it, otherwise the whole route
 * opts out of static rendering at build time.
 */
export default function MyProposalsPage() {
  return (
    <Suspense fallback={null}>
      <MyProposalsPanel />
    </Suspense>
  );
}
