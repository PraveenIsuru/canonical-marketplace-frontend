import Link from 'next/link';

/**
 * S-08 scoped to a store.
 *
 * Reached both for a store that does not exist and for one that is dark. The wording
 * deliberately does not distinguish them, matching the API, so this page cannot be
 * used to discover which store ids exist.
 */
export default function StoreNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">Store not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        No store is available at that address. Stores appear here once they carry at
        least one product.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/products" className="underline">
          Browse the catalogue
        </Link>
      </div>
    </div>
  );
}
