'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  url: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * A product image that survives a URL pointing at nothing.
 *
 * Seeded images carry plausible storage paths for files that were never uploaded, so
 * every catalogue image 404s in development. Rather than showing a broken image icon,
 * a failed load falls back to a labelled placeholder. Real uploads arrive at M5, and
 * this handling stays useful after that: an object storage outage should degrade the
 * page, not disfigure it.
 */
export function ProductImage({ url, alt, className, sizes = '(max-width: 640px) 50vw, 25vw', priority = false }: Props) {
  const [failed, setFailed] = useState(false);

  const showPlaceholder = url === null || failed;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800',
        className,
      )}
    >
      {showPlaceholder ? (
        <span
          className="px-2 text-center text-xs text-zinc-400 dark:text-zinc-500"
          // Decorative: the product name is already announced by the card heading.
          aria-hidden="true"
        >
          No image
        </span>
      ) : (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          onError={() => setFailed(true)}
          // unoptimized, because the optimiser fetches the upstream URL itself and a
          // 404 there throws before onError can ever fire on the client.
          unoptimized
        />
      )}
    </div>
  );
}
