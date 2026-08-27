'use client';

import Image from 'next/image';
import { Alert, Button } from '@/components/ui';
import { describeImageProblem, MAX_IMAGES_PER_PRODUCT } from '@/lib/api/attach';
import type { PendingImage } from '@/types/attach';

interface Props {
  images: PendingImage[];
  onChange: (images: PendingImage[]) => void;
  disabled?: boolean;
}

/**
 * Step 5 of S-25. Choosing images, without uploading any of them yet.
 *
 * The upload endpoint is keyed by product slug, and the product does not exist until
 * the wizard is submitted. So files are held here in client state, checked locally for
 * format and size, and sent only after the submission returns a slug.
 *
 * Checking locally is not a substitute for the API's own refusal, which still applies
 * and is still handled. It exists so a seller finds out about a 12 MB photograph now,
 * while they are looking at it, rather than after the product has been created and the
 * upload comes back refused.
 */
export function ImagePicker({ images, onChange, disabled }: Props) {
  const remaining = MAX_IMAGES_PER_PRODUCT - images.length;

  function add(files: FileList | null) {
    if (files === null) return;

    const accepted: PendingImage[] = [];

    for (const file of Array.from(files).slice(0, remaining)) {
      const problem = describeImageProblem(file);

      accepted.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        // Revoked when the picker unmounts is not worth the complexity here: the
        // wizard is one page and the handful of object URLs go with it.
        previewUrl: URL.createObjectURL(file),
        status: problem === null ? 'pending' : 'failed',
        error: problem ?? undefined,
      });
    }

    onChange([...images, ...accepted]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Photos</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Optional. Photos belong to the product record and are shared with every seller
          who lists it, so a clear shot of the product itself is worth more than one of
          your shelf.
        </p>
      </div>

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                <Image
                  src={image.previewUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              {image.error && (
                <p className="text-xs text-red-600 dark:text-red-400">{image.error}</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(images.filter((i) => i.id !== image.id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 ? (
        <div className="flex flex-col gap-1">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={(event) => {
              add(event.target.files);
              // Cleared so choosing the same file twice in a row still fires a change.
              event.target.value = '';
            }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-800"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            JPEG, PNG, or WebP, up to 5 MB each. {remaining} of {MAX_IMAGES_PER_PRODUCT}{' '}
            remaining. They upload once the product is created.
          </p>
        </div>
      ) : (
        <Alert tone="info">
          That is the maximum of {MAX_IMAGES_PER_PRODUCT} photos for a product.
        </Alert>
      )}
    </div>
  );
}
