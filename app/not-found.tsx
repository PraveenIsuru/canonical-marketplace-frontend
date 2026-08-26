import Link from 'next/link';

/** S-08. The global not found boundary. Offers search and the catalogue. */
export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        That page does not exist. It may have moved, or the link may be wrong.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">
          Go home
        </Link>
        <Link href="/products" className="underline">
          Browse the catalogue
        </Link>
        <Link href="/search" className="underline">
          Search
        </Link>
      </div>
    </div>
  );
}
