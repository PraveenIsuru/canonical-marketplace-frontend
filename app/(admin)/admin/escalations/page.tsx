import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EscalationQueue } from './EscalationQueue';

export const metadata: Metadata = {
  title: 'Escalations',
  robots: { index: false, follow: false },
};

/*
 * `useSearchParams` needs a Suspense boundary above it, otherwise the whole route opts
 * out of static rendering at build time.
 */
export default function EscalationsPage() {
  return (
    <Suspense fallback={null}>
      <EscalationQueue />
    </Suspense>
  );
}
