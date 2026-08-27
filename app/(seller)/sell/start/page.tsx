import type { Metadata } from 'next';
import { StoreRegistrationForm } from './StoreRegistrationForm';

export const metadata: Metadata = {
  title: 'Start selling',
  robots: { index: false, follow: false },
};

/** S-17 Store registration. */
export default function StartSellingPage() {
  return <StoreRegistrationForm />;
}
