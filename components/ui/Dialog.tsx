'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Confirm and cancel controls. */
  footer?: ReactNode;
}

/**
 * A modal dialog built on the native <dialog> element, so focus trapping, Escape to
 * close, and the backdrop come from the browser rather than from hand written
 * keyboard handling.
 *
 * Used for confirmations that need a warning, such as detaching a last listing or
 * reversing a resolved proposal.
 */
export function Dialog({ open, onClose, title, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="dialog-title"
      className="max-w-md rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <h2 id="dialog-title" className="mb-2 text-lg font-semibold">
        {title}
      </h2>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
      {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
    </dialog>
  );
}
