import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** A validation message from the API, rendered under the field and announced. */
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>

      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn(
          'rounded-md border px-3 py-2 text-sm',
          'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1',
          error
            ? 'border-red-500 focus-visible:outline-red-500'
            : 'border-zinc-300 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:focus-visible:outline-zinc-100',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
