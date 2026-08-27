'use client';

import { useSyncExternalStore } from 'react';
import { readStoredDraft, serverDraftSnapshot, subscribe } from '@/lib/jobs/storage';
import type { ProductDraft } from '@/types/attach';

/**
 * The draft the seller typed on the match screen, read from browser storage.
 *
 * `useSyncExternalStore` rather than an effect, because storage is exactly what that
 * hook is for. It renders null on the server, swaps to the stored value on hydration
 * without a mismatch, and re-renders when another tab changes it.
 */
export function useStoredDraft(): ProductDraft | null {
  return useSyncExternalStore(subscribe, readStoredDraft, serverDraftSnapshot);
}
