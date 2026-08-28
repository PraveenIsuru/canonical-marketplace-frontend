import Link from 'next/link';
import { Alert, EmptyState } from '@/components/ui';

/**
 * The two refusals a version history can answer with, and they are different problems.
 *
 * **`not_attached`** is the one this milestone exists to explain. The reader holds a
 * shop but does not carry this product, which includes the case that matters most: a
 * seller who was reading the history a moment ago and has just detached. Access is
 * re-read on every request, so it goes the instant the listing does, mid session, with
 * no grace period. That is deliberate rather than a session that expired oddly, and
 * saying so is the difference between a screen that looks broken and one that looks
 * decided.
 *
 * **`store_required`** is a reader with no shop at all. Same status code, completely
 * different fix, so it gets completely different copy.
 *
 * Neither is styled as an error. Nothing failed, and the answer was no.
 */
export function VersionAccessNotice({ reason }: { reason: 'not_attached' | 'store_required' }) {
  if (reason === 'store_required') {
    return (
      <EmptyState
        title="Record history is for sellers carrying the product"
        description="You do not have a shop yet, so there is nothing here for you to read. Once you carry a product, its full history opens up."
        action={
          <Link
            href="/sell/start"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Start selling
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title="You are not carrying this product">
        <p>
          A product&apos;s record history is a working document for the sellers
          responsible for it, so it is open to the shops currently carrying it and to
          nobody else. Carrying forty other products does not open this one.
        </p>
        <p className="mt-2">
          <strong className="font-medium">If you were reading this a moment ago</strong>,
          you have just stopped carrying the product. Access is checked on every request
          rather than when you signed in, so it goes at the same moment the listing does.
          Nothing has gone wrong with your account.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/listings" className="underline">
          Your listings
        </Link>
        <Link href="/sell/attach" className="underline">
          List this product again
        </Link>
      </div>
    </div>
  );
}
