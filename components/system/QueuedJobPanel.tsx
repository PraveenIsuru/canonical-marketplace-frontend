'use client';

import { Alert, Button } from '@/components/ui';
import type { QueuedJob } from '@/types/api';

interface Props {
  job: QueuedJob | null;
  /** What the seller was doing, in their words. "Checking the catalogue", for example. */
  activity: string;
  /** Offered once the job has failed, so the seller can put the same work back in. */
  onRetry?: () => void;
  onDismiss: () => void;
}

/**
 * X-01 Queued AI job panel.
 *
 * Shown when an AI dependent call answered 503 `ai_unavailable` with a queued job id.
 * The submission was saved, the work is queued, and the result will arrive.
 *
 * **Nothing here is phrased as the seller's error, because none of it is.** They filled
 * the form in correctly and an upstream service was busy. The copy says what is
 * happening and what will happen, and there is no apology to make on their behalf.
 *
 * The seller's input stays on screen behind this panel. Losing it and asking them to
 * type it again would turn a delay into a real cost.
 *
 * This never appears on buyer search. That path falls back to keyword results and
 * answers 200, and it is the only AI call in the platform that does.
 */
export function QueuedJobPanel({ job, activity, onRetry, onDismiss }: Props) {
  const status = job?.status ?? 'queued';

  if (status === 'failed') {
    return (
      <Alert tone="warning" title="That did not finish">
        <p>
          {activity} could not be completed this time. Nothing you entered has been
          lost, and it is still on the form below.
        </p>
        <div className="mt-3 flex gap-3">
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Alert tone="info" title="This is taking a little longer than usual">
      <p>
        {activity} is queued and running now. You can leave this page and come back:
        we will pick it up where it left off.
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-pulse rounded-full bg-blue-500"
        />
        <span>{status === 'processing' ? 'Working on it now' : 'Waiting to start'}</span>
      </p>
      <div className="mt-3">
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Stop waiting
        </Button>
      </div>
    </Alert>
  );
}
