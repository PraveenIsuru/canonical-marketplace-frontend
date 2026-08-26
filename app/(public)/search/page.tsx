import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { searchProducts } from '@/lib/api/catalogue';
import { ProductCard } from '@/components/product/ProductCard';
import { KeywordFallbackNotice } from '@/components/search/KeywordFallbackNotice';
import { SearchForm } from '@/components/search/SearchForm';
import { EmptyState, Pagination, SkeletonGrid } from '@/components/ui';

/**
 * S-03 Search results.
 *
 * Server rendered per request: the query and page vary endlessly, so there is nothing
 * worth prerendering and no invalidation signal that would make caching safe.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search',
  /*
   * Deliberately kept out of the index. Query permutations produce an unbounded set of
   * low value pages, and a crawler filling its budget on them would find fewer of the
   * product pages that are actually worth indexing.
   */
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  // Promises in Next 16, so they must be awaited.
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const category = params.category;
  const page = Number(params.page) || 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Search</h1>
        <SearchForm initialQuery={query} />
      </div>

      {query === '' ? (
        /*
         * No request is made for an empty query. The API requires `q` and would answer
         * 422, so calling it would turn "you have not searched yet" into an error the
         * visitor did nothing to cause.
         */
        <EmptyState
          title="What are you looking for?"
          description="Search by product name, or describe what you need in your own words."
          action={
            <Link href="/products" className="text-sm underline">
              Or browse the whole catalogue
            </Link>
          }
        />
      ) : (
        <Suspense key={`${query}|${category}|${page}`} fallback={<SearchSkeleton />}>
          <SearchResults query={query} category={category} page={page} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * The streamed half.
 *
 * A Suspense boundary inside the page rather than a loading.tsx beside it, so the
 * boundary is scoped to this page and cannot make a sibling route start streaming.
 */
async function SearchResults({
  query,
  category,
  page,
}: {
  query: string;
  category?: string;
  page: number;
}) {
  const results = await searchProducts(query, { category, page });

  /*
   * The one thing that drives the notice.
   *
   * Read straight from the response body. Not inferred from an empty result set, not
   * from a timeout, not from anything the client noticed on its own.
   */
  const degraded = results.mode === 'keyword';

  return (
    <div className="flex flex-col gap-5">
      {degraded && <KeywordFallbackNotice />}

      {results.data.length === 0 ? (
        /*
         * Two different empty states, deliberately.
         *
         * In keyword mode the notice above is still showing, so the visitor sees both
         * "search is degraded" and "nothing matched" and can tell which explains their
         * result. In AI mode nothing has failed, so the copy must not imply it has.
         */
        degraded ? (
          <EmptyState
            title={`No keyword matches for "${query}"`}
            description="Smart search would normally understand a phrase like this. While it is unavailable, try a shorter, more specific term such as a product or brand name."
            action={
              <Link href="/products" className="text-sm underline">
                Browse the catalogue instead
              </Link>
            }
          />
        ) : (
          <EmptyState
            title={`Nothing matched "${query}"`}
            description="No products in the catalogue match that. Try different words, or browse by category."
            action={
              <Link href="/products" className="text-sm underline">
                Browse the catalogue
              </Link>
            }
          />
        )
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            {results.meta.total} {results.meta.total === 1 ? 'result' : 'results'} for{' '}
            <span className="font-medium">{query}</span>
            {category ? ` in ${category}` : ''}
          </p>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.data.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination
            meta={results.meta}
            hrefFor={(target) =>
              `/search?${new URLSearchParams({
                q: query,
                ...(category ? { category } : {}),
                ...(target > 1 ? { page: String(target) } : {}),
              })}`
            }
          />
        </>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Searching">
      <SkeletonGrid count={8} />
    </div>
  );
}
