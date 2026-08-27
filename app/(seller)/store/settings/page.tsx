import type { Metadata } from 'next';
import { StoreSettingsForm } from './StoreSettingsForm';

export const metadata: Metadata = {
  title: 'Store settings',
  robots: { index: false, follow: false },
};

/** S-19 Store settings. */
export default function StoreSettingsPage() {
  return <StoreSettingsForm />;
}
