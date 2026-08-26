import Link from 'next/link';
import { Card } from '@/components/ui';

/**
 * S-01 Home.
 *
 * Static, revalidated hourly. The catalogue entry point.
 *
 * The recent product grid and category tiles arrive in M2, once the catalogue read
 * endpoints exist. Until then this is the shell: search entry, and the panel stating
 * that the catalogue is readable without an account.
 */
export const revalidate = 3600;

export default function HomePage() {
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

      <Card>
        <h2 className="mb-1 font-medium">No account needed to browse</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The full catalogue, every seller&apos;s contact details and address, and all
          product discussions are readable without signing in. An account is only
          needed to save a wishlist, post in a discussion, or sell.
        </p>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Browse</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The category tiles and the recently added strip arrive with the catalogue
          endpoints.{' '}
          <Link href="/products" className="underline">
            Open the catalogue
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
