import type { Metadata } from 'next';
import { PinPlacement } from './PinPlacement';

export const metadata: Metadata = {
  title: 'Place your store on the map',
  robots: { index: false, follow: false },
};

/** S-18 Manual pin placement. */
export default function PinPage() {
  return <PinPlacement />;
}
