'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getVersion, isNotAttached, isStoreRequired, isVersionNotFound } from '@/lib/api/versions';
import { queryKeys } from '@/lib/query/keys';
import { formatDateTime } from '@/lib/format/dates';
import { VersionAccessNotice } from '@/components/product/VersionAccessNotice';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui';
import type { ProductVersionSnapshotFields } from '@/types/product';

/**
 * S-31 Record history, one version.
 *
 * The whole record as it stood at that version, not a diff. Reading one version costs
 * a single row on the backend for exactly this reason, and it means a seller can see
 * what the catalogue actually said on a given day rather than reconstructing it from a
 * chain of changes.
 *
 * **No rollback control**, per section 2.3 of the build plan. Not a disabled one
 * either: rendering a greyed out button would imply the capability exists and is
 * merely unavailable to this reader. An administrator wanting an old value back edits
 * forward through a new version.
 */
export function VersionSnapshotPanel({ slug, versionNumber }: { slug: string; versionNumber: number }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.products.version(slug, versionNumber),
    queryFn: () => getVersion(slug, versionNumber),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Breadcrumb slug={slug} />

        {isNotAttached(error) && <VersionAccessNotice reason="not_attached" />}
        {isStoreRequired(error) && <VersionAccessNotice reason="store_required" />}

        {isVersionNotFound(error) && (
          <EmptyState
            title="No such version"
            description="This product has no version with that number."
            action={
              <Link href={`/versions/${slug}`} className="underline">
                Back to the history
              </Link>
            }
          />
        )}

        {!isNotAttached(error) && !isStoreRequired(error) && !isVersionNotFound(error) && (
          <Alert tone="error" title="This version could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        )}
      </div>
    );
  }

  const snapshot = data.snapshot;

  return (
    <div className="flex flex-col gap-6 py-8">
      <Breadcrumb slug={slug} />

      <div>
        <h1 className="text-2xl font-semibold">Version {data.version_number}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatDateTime(data.created_at)}
          {' · '}
          {data.is_admin_originated
            ? 'edited directly by an administrator'
            : data.caused_by_store
              ? `proposed by ${data.caused_by_store.name}`
              : 'created with the record'}
        </p>
      </div>

      <Alert tone="info">
        This is the record as it stood at this version, not a list of what changed. It is
        kept for reference and cannot be restored: a correction goes forward as a new
        version rather than backwards to an old one.
      </Alert>

      <Card className="flex flex-col gap-4">
        <Field label="Name" value={snapshot.name} />
        <Field label="Category" value={snapshot.category} />
        <Field label="Address" value={`/products/${snapshot.slug}`} />
        <Field label="Description" value={snapshot.description ?? 'None recorded'} />
      </Card>

      <SpecificationList specifications={snapshot.specifications} />
      <AttributeList attributes={snapshot.attributes} />
      <VariantList variants={snapshot.variants} />
    </div>
  );
}

function Breadcrumb({ slug }: { slug: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500 dark:text-zinc-400">
      <Link href="/listings" className="underline">
        Listings
      </Link>
      <span className="mx-2">/</span>
      <Link href={`/versions/${slug}`} className="underline">
        Record history
      </Link>
    </nav>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function SpecificationList({ specifications }: { specifications: Record<string, unknown> }) {
  const entries = Object.entries(specifications);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Specifications</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          None were recorded at this version.
        </p>
      ) : (
        <Card>
          <dl className="grid gap-2 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <dt className="w-32 shrink-0 text-zinc-500 dark:text-zinc-400">{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </section>
  );
}

function AttributeList({ attributes }: { attributes: ProductVersionSnapshotFields['attributes'] }) {
  if (attributes.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Attributes</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This product had no attributes at this version, so it had a single default
          version.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Attributes</h2>
      <Card>
        <dl className="flex flex-col gap-2">
          {attributes.map((attribute) => (
            <div key={attribute.name} className="flex gap-2 text-sm">
              <dt className="w-32 shrink-0 text-zinc-500 dark:text-zinc-400">{attribute.name}</dt>
              <dd>{attribute.options.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

/**
 * The combinations that existed at this version.
 *
 * Listed in full, including ones no seller carried. Generated combinations are
 * permanent and are never removed by anybody, so a history that showed only the
 * carried ones would misrepresent what the record held.
 */
function VariantList({ variants }: { variants: ProductVersionSnapshotFields['variants'] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        Versions
        <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
          {variants.length} {variants.length === 1 ? 'combination' : 'combinations'}
        </span>
      </h2>

      <ul className="flex flex-col gap-2">
        {variants.map((variant) => {
          const values = Object.values(variant.attribute_values);

          return (
            <li
              key={variant.combination_hash}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            >
              <span>{values.length > 0 ? values.join(', ') : 'The only version'}</span>
              {variant.is_default && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">default</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
