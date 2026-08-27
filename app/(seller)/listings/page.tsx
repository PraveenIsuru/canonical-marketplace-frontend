import type { Metadata } from 'next';
import { ListingsPanel } from './ListingsPanel';

export const metadata: Metadata = {
  title: 'Your listings',
  robots: { index: false, follow: false },
};

export default function ListingsPage() {
  return <ListingsPanel />;
}
