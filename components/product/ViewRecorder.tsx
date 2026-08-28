'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { recordProductView } from '@/lib/api/analytics';

/**
 * EP-52. Records that somebody looked at this product.
 *
 * Renders nothing. It exists so that the product page, which is statically generated
 * and served from the cache, can still count the visitors who actually arrive at it.
 * A view recorded during the server render would be a view per build, not a view per
 * person, and reading anything request scoped on that page would deopt it out of
 * static generation entirely.
 *
 * **Fires once per page render.** The ref guard is not defensive tidiness: React runs
 * effects twice in development under StrictMode, and without it every view in
 * development would be counted twice.
 *
 * **Every failure is silent.** A visitor came here to read about a product, and
 * nothing they came for depends on this call. There is no retry, no error boundary,
 * and no visible state of any kind.
 */
export function ViewRecorder({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const recorded = useRef<string | null>(null);

  /*
   * The store the visitor arrived through, and the only store context a product page
   * has. Set by the links on a store's own page (S-07) and by nothing else.
   *
   * Not taken from the seller list on this page: those rows are stores the visitor is
   * *looking at*, not one they arrived through, and crediting a view to a seller
   * because their row happened to render would make every seller's numbers wrong in
   * the same direction.
   */
  const fromStore = Number(searchParams.get('store'));
  const storeId = Number.isInteger(fromStore) && fromStore > 0 ? fromStore : undefined;

  useEffect(() => {
    // Keyed by slug so a client side navigation to a different product records again,
    // while a re-render of the same one does not.
    if (recorded.current === slug) return;
    recorded.current = slug;

    /*
     * Deliberately not awaited and deliberately not surfaced. `recordProductView`
     * swallows its own failures and answers null, and a null attribution coming back
     * after sending a store id is a normal outcome rather than a degraded one: the
     * seller detached between this page rendering and the view arriving.
     */
    void recordProductView(slug, storeId);
  }, [slug, storeId]);

  return null;
}
