import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductEditor } from './ProductEditor';

export const metadata: Metadata = {
  title: 'Edit product',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

/*
 * Keyed by id rather than slug, unlike every public product route. A slug is a public
 * address derived from a name, and the name may be the thing being corrected.
 */
export default async function EditProductPage({ params }: Params) {
  const { id } = await params;

  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) notFound();

  return <ProductEditor id={productId} />;
}
