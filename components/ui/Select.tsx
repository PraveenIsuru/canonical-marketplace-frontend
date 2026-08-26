import type { SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, id, ...props }: Props) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </label>

      <select
        {...props}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'rounded-md border px-3 py-2 text-sm',
          'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100',
          error ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700',
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
