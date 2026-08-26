'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui';

/** S-08. The global error boundary. Offers a retry and a link home. */
export default function Error({
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
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        The page could not be loaded. Trying again often works.
      </p>
      <div className="flex items-center gap-4 text-sm">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
