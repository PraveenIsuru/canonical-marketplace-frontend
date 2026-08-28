'use client';

import { formatMoney } from '@/lib/format/money';
import { cn } from '@/lib/cn';
import type { ProductDetail, Variant } from '@/lib/schemas/catalogue';

/** Above this many combinations the button grid becomes unusable. */
const DROPDOWN_THRESHOLD = 50;

interface Props {
  product: ProductDetail;
  variants: Variant[];
  selected: Variant | null;
  onSelect: (variant: Variant) => void;
}

/**
 * Variant selection.
 *
 * Three rules here are load bearing rather than stylistic.
 *
 * Every generated combination renders, including those no seller carries. They stay
 * selectable and are labelled "No sellers yet". Hiding them would misrepresent the
 * catalogue, because combinations are permanent and a buyer looking for one deserves
 * to learn that nobody stocks it rather than that it does not exist.
 *
 * A product with a single default variant renders no selector at all. One choice is
 * not a choice.
 *
 * Above fifty combinations the flat button grid becomes a wall, so it switches to one
 * dropdown per attribute.
 */
export function VariantSelector({ product, variants, selected, onSelect }: Props) {
  // A single default variant means the product has no meaningful variation.
  if (variants.length <= 1 || (variants.length === 1 && variants[0]?.is_default)) {
    return null;
  }

  if (variants.length > DROPDOWN_THRESHOLD) {
    return <DropdownSelector product={product} variants={variants} selected={selected} onSelect={onSelect} />;
  }

  return <ButtonGridSelector product={product} variants={variants} selected={selected} onSelect={onSelect} />;
}

/**
 * The flat button grid, for products with a manageable number of combinations.
 *
 * ## Why this handles arrow keys
 *
 * The group announces itself as a `radiogroup` and each button as a `radio`, which is
 * the right description: exactly one combination is chosen at a time. But that role
 * carries a promise. A screen reader tells somebody they are on "radio button, 3 of 6",
 * and the keyboard convention for a radio group is that arrow keys move between the
 * options while Tab leaves the group entirely.
 *
 * Announcing the role without implementing the keys is worse than using plain buttons
 * would have been, because it describes behaviour the component does not have and
 * leaves somebody pressing an arrow key that does nothing. Added at M12, during the
 * accessibility pass, on the most important public screen in the system.
 *
 * A roving tabindex is what makes Tab leave the group rather than walking through every
 * combination: only the selected option is reachable by Tab, and the arrows move within.
 */
function ButtonGridSelector({ variants, selected, onSelect }: Props) {
  const selectedIndex = Math.max(
    0,
    variants.findIndex((variant) => variant.id === selected?.id),
  );

  /**
   * Arrow keys move and select in one action, which is the radio group convention
   * rather than an interpretation of it: in a radio group, moving *is* choosing.
   *
   * Wraps at both ends, and Home and End jump to the extremes, because a product with
   * forty combinations is a long way to hold an arrow key.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

    if (!keys.includes(event.key)) return;

    // The page would otherwise scroll under the arrow keys while the selection moved.
    event.preventDefault();

    const last = variants.length - 1;

    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? (selectedIndex + 1) % variants.length
            : (selectedIndex - 1 + variants.length) % variants.length;

    const variant = variants[next];

    if (variant) {
      onSelect(variant);

      /*
       * Focus follows the selection. Without this the browser keeps focus on the button
       * that has just become untabbable, and the next arrow press comes from nowhere.
       */
      event.currentTarget.querySelector<HTMLButtonElement>(`[data-variant="${variant.id}"]`)?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 id="variant-selector-label" className="text-sm font-medium">
        Choose a version
      </h2>

      <div
        role="radiogroup"
        aria-labelledby="variant-selector-label"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2"
      >
        {variants.map((variant, index) => {
          const carried = variant.seller_count > 0;
          const isSelected = selected?.id === variant.id;

          return (
            <button
              key={variant.id}
              data-variant={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              /*
               * The roving tabindex. Only one button in the group is a tab stop, so Tab
               * moves past the whole selector rather than through every combination,
               * and the arrows move within it. Falls back to the first option when
               * nothing is selected yet, so the group is always reachable.
               */
              tabIndex={index === selectedIndex ? 0 : -1}
              onClick={() => onSelect(variant)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                isSelected
                  ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100'
                  : 'border-zinc-300 hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500',
                // Dimmed, never disabled. A buyer must still be able to select it and
                // read that nobody carries it.
                !carried && 'opacity-70',
              )}
            >
              <span className="font-medium">{describe(variant)}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {carried
                  ? formatMoney(variant.lowest_price_minor, 'LKR') ?? 'Price on request'
                  : 'No sellers yet'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One dropdown per attribute, for products with a large cross product.
 *
 * Changing any dropdown resolves the combination matching every current selection.
 * Because generation is a full cross product, that combination always exists.
 */
function DropdownSelector({ product, variants, selected, onSelect }: Props) {
  const current = selected?.attribute_values ?? {};

  function choose(attributeName: string, option: string): void {
    const wanted = { ...current, [attributeName]: option };

    const match = variants.find((variant) =>
      Object.entries(wanted).every(([key, value]) => variant.attribute_values[key] === value),
    );

    if (match) onSelect(match);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Choose a version</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {product.attributes.map((attribute) => (
          <label key={attribute.id} className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{attribute.name}</span>
            <select
              value={current[attribute.name] ?? ''}
              onChange={(event) => choose(attribute.name, event.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {attribute.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {selected && selected.seller_count === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No sellers yet for {describe(selected)}.
        </p>
      )}
    </div>
  );
}

/** Renders a combination as a readable label, for example "Black, 128GB". */
export function describe(variant: Variant): string {
  const values = Object.values(variant.attribute_values);

  return values.length > 0 ? values.join(', ') : 'Standard';
}
