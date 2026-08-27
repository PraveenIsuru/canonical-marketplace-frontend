'use client';

import { useState } from 'react';
import {
  detachListing,
  isPriceRejected,
  updateListing,
} from '@/lib/api/wishlist';
import { ApiError } from '@/lib/api/client';
import { formatMoney, parseMoneyToMinor } from '@/lib/format/money';
import { Alert, Button, Dialog } from '@/components/ui';
import type { ListedVariant } from '@/types/confirmation';

interface Props {
  variant: ListedVariant;
  productName: string;
  /**
   * Whether this is the only listing the store has left.
   *
   * Computed from the listings already on screen, so the warning appears **before** the
   * seller commits rather than only in the confirmation afterwards.
   */
  isLastListing: boolean;
  /** Called with the store's live flag from the EP-26 response once a detach succeeds. */
  onDetached: (storeIsLive: boolean) => void;
  onChanged: () => void;
}

/**
 * One listing a seller can edit (EP-25) or remove (EP-26).
 *
 * **Two fields and a delete, and that is the entire surface.** There is no control here
 * for a product name, a specification, or an attribute value, and none may be added:
 * the record is shared by every seller carrying it and changes only through a proposal.
 * That is invariant 1, and it is the reason this row looks smaller than a seller might
 * expect.
 */
export function ListingRow({
  variant,
  productName,
  isLastListing,
  onDetached,
  onChanged,
}: Props) {
  // Held in major units because that is what a seller types. Converted once, on submit.
  const [price, setPrice] = useState(() => (variant.price_minor / 100).toFixed(2));
  const [available, setAvailable] = useState(variant.is_available);

  const [saving, setSaving] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const priceMinor = parseMoneyToMinor(price);
  const priceChanged = priceMinor !== null && priceMinor !== variant.price_minor;
  const availabilityChanged = available !== variant.is_available;
  const hasChanges = priceChanged || availabilityChanged;

  const describe =
    Object.entries(variant.attribute_values).length === 0
      ? 'Single default version'
      : Object.entries(variant.attribute_values)
          .map(([name, value]) => `${name}: ${value}`)
          .join(', ');

  async function save() {
    if (!hasChanges || priceMinor === null) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      /*
       * Only what actually changed is sent. EP-25 takes either field on its own, and
       * restating a price the seller did not touch would make an unrelated edit look
       * like a price change to the alert logic behind it.
       */
      await updateListing(variant.attachment_id, {
        ...(priceChanged ? { price_minor: priceMinor } : {}),
        ...(availabilityChanged ? { is_available: available } : {}),
      });

      setSaved(true);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'That change could not be saved.'),
      );
    }

    setSaving(false);
  }

  async function detach() {
    setDetaching(true);
    setError(null);

    try {
      const result = await detachListing(variant.attachment_id);

      setConfirming(false);
      /*
       * The live flag comes from the response rather than from a later refetch. This is
       * the exact moment the store may have stopped being visible to buyers, and the
       * seller should be told now, not when something else happens to reload.
       */
      onDetached(result.store_is_live);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, 'unknown', 'That listing could not be removed.'),
      );
      setDetaching(false);
    }
  }

  const priceError = error !== null && isPriceRejected(error);

  return (
    <li className="flex flex-col gap-3 rounded-md border border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{describe}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Currently {formatMoney(variant.price_minor, variant.currency)}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`price-${variant.attachment_id}`} className="text-xs font-medium">
            Your price
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{variant.currency}</span>
            <input
              id={`price-${variant.attachment_id}`}
              inputMode="decimal"
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                setSaved(false);
              }}
              className="w-32 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          {/*
            Caught here rather than on the round trip. The API refuses a price at or
            below zero, and saying so before sending is faster and says the same thing.
          */}
          {price !== '' && priceMinor === null && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Enter an amount above zero, for example 4599.00.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={available}
            onChange={(event) => {
              setAvailable(event.target.checked);
              setSaved(false);
            }}
            className="h-4 w-4"
          />
          In stock
        </label>

        <Button size="sm" onClick={save} loading={saving} disabled={!hasChanges || saving}>
          Save
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirming(true)}
          disabled={detaching}
        >
          Remove
        </Button>

        {saved && !hasChanges && (
          <span className="pb-1.5 text-xs text-green-700 dark:text-green-400">Saved</span>
        )}
      </div>

      {error !== null && (
        <Alert tone="error" title={priceError ? 'That price was refused' : 'That did not work'}>
          {priceError
            ? (error.fieldError('price_minor') ?? 'A price must be greater than zero.')
            : error.message}
        </Alert>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Stop selling ${productName}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={detaching}>
              Keep it
            </Button>
            <Button onClick={detach} loading={detaching} disabled={detaching}>
              Remove this listing
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This removes <strong>{describe}</strong> from your store. Buyers will no longer
          see you on this product.
        </p>

        {/*
          Warned before the seller commits, from the listings already on screen. The
          EP-26 response confirms it afterwards, but a warning that only arrives after
          the fact is not a warning.
        */}
        {isLastListing && (
          <Alert tone="warning" title="This is your last listing" className="mt-3">
            Removing it makes your store invisible to buyers. A store is only visible
            while it carries at least one product, so yours will go dark until you list
            something again.
          </Alert>
        )}

        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          The product itself is not affected. It stays in the catalogue for everyone
          else, and you can list it again by answering the confirmation questions.
        </p>
      </Dialog>
    </li>
  );
}
