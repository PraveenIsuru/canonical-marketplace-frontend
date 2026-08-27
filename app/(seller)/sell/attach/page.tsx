import type { Metadata } from 'next';
import { MatchPanel } from './MatchPanel';

export const metadata: Metadata = {
  title: 'List a product',
  // Authenticated, and never indexed. The indexing rules cover the public group only.
  robots: { index: false, follow: false },
};

export default function AttachPage() {
  return <MatchPanel />;
}
