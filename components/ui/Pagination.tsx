import Link from 'next/link';
import type { PaginationMeta } from '@/lib/schemas/catalogue';

interface Props {
  meta: PaginationMeta;
  /** Builds the href for a page number, so each screen keeps its own filters. */
  hrefFor: (page: number) => string;
}

/**
 * Previous and next links plus a position indicator.
 *
 * Deliberately links rather than buttons: pagination is navigation, so it should be
 * openable in a new tab and reachable by a crawler.
 */
export function Pagination({ meta, hrefFor }: Props) {
  if (meta.last_page <= 1) return null;

  const previous = meta.current_page > 1 ? meta.current_page - 1 : null;
  const next = meta.current_page < meta.last_page ? meta.current_page + 1 : null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
      {previous === null ? (
        <span className="text-zinc-400 dark:text-zinc-600">Previous</span>
      ) : (
        <Link href={hrefFor(previous)} rel="prev" className="underline">
          Previous
        </Link>
      )}

      <span className="text-zinc-500 dark:text-zinc-400">
        Page {meta.current_page} of {meta.last_page}
      </span>

      {next === null ? (
        <span className="text-zinc-400 dark:text-zinc-600">Next</span>
      ) : (
        <Link href={hrefFor(next)} rel="next" className="underline">
          Next
        </Link>
      )}
    </nav>
  );
}
