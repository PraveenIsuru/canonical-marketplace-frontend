import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AnalyticsPanel } from './AnalyticsPanel';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

/*
 * `useSearchParams` needs a Suspense boundary above it, otherwise the whole route
 * opts out of static rendering at build time.
 *
 * The date range lives in the URL rather than in component state so a seller can
 * bookmark a period or send it to somebody, and so the back button moves between
 * ranges the way it moves between pages.
 */
export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPanel />
    </Suspense>
  );
}
