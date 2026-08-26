import type { Metadata } from 'next';
import { AccountPanel } from './AccountPanel';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

/** S-16 Account. */
export default function AccountPage() {
  return <AccountPanel />;
}
