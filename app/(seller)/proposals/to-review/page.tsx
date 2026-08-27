import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToReviewPanel } from '../ToReviewPanel';

export const metadata: Metadata = {
  title: 'Reviews waiting on you',
  robots: { index: false, follow: false },
};

export default function ToReviewPage() {
  return (
    <Suspense fallback={null}>
      <ToReviewPanel />
    </Suspense>
  );
}
