import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** Say what the visitor can do about it, not just that there is nothing here. */
  description?: string;
  action?: ReactNode;
}

/**
 * The empty state.
 *
 * An empty list is part of every screen definition, and it is never just blank space.
 * A product with no sellers, a wishlist with no entries, and a filter that excluded
 * everything are all different situations, so the copy is always supplied by caller.
 */
export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      )}
      {action}
    </div>
  );
}
