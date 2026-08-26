import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getSellers, getVariants } from '@/lib/api/catalogue';
import { SellerListPanel } from '@/components/seller/SellerListPanel';

/**
 * S-05 Full seller list.
 *
 * Server rendered per request and never cached at the page level. The ordering depends
 * on the buyer's coordinates, and price and availability change independently of the
 * version chain, so there is no invalidation signal that would make caching safe.
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  return {
    title: product ? `Sellers of ${product.name}` : 'Sellers',
    alternates: { canonical: `/products/${slug}/sellers` },
  };
}

export default async function SellersPage({ params }: Params) {
  const { slug } = await params;

  const product = await getProduct(slug);
  if (!product) notFound();

  /*
   * The unfiltered list is fetched here rather than only in the client panel, so an
   * anonymous visitor gets seller contact details in the server rendered HTML. That is
   * the point of this screen, and it should not depend on JavaScript running.
   */
  const [variants, initialSellers] = await Promise.all([getVariants(slug), getSellers(slug)]);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/products" className="underline">
          Catalogue
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/products/${product.slug}`} className="underline">
          {product.name}
        </Link>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">Sellers of {product.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Contact any seller directly. Prices and stock are set by each of them.
        </p>
      </div>

      <SellerListPanel
        slug={product.slug}
        variants={variants}
        initialSellers={initialSellers.data}
        initialMeta={initialSellers.meta}
      />
    </div>
  );
}
