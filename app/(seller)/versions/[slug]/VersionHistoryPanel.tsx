'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getVersions, isNotAttached, isStoreRequired, isVersionNotFound } from '@/lib/api/versions';
import { queryKeys } from '@/lib/query/keys';
import { formatDateTime } from '@/lib/format/dates';
import { VersionAccessNotice } from '@/components/product/VersionAccessNotice';
import { Alert, Card, EmptyState, Pagination, Skeleton } from '@/components/ui';
import type { ProductVersion } from '@/types/product';

/**
 * S-31 Record history, the chain.
 *
 * Every version of a product's canonical record, newest first. It exists because no
 * seller edits a product directly: changes arrive as proposals and are settled by the
 * sellers who carry the record, and this is where the outcome of all that is visible.
 *
 * **A rejected proposal is absent, and not because it is filtered out here.** A version
 * is written for an accepted proposal and an administrator edit and for nothing else,
 * so a rejected one was never recorded. There is no toggle to reveal them, because
 * there is nothing to reveal.
 *
 * **There is no rollback control**, per section 2.3 of the build plan. History is read
 * only. An administrator who wants an old value back edits forward, which writes a
 * further version and leaves the trail intact.
 */
export function VersionHistoryPanel({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.products.versions(slug), page],
    queryFn: () => getVersions(slug, page),
    // Both refusals are decisions, not transient failures. Retrying a 403 three times
    // just delays the explanation.
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Header slug={slug} />

        {isNotAttached(error) && <VersionAccessNotice reason="not_attached" />}
        {isStoreRequired(error) && <VersionAccessNotice reason="store_required" />}

        {isVersionNotFound(error) && (
          <EmptyState
            title="No such product"
            description="This product does not exist, or its address has changed."
            action={
              <Link href="/listings" className="underline">
                Your listings
              </Link>
            }
          />
        )}

        {!isNotAttached(error) && !isStoreRequired(error) && !isVersionNotFound(error) && (
          <Alert tone="error" title="The record history could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <Header slug={slug} />

      {data.data.length === 0 ? (
        <EmptyState
          title="This record has no versions yet"
          description="A version is written when a proposal is accepted or an administrator edits the record. Nothing has changed this product since it was created."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.data.map((version) => (
            <VersionRow key={version.version_number} slug={slug} version={version} />
          ))}
        </ul>
      )}

      <Pagination meta={data.meta} hrefFor={(next) => `/versions/${slug}?page=${next}`} />

      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Nobody edits this record directly, including us. A change comes from a seller
          who knows the product and is decided by the sellers who stock it, which is why
          this is a history rather than an edit form. Proposals that were turned down are
          not here: they changed nothing, so no version was written.
        </p>
      </Card>
    </div>
  );
}

function Header({ slug }: { slug: string }) {
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/listings" className="underline">
          Listings
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/products/${slug}`} className="underline">
          {slug}
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold">Record history</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every version of this product&apos;s shared record, newest first.
      </p>
    </div>
  );
}

/**
 * One version.
 *
 * `caused_by_store` names the shop whose accepted proposal produced it. An
 * administrator edit says so and names nobody, which is the contract's decision rather
 * than a missing field: naming the moderator who applied a change to the sellers it
 * affects serves none of them.
 */
function VersionRow({ slug, version }: { slug: string; version: ProductVersion }) {
  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/versions/${slug}/${version.version_number}`}
          className="font-medium underline"
        >
          Version {version.version_number}
        </Link>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDateTime(version.created_at)}
        </span>
      </div>

      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {version.is_admin_originated
          ? 'Edited directly by an administrator'
          : version.caused_by_store
            ? `Proposed by ${version.caused_by_store.name}, and accepted by the sellers carrying it`
            : 'Created with the record'}
      </p>

      {/*
        Empty on version 1, which created the record rather than changing it. Rendering
        "changed nothing" there would be misleading; it changed everything, from nothing.
      */}
      {version.changed_fields.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-1.5">
          {version.changed_fields.map((field) => (
            <span
              key={field}
              className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {FIELD_LABELS[field] ?? field}
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          The first version, where the record began
        </p>
      )}
    </li>
  );
}

/**
 * Names the API's snapshot keys the way a seller would say them.
 *
 * Unmapped keys fall through unchanged rather than being hidden, so a field the
 * backend adds later shows up as itself instead of vanishing.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  slug: 'Address',
  description: 'Description',
  category: 'Category',
  specifications: 'Specifications',
  attributes: 'Attributes',
  variants: 'Versions',
};
