import type { Metadata } from 'next';
import { PlatformSnapshot } from './PlatformSnapshot';

export const metadata: Metadata = {
  title: 'Metrics',
  robots: { index: false, follow: false },
};

export default function MetricsPage() {
  return <PlatformSnapshot />;
}
