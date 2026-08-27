import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/api/catalogue';
import { VerificationFlow } from './VerificationFlow';

export const metadata: Metadata = {
  title: 'Prove you own this',
  // Authenticated and personal. Nothing here belongs in an index.
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ slug: string }> };

/** Next 16: route params arrive as a Promise and must be awaited. */
export default async function VerifyPage({ params }: Params) {
  const { slug } = await params;

  /*
   * The product name is fetched server side so the screen can address the buyer about
   * a specific thing rather than "this product". A public read, so it needs no token.
   */
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return <VerificationFlow slug={slug} productName={product.name} />;
}
