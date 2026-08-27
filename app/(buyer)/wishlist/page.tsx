import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WishlistPanel } from './WishlistPanel';

export const metadata: Metadata = {
  title: 'Your wishlist',
  robots: { index: false, follow: false },
};

/*
 * `useSearchParams` needs a Suspense boundary above it, otherwise the whole route opts
 * out of static rendering at build time.
 */
export default function WishlistPage() {
  return (
    <Suspense fallback={null}>
      <WishlistPanel />
    </Suspense>
  );
}
