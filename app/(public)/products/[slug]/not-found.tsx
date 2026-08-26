import Link from 'next/link';

/**
 * S-08, scoped to a product.
 *
 * Exists so a missing product does not fall through to the global boundary, which
 * would offer no way back into the catalogue from where the visitor actually was.
 */
export default function ProductNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">Product not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        No product matches that address. It may never have existed, or the link may be
        mistyped.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/products" className="underline">
          Browse the catalogue
        </Link>
        <Link href="/search" className="underline">
          Search for it
        </Link>
      </div>
    </div>
  );
}
