import type { Metadata } from 'next';
import { ConfirmationFlow } from './ConfirmationFlow';

export const metadata: Metadata = {
  title: 'Confirm this product',
  // Authenticated, and never indexed.
  robots: { index: false, follow: false },
};

export default function ConfirmPage() {
  return <ConfirmationFlow />;
}
