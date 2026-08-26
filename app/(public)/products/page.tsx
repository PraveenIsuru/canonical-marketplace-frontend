import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { getCategories, getProducts } from '@/lib/api/catalogue';
import { ProductCard } from '@/components/product/ProductCard';
import { EmptyState, SkeletonGrid } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Browse every product on the marketplace, with prices from nearby sellers.',
};

/**
 * S-02 Catalogue browse.
 *
 * Server rendered per request, because the category and page parameters vary and
 * prerendering every permutation would cache far more pages than anyone visits.
 *
 * The filter lives in the URL rather than in component state, so the page is
 * shareable and the browser back button behaves.
 */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  // Route params are Promises in Next 16 and must be awaited.
  const params = await searchParams;
  const category = params.category;
  const page = Number(params.page) || 1;

  /*
   * The product list is passed down unawaited so the shell paints immediately and the
   * grid streams in.
   *
   * Deliberately a Suspense boundary inside the page rather than a loading.tsx beside
   * it. A segment level loading.tsx applies to every nested route too, which would
   * make /products/[slug] start streaming before its page component runs, and a
   * notFound() after streaming has begun can only produce a soft 404 with a 200
   * status. That is a page a crawler will happily index.
   */
  const productsPromise = getProducts({ category, page });
  const categories = await getCategories();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Catalogue</h1>
        {category && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Filtered to {category}</p>
        )}
      </div>

      <nav aria-label="Categories" className="flex flex-wrap gap-2">
        <Link
          href="/products"
          aria-current={category === undefined ? 'true' : undefined}
          className={chipClass(category === undefined)}
        >
          All
        </Link>
        {categories.map((entry) => (
          <Link
            key={entry.name}
            href={`/products?category=${encodeURIComponent(entry.name)}`}
            aria-current={category === entry.name ? 'true' : undefined}
            className={chipClass(category === entry.name)}
          >
            {entry.name}
            <span className="ml-1.5 opacity-60">{entry.product_count}</span>
          </Link>
        ))}
      </nav>

      <Suspense fallback={<SkeletonGrid count={8} />}>
        <CatalogueGrid productsPromise={productsPromise} category={category} />
      </Suspense>

    </div>
  );
}

/** The streamed half: the grid and its pagination. */
async function CatalogueGrid({
  productsPromise,
  category,
}: {
  productsPromise: ReturnType<typeof getProducts>;
  category?: string;
}) {
  const products = await productsPromise;

  if (products.data.length === 0) {
    return category ? (
      <EmptyState
        title={`Nothing in ${category} yet`}
        description="No products have been listed in this category."
        action={
          <Link href="/products" className="text-sm underline">
            Clear the filter
          </Link>
        }
      />
    ) : (
      <EmptyState title="The catalogue is empty" description="No products have been listed yet." />
    );
  }

  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {products.meta.total} {products.meta.total === 1 ? 'product' : 'products'}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <Pagination
        meta={products.meta}
        hrefFor={(target) =>
          `/products?${new URLSearchParams({
            ...(category ? { category } : {}),
            ...(target > 1 ? { page: String(target) } : {}),
          })}`
        }
      />
    </>
  );
}

function chipClass(active: boolean): string {
  return [
    'rounded-full border px-3 py-1.5 text-sm transition-colors',
    active
      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
      : 'border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500',
  ].join(' ');
}
