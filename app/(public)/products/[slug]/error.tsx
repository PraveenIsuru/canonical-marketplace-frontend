'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

/** S-08, scoped to a product. */
export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <h1 className="text-2xl font-semibold">This product could not be loaded</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Something went wrong fetching this product. Trying again often works.
      </p>
      <div className="flex items-center gap-4 text-sm">
        <Button onClick={reset}>Try again</Button>
        <Link href="/products" className="underline">
          Back to the catalogue
        </Link>
      </div>
    </div>
  );
}
