import { cn } from '@/lib/cn';

/**
 * Loading placeholder.
 *
 * Every screen definition lists a loading state, so this exists from the start rather
 * than each screen inventing its own spinner.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded bg-zinc-200 dark:bg-zinc-800', className)}
    />
  );
}

/** A card grid placeholder, used by the catalogue and search screens. */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
