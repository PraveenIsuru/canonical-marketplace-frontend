'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminProducts } from '@/lib/api/admin-products';
import { isForbidden } from '@/lib/api/admin-proposals';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Card, EmptyState, Input, Pagination, Skeleton } from '@/components/ui';
import type { AdminProductSummary } from '@/types/admin';

/**
 * S-34 The administrator catalogue.
 *
 * Its purpose is narrow and worth stating: **reaching the edit screen without typing an
 * id.** Administrator product routes are keyed by id rather than slug, which is right
 * for editing a record whose name might be the thing being corrected, and unusable to
 * type from memory. This is the index that turns a name into one.
 *
 * The search is a plain name match rather than the buyer's relevance ranked catalogue
 * search. An administrator is finding one known record, not discovering something, and
 * a stale search index would be actively misleading about what exists.
 */
export function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const [term, setTerm] = useState(q);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.products(q || undefined, category || undefined, page),
    queryFn: () => getAdminProducts({ q: q || undefined, category: category || undefined, page }),
    retry: false,
  });

  function search(event: React.FormEvent) {
    event.preventDefault();

    const params = new URLSearchParams();
    if (term.trim() !== '') params.set('q', term.trim());
    if (category !== '') params.set('category', category);

    router.push(`/admin/products${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every record, whether or not anybody carries it. Find one to edit it directly.
        </p>
      </div>

      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Input
            label="Search by name"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Part of a product name"
          />
        </div>
        <Button type="submit">Search</Button>
        {q !== '' && (
          <Button type="button" variant="ghost" onClick={() => { setTerm(''); router.push('/admin/products'); }}>
            Clear
          </Button>
        )}
      </form>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {isError &&
        (isForbidden(error) ? (
          <Alert tone="error" title="This is an administrator screen">
            Your account is not an administrator.
          </Alert>
        ) : (
          <Alert tone="error" title="The catalogue could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        ))}

      {data && data.data.length === 0 && (
        <EmptyState
          title={q === '' ? 'There are no products yet' : `Nothing matches "${q}"`}
          description={
            q === ''
              ? 'The catalogue is empty. Records are created by sellers through the listing wizard.'
              : 'Try a shorter search. This matches on the product name only.'
          }
        />
      )}

      {data && data.data.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {data.data.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </ul>

          <Pagination
            meta={data.meta}
            hrefFor={(next) => {
              const params = new URLSearchParams();
              if (q !== '') params.set('q', q);
              if (category !== '') params.set('category', category);
              params.set('page', String(next));
              return `/admin/products?${params}`;
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * One record, with the counts that say whether it is healthy.
 *
 * A product with no sellers is not broken, and a product with no images is not either.
 * They are states worth seeing at a glance, which is why the numbers are here rather
 * than only on the detail.
 */
function ProductRow({ product }: { product: AdminProductSummary }) {
  return (
    <li>
      <Card className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/products/${product.id}/edit`} className="font-medium underline">
            {product.name}
          </Link>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{product.category}</p>

          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {product.seller_count === 0
              ? 'No sellers'
              : `${product.seller_count} ${product.seller_count === 1 ? 'seller' : 'sellers'}`}
            {' · '}
            {product.variant_count}{' '}
            {product.variant_count === 1 ? 'combination' : 'combinations'}
            {' · '}
            {product.image_count} {product.image_count === 1 ? 'image' : 'images'}
            {product.current_version_number !== null && (
              <> · version {product.current_version_number}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {/*
            Pending and escalated both set this. Either way a seller is blocked on this
            record right now, and an administrator about to edit it should know.
          */}
          {product.has_pending_proposal && (
            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              A seller is blocked on this
            </span>
          )}
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="text-sm underline"
          >
            Edit
          </Link>
          <Link
            href={`/products/${product.slug}`}
            className="text-xs text-zinc-500 underline dark:text-zinc-400"
          >
            Public page
          </Link>
        </div>
      </Card>
    </li>
  );
}
