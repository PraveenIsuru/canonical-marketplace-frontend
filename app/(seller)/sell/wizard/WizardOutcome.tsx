'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { describeImageProblem, isImageRefusal, uploadProductImage } from '@/lib/api/attach';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Card } from '@/components/ui';
import type { PendingImage, WizardSubmitResult } from '@/types/attach';

interface Props {
  result: WizardSubmitResult;
  images: PendingImage[];
}

/**
 * What the seller sees once EP-24 has answered 201.
 *
 * The product exists from this moment and cannot be undone: the platform has no
 * product deletion path. Everything on this screen is therefore reporting, not
 * confirming, and nothing here can fail in a way that takes the product back.
 *
 * Image upload happens here rather than during the wizard, because EP-48 is keyed by
 * slug and the slug did not exist until a moment ago. **A failed image is not a failed
 * product.** It gets a retry of its own and the record stays exactly as it is.
 */
export function WizardOutcome({ result, images }: Props) {
  const [uploads, setUploads] = useState<PendingImage[]>(images);
  const started = useRef(false);

  async function uploadOne(image: PendingImage): Promise<void> {
    setUploads((previous) =>
      previous.map((i) => (i.id === image.id ? { ...i, status: 'uploading', error: undefined } : i)),
    );

    try {
      await uploadProductImage(result.product.slug, image.file);

      setUploads((previous) =>
        previous.map((i) => (i.id === image.id ? { ...i, status: 'uploaded' } : i)),
      );
    } catch (caught) {
      const message = isImageRefusal(caught)
        ? caught.message
        : caught instanceof ApiError
          ? caught.message
          : 'That photo did not upload.';

      setUploads((previous) =>
        previous.map((i) => (i.id === image.id ? { ...i, status: 'failed', error: message } : i)),
      );
    }
  }

  /*
   * Sequential rather than parallel, and deliberately.
   *
   * Position is assigned by the API as "one past the highest", so uploading eight at
   * once would have them race for the same position and land in an arbitrary order.
   * One at a time keeps the gallery in the order the seller chose them.
   */
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      for (const image of images) {
        if (image.status === 'failed') continue; // Rejected locally, never sent.
        await uploadOne(image);
      }
    })();
    // Runs once, on mount, guarded by the ref. The product is already created; this
    // must not re-fire on any later render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = uploads.filter((i) => i.status === 'failed');
  const uploading = uploads.some((i) => i.status === 'uploading');
  const uploaded = uploads.filter((i) => i.status === 'uploaded').length;

  /*
   * A file the browser already judged unacceptable will be refused again for the same
   * reason, so offering a retry for it would only repeat the refusal. Only files that
   * failed *in transit* are worth another attempt.
   */
  const retryable = failed.filter((image) => describeImageProblem(image.file) === null);

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your product is listed</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          It is now part of the catalogue, and other sellers can list it alongside you.
        </p>
      </div>

      {/*
        The outcome that matters most to a seller who has been dark since registering.
      */}
      {result.store_is_live && (
        <Alert tone="success" title="Your store is now visible to buyers">
          A store appears in seller lists once it carries at least one product. Yours
          now does.
        </Alert>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="font-medium">What was created</h2>
        <dl className="grid gap-1 text-sm sm:grid-cols-[14rem_1fr]">
          <dt className="text-zinc-500 dark:text-zinc-400">Versions in the catalogue</dt>
          <dd>{result.variants_generated}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Versions you are listing</dt>
          <dd>{result.attachments_created}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Record version</dt>
          <dd>{result.product.current_version_number}</dd>
        </dl>
        {/*
          Stated as a fact about how the catalogue works, never as a warning. The gap
          between the two counts is expected: every combination is created so another
          seller can list the ones this one does not.
        */}
        {result.variants_generated > result.attachments_created && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            The other {result.variants_generated - result.attachments_created} appear on
            the product page with no sellers yet, ready for whoever stocks them.
          </p>
        )}
      </Card>

      {uploads.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium">Photos</h2>

          {uploading && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Uploading {uploaded + 1} of {uploads.length}…
            </p>
          )}

          {!uploading && failed.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              All {uploaded} uploaded.
            </p>
          )}

          {failed.length > 0 && !uploading && (
            /*
              The important line on this screen. A photo that did not upload has no
              bearing on the product, which is created and correct, and the seller
              needs to know that before they wonder whether to start again.
            */
            <Alert tone="warning" title="Some photos did not upload">
              <p>
                Your product is listed and nothing about it is affected. You can try
                these again now, or add them later.
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {failed.map((image) => (
                  <li key={image.id}>
                    {image.file.name}
                    {image.error ? ` — ${image.error}` : ''}
                  </li>
                ))}
              </ul>
              {retryable.length > 0 && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    void (async () => {
                      for (const image of retryable) await uploadOne(image);
                    })();
                  }}
                >
                  Try those again
                </Button>
              )}
            </Alert>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/products/${result.product.slug}`} className="underline">
          View the product page
        </Link>
        <Link href="/sell/attach" className="underline">
          List another product
        </Link>
        <Link href="/dashboard" className="underline">
          Back to your dashboard
        </Link>
      </div>

      {/*
        No link to a listings screen, because there is no listings screen. Offering one
        would send the seller to a page that does not exist.
      */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Managing your prices and availability from one place is still being built. For
        now the product page shows exactly what buyers see.
      </p>
    </div>
  );
}
