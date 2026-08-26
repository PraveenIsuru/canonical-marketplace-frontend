import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-lg border border-zinc-200 bg-white p-4',
        'dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {children}
    </div>
  );
}
