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
    /*
     * Canonical points at the product page, not at this URL.
     *
     * This screen shows the same seller list the product page already carries, in more
     * detail. Two indexable URLs describing one product compete with each other, and
     * the one that should win is the static, revalidated page rather than a
     * force-dynamic route that a crawler cannot cache.
     */
    alternates: { canonical: `/products/${slug}` },
    /*
     * Not indexed, per section 6.2, which names `/products/[slug]`,
     * `/products/[slug]/community`, and `/stores/[id]` as the indexable product family
     * and does not include this one.
     *
     * `follow` stays true. The point of not indexing a duplicate is to stop it ranking,
     * not to hide the seller and store links on it, which are how a crawler reaches
     * store pages that are indexable.
     */
    robots: { index: false, follow: true },
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
  const [variants, initialSellers] = await Promise.all([
    getVariants(slug),
    /*
     * Uncached, stated rather than inherited. `force-dynamic` governs how the route is
     * rendered, not whether an individual fetch is cached, so without this the shared
     * list would still be served from the data cache and this screen would show a price
     * up to five minutes old. That is acceptable on S-04, where the list is a preview.
     * It is not acceptable here, where the list is the screen.
     */
    getSellers(slug, { revalidate: 0 }),
  ]);

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
