import type { Metadata } from 'next';
import { SellerDashboard } from './SellerDashboard';

export const metadata: Metadata = {
  title: 'Seller dashboard',
  robots: { index: false, follow: false },
};

/** S-20 Seller dashboard, in its empty state. */
export default function DashboardPage() {
  return <SellerDashboard />;
}
