'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getJob } from '@/lib/api/attach';
import { ApiError } from '@/lib/api/client';
import {
  clearStoredJobId,
  readStoredJobId,
  serverJobIdSnapshot,
  storeJobId,
  subscribe,
  type QueuedFlow,
} from '@/lib/jobs/storage';
import type { QueuedJob } from '@/types/api';

/**
 * The backoff schedule, in milliseconds.
 *
 * Starts at 2 seconds and widens to 15, per the frontend build plan. Written out
 * rather than computed so the shape of the wait is readable at a glance: quick at
 * first, because most jobs finish almost immediately once the provider recovers, then
 * patient, because one that has not finished in half a minute is waiting on something
 * slower than polling can hurry.
 */
const BACKOFF_MS = [2000, 3000, 4000, 6000, 8000, 11000, 15000];

function delayFor(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

export interface QueuedJobState {
  /** The job being polled, or null when nothing is outstanding. */
  jobId: string | null;
  job: QueuedJob | null;
  /** True while a job exists and has not reached a terminal status. */
  isWaiting: boolean;
  /** Begin polling a job the API just handed back. Persists the id. */
  start: (jobId: string) => void;
  /** Forget the job entirely, clearing the stored id. */
  dismiss: () => void;
}

/**
 * Polls a queued AI job and survives a page reload (X-01).
 *
 * The job id lives in `localStorage` and is read from there through
 * `useSyncExternalStore`, which is what makes resuming free: there is no mount effect
 * restoring it, because storage *is* the state. Closing the browser and coming back
 * picks up the same job.
 *
 * Terminal statuses stop the polling but keep the job in state, because the screen
 * still has to render the result or the failure. `dismiss` is what actually forgets it.
 *
 * A stored id that answers 404 is cleared silently. It means the job belonged to
 * another account or has been cleaned up, and neither is worth reporting to someone
 * who did not know the id existed.
 */
export function useQueuedJob(flow: QueuedFlow): QueuedJobState {
  const jobId = useSyncExternalStore(
    subscribe,
    () => readStoredJobId(flow),
    serverJobIdSnapshot,
  );

  const [job, setJob] = useState<QueuedJob | null>(null);

  // Held in a ref so the polling loop can be cancelled from anywhere without being
  // part of the effect's dependencies.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const start = useCallback(
    (id: string) => {
      setJob(null);
      // Writing to storage is what actually sets `jobId`, through the subscription.
      storeJobId(flow, id);
    },
    [flow],
  );

  const dismiss = useCallback(() => {
    setJob(null);
    clearStoredJobId(flow);
  }, [flow]);

  useEffect(() => {
    if (jobId === null) return;

    cancelled.current = false;
    let attempt = 0;

    async function poll(id: string): Promise<void> {
      if (cancelled.current) return;

      try {
        const next = await getJob(id);

        if (cancelled.current) return;

        setJob(next);

        /*
         * Completed and failed are both terminal, so polling stops. The id stays in
         * storage on purpose: the whole point of persisting it is that a seller who
         * closed the browser can come back and find the result waiting, and clearing
         * it here would mean the answer only existed for whoever was still watching.
         *
         * The flow clears it once the seller has acted on it, or `dismiss` does.
         */
        if (next.status === 'completed' || next.status === 'failed') {
          return;
        }
      } catch (caught) {
        if (cancelled.current) return;

        /*
         * A job that is not there is not an error worth surfacing. The id came from
         * storage, it belongs to another account or has been cleaned up, and the
         * seller never knew it existed. Clearing it quietly returns them to a normal
         * screen rather than explaining a mechanism to them.
         */
        if (caught instanceof ApiError && caught.status === 404) {
          clearStoredJobId(flow);
          return;
        }

        // Anything else, including a network blip, is worth another attempt. The whole
        // reason this panel exists is that something upstream is unreliable.
      }

      attempt += 1;
      timer.current = setTimeout(() => void poll(id), delayFor(attempt));
    }

    // First check goes out immediately. A job queued a while ago may already be done,
    // and making a returning seller wait two seconds to be told so is needless.
    void poll(jobId);

    return () => {
      cancelled.current = true;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [jobId, flow]);

  const isWaiting =
    jobId !== null && (job === null || job.status === 'queued' || job.status === 'processing');

  return { jobId, job, isWaiting, start, dismiss };
}
