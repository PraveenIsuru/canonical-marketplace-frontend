import Link from 'next/link';
import { getCategories, getProducts } from '@/lib/api/catalogue';
import { ProductCard } from '@/components/product/ProductCard';
import { Card, EmptyState } from '@/components/ui';

/**
 * S-01 Home.
 *
 * Static, revalidated hourly. The catalogue entry point, and the only page most
 * visitors see before searching.
 *
 * Fetched server side straight from Laravel, so the whole page can be prerendered and
 * served to anonymous and search engine traffic without resolving a session.
 */
export const revalidate = 3600;

export default async function HomePage() {
  // Both are independent, so they run concurrently rather than in series.
  const [recent, categories] = await Promise.all([
    getProducts({ perPage: 12, revalidate: 3600 }),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          One record per product. Every seller who carries it.
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Search once and see every seller stocking that exact product, sorted by how
          close they are to you, with their price and contact details.
        </p>

        <form action="/search" className="flex max-w-xl gap-2">
          <input
            type="search"
            name="q"
            placeholder="Search for a product"
            aria-label="Search for a product"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Search
          </button>
        </form>
      </section>

      {categories.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Browse by category</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/products?category=${encodeURIComponent(category.name)}`}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
              >
                {category.name}
                <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">{category.product_count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Card>
        <h2 className="mb-1 font-medium">No account needed to browse</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The full catalogue, every seller&apos;s contact details and address, and all
          product discussions are readable without signing in. An account is only
          needed to save a wishlist, post in a discussion, or sell.
        </p>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Recently added</h2>
          <Link href="/products" className="text-sm underline">
            See the whole catalogue
          </Link>
        </div>

        {recent.data.length === 0 ? (
          <EmptyState
            title="The catalogue is empty"
            description="No products have been listed yet. Sellers add the first record for a product when they list it."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recent.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
