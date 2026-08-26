/**
 * The search box.
 *
 * A plain form with a GET action, so the query lands in the URL and the results page
 * stays shareable, linkable, and reachable with the back button. It needs no
 * JavaScript to work.
 */
export function SearchForm({ initialQuery = '' }: { initialQuery?: string }) {
  return (
    <form action="/search" className="flex max-w-xl gap-2">
      <input
        type="search"
        name="q"
        defaultValue={initialQuery}
        placeholder="Search for a product"
        aria-label="Search for a product"
        maxLength={200}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Search
      </button>
    </form>
  );
}
