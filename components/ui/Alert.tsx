import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'warning' | 'error' | 'success';

const TONES: Record<Tone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
  success:
    'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100',
};

interface Props {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A status region.
 *
 * Rendered with role="status" rather than role="alert" so that a notice appearing
 * mid flow, such as the keyword search fallback, is announced without interrupting.
 */
export function Alert({ tone = 'info', title, children, className }: Props) {
  return (
    <div role="status" className={cn('rounded-md border p-3 text-sm', TONES[tone], className)}>
      {title && <p className="mb-1 font-medium">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
