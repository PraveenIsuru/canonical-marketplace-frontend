import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProductSearch } from './ProductSearch';

export const metadata: Metadata = {
  title: 'Products',
  robots: { index: false, follow: false },
};

export default function AdminProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductSearch />
    </Suspense>
  );
}
