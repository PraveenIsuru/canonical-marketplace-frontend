/**
 * What the attachment flow keeps in the browser between visits.
 *
 * Two things are persisted, for one reason: a seller whose flow blocked on an
 * unavailable AI provider must be able to close the tab and come back to it.
 *
 *  - The queued job id, so the panel can resume polling a job it did not start.
 *  - The draft they typed, so resuming does not hand them an empty form and ask them
 *    to remember what they wrote.
 *
 * This is written as a subscribable store rather than as plain getters, so components
 * can read it with `useSyncExternalStore`. That matters: reading `localStorage` in an
 * effect and calling `setState` causes a cascading render, and reading it as a lazy
 * initial value disagrees with what the server rendered. An external store is the one
 * shape React has an answer for, and it handles the server snapshot on its own.
 *
 * Every read and write is guarded. `localStorage` throws outright in some contexts, a
 * private window can return nothing, and none of that is worth failing a render over.
 * A seller who loses the stored id is inconvenienced; a seller who gets a white screen
 * has lost the work.
 */

import type { ProductDraft } from '@/types/attach';

/**
 * The flows that can block on the provider. Each keeps its own job id.
 *
 * Separate keys rather than one shared id, because a person can plausibly have more
 * than one queued at a time, and resuming the wrong one would put them back into a
 * flow they had already left.
 *
 * Renamed from `AttachFlow` at M9. Verification is a buyer proving they own a product,
 * which has nothing to do with attaching, and the old name would have made this union
 * look like the wrong place for it.
 *
 * `verification` is the one flow whose authoritative resume point is **not** this
 * store: EP-33 reports `pending_job_id` per product, so a buyer with two verifications
 * outstanding is answered correctly by the API where a single browser key could not
 * tell them apart. The stored id is a convenience for the common single case.
 */
export type QueuedFlow = 'match' | 'wizard' | 'confirmation' | 'verification';

const JOB_KEY_PREFIX = 'canonical:queued-job:';
const DRAFT_KEY = 'canonical:attach-draft';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is unavailable or full. The flow still works for this visit; it simply
    // will not survive a reload, which is a smaller loss than a thrown render.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do. A stale id is handled by the panel: a job that has gone answers
    // 404 and is cleared then.
  }
}

/*
|--------------------------------------------------------------------------
| Subscription
|--------------------------------------------------------------------------
| `storage` events fire only in *other* tabs, so a write in this one has to notify
| its own subscribers by hand. Both paths are wired up: a second tab finishing the
| same job should stop this tab polling it.
*/

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = () => listener();
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/*
|--------------------------------------------------------------------------
| The queued job id
|--------------------------------------------------------------------------
*/

export function readStoredJobId(flow: QueuedFlow): string | null {
  if (typeof window === 'undefined') return null;

  return read(`${JOB_KEY_PREFIX}${flow}`);
}

/** Always null. The server cannot know what a particular browser has stored. */
export function serverJobIdSnapshot(): null {
  return null;
}

export function storeJobId(flow: QueuedFlow, jobId: string): void {
  if (typeof window === 'undefined') return;

  write(`${JOB_KEY_PREFIX}${flow}`, jobId);
  notify();
}

export function clearStoredJobId(flow: QueuedFlow): void {
  if (typeof window === 'undefined') return;

  remove(`${JOB_KEY_PREFIX}${flow}`);
  notify();
}

/*
|--------------------------------------------------------------------------
| The draft
|--------------------------------------------------------------------------
*/

/**
 * Cached so `useSyncExternalStore` sees a stable reference.
 *
 * That hook compares snapshots by identity and re-renders forever if a fresh object
 * comes back every time. So the raw string is what gets compared, and the parsed
 * object is only rebuilt when that string actually changes.
 */
let draftCacheKey: string | null = null;
let draftCacheValue: ProductDraft | null = null;

/**
 * The draft, kept so a resumed flow still shows what the seller typed.
 *
 * Parsed defensively. A malformed value is treated as absent rather than thrown,
 * because the only thing that could have written it is an older version of this code.
 */
export function readStoredDraft(): ProductDraft | null {
  if (typeof window === 'undefined') return null;

  const raw = read(DRAFT_KEY);

  if (raw === null) {
    draftCacheKey = null;
    draftCacheValue = null;
    return null;
  }

  if (raw === draftCacheKey) return draftCacheValue;

  draftCacheKey = raw;
  draftCacheValue = parseDraft(raw);

  return draftCacheValue;
}

/** Always null, for the same reason as the job id. */
export function serverDraftSnapshot(): null {
  return null;
}

function parseDraft(raw: string): ProductDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object') return null;

    const candidate = parsed as Partial<ProductDraft>;

    if (typeof candidate.name !== 'string' || candidate.name === '') return null;

    return {
      name: candidate.name,
      description: typeof candidate.description === 'string' ? candidate.description : null,
      category: typeof candidate.category === 'string' ? candidate.category : null,
    };
  } catch {
    return null;
  }
}

export function storeDraft(draft: ProductDraft): void {
  if (typeof window === 'undefined') return;

  write(DRAFT_KEY, JSON.stringify(draft));
  notify();
}

export function clearStoredDraft(): void {
  if (typeof window === 'undefined') return;

  remove(DRAFT_KEY);
  notify();
}

/*
|--------------------------------------------------------------------------
| The candidate the seller chose
|--------------------------------------------------------------------------
| Carried from the match screen to the confirmation screen. Kept in storage rather
| than in a query parameter so a reload mid confirmation still knows which product is
| being confirmed, and so the name can be shown without a second fetch.
*/

/** Just enough to identify and label the product being confirmed. */
export interface SelectedCandidate {
  product_id: number;
  slug: string;
  name: string;
}

const CANDIDATE_KEY = 'canonical:attach-candidate';

let candidateCacheKey: string | null = null;
let candidateCacheValue: SelectedCandidate | null = null;

/**
 * Cached against the raw string so `useSyncExternalStore` sees a stable reference.
 * Returning a fresh object each read would re-render forever.
 */
export function readSelectedCandidate(): SelectedCandidate | null {
  if (typeof window === 'undefined') return null;

  const raw = read(CANDIDATE_KEY);

  if (raw === null) {
    candidateCacheKey = null;
    candidateCacheValue = null;

    return null;
  }

  if (raw === candidateCacheKey) return candidateCacheValue;

  candidateCacheKey = raw;
  candidateCacheValue = parseCandidate(raw);

  return candidateCacheValue;
}

export function serverCandidateSnapshot(): null {
  return null;
}

function parseCandidate(raw: string): SelectedCandidate | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object') return null;

    const candidate = parsed as Partial<SelectedCandidate>;

    if (typeof candidate.product_id !== 'number') return null;
    if (typeof candidate.slug !== 'string' || typeof candidate.name !== 'string') return null;

    return { product_id: candidate.product_id, slug: candidate.slug, name: candidate.name };
  } catch {
    return null;
  }
}

export function storeSelectedCandidate(candidate: SelectedCandidate): void {
  if (typeof window === 'undefined') return;

  write(CANDIDATE_KEY, JSON.stringify(candidate));
  notify();
}

export function clearSelectedCandidate(): void {
  if (typeof window === 'undefined') return;

  remove(CANDIDATE_KEY);
  notify();
}
