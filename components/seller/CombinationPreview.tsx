'use client';

import { Alert } from '@/components/ui';
import { combinationKey, describeCombination } from '@/lib/attach/combinations';
import { formatMoney } from '@/lib/format/money';

export interface CarriedEntry {
  /** The price as the seller typed it, in major units. Converted on submit. */
  price: string;
  carried: boolean;
}

interface Props {
  combinations: Record<string, string>[];
  entries: Record<string, CarriedEntry>;
  currency: string;
  onToggle: (key: string, carried: boolean) => void;
  onPrice: (key: string, price: string) => void;
  disabled?: boolean;
  /** Field errors from the API, keyed as carried_variants.0.price_minor and so on. */
  errorFor?: (key: string) => string | undefined;
}

/**
 * Step 4 of S-25. Every combination the attributes produce, and which ones this seller
 * carries.
 *
 * Two rules govern this component, and both are easy to break by being helpful.
 *
 * **There is no control to remove a combination.** Not a delete button, not a hide
 * toggle, not a disabled one. Generated combinations are permanent for everyone,
 * including administrators, and a control implying otherwise would be promising
 * something the platform will never do. A combination the seller does not carry simply
 * goes unticked, and the catalogue shows it as having no sellers yet.
 *
 * **The count is shown before commitment, not after.** This recomputes as the seller
 * edits attributes precisely so that "two colours by three sizes is six permanent
 * versions" is visible while it can still be reconsidered.
 */
export function CombinationPreview({
  combinations,
  entries,
  currency,
  onToggle,
  onPrice,
  disabled,
  errorFor,
}: Props) {
  const carriedCount = combinations.filter((c) => entries[combinationKey(c)]?.carried).length;
  const isDefaultOnly = combinations.length === 1 && Object.keys(combinations[0]).length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">
          {isDefaultOnly ? 'One version' : `${combinations.length} versions`}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {isDefaultOnly
            ? 'This product comes one way, so it has a single version. Set your price for it.'
            : 'Every combination of the variations you defined. Tick the ones you stock and set your price for each.'}
        </p>
      </div>

      {/*
        Said once, plainly, and never as a warning. A seller stocking two of six
        versions is completely normal, and the other four are not a problem to solve.
      */}
      {!isDefaultOnly && (
        <Alert tone="info">
          All {combinations.length} versions become part of the product record, whether
          you stock them or not, so another seller can list the ones you do not. They are
          permanent once created and cannot be removed afterwards, which is worth knowing
          before you go on.
        </Alert>
      )}

      <ul className="flex flex-col gap-2">
        {combinations.map((combination) => {
          const key = combinationKey(combination);
          const entry = entries[key] ?? { price: '', carried: false };
          const error = errorFor?.(key);

          return (
            <li
              key={key}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <label className="flex flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={entry.carried}
                  disabled={disabled}
                  onChange={(event) => onToggle(key, event.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{describeCombination(combination)}</span>
              </label>

              {entry.carried ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{currency}</span>
                    <input
                      inputMode="decimal"
                      value={entry.price}
                      disabled={disabled}
                      placeholder="0.00"
                      aria-label={`Price for ${describeCombination(combination)}`}
                      onChange={(event) => onPrice(key, event.target.value)}
                      className="w-32 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
                </div>
              ) : (
                /*
                 * Not "unavailable" and not an error. This version exists in the
                 * catalogue and this seller does not stock it, which is an ordinary
                 * thing to be true.
                 */
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  You will not list this one
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {carriedCount === 0
          ? 'Tick at least one version to list. You are listing a product to sell it, so at least one has to have a price.'
          : `You are listing ${carriedCount} of ${combinations.length}.`}
      </p>

      {carriedCount > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Prices are shown to buyers exactly as entered, for example{' '}
          {formatMoney(850000, currency) ?? '8,500.00'}.
        </p>
      )}
    </div>
  );
}
