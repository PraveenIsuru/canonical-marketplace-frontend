'use client';

import { useSyncExternalStore } from 'react';
import {
  readSelectedCandidate,
  serverCandidateSnapshot,
  subscribe,
  type SelectedCandidate,
} from '@/lib/jobs/storage';

/**
 * The product the seller chose on the match screen.
 *
 * `useSyncExternalStore` rather than an effect, for the same reason the draft uses it:
 * storage is exactly what that hook is for, it renders null on the server and swaps to
 * the stored value on hydration without a mismatch, and reading it in an effect would
 * cascade a render.
 */
export function useSelectedCandidate(): SelectedCandidate | null {
  return useSyncExternalStore(subscribe, readSelectedCandidate, serverCandidateSnapshot);
}
