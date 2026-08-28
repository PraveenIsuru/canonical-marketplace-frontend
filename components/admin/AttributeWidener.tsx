'use client';

import { useState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import type { AdminProductAttribute } from '@/types/admin';

/**
 * Adding options to the attributes a record already has.
 *
 * **Widening only, in both directions of the word.** An option list grows and never
 * shrinks, and the set of attributes itself never grows at all. Neither restriction is
 * a client side choice: the API enforces both, and both come from invariant 2.
 *
 * Removing an option would strand the combinations generated from it, and nothing in
 * this platform can remove a combination, so the option has to stay. Adding a *new
 * attribute* would leave every existing combination with no value for it, permanently,
 * for the same reason. So there is no remove control and no add-attribute control, and
 * neither is rendered disabled: a greyed out button would say the capability exists and
 * is merely unavailable to this person, which is the opposite of true.
 *
 * The new combination count is shown before committing, because widening a three option
 * attribute on a product with two others is not obviously six new rows until somebody
 * does the arithmetic.
 */
export function AttributeWidener({
  attributes,
  added,
  onChange,
  newCombinations,
  existingCombinations,
  error,
}: {
  attributes: AdminProductAttribute[];
  added: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
  newCombinations: number;
  existingCombinations: number;
  error?: string;
}) {
  if (attributes.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Attributes</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This product has no attributes, so it carries a single default combination. A
          record&apos;s attribute set is decided when it is created and cannot be added
          to afterwards.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Attributes</h2>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Options can be added. They cannot be removed, and no new attribute can be
        introduced, because every combination already generated would be left without a
        value for it.
      </p>

      {error && (
        <Alert tone="error" title="The attributes were refused">
          {error}
        </Alert>
      )}

      <ul className="flex flex-col gap-4">
        {attributes.map((attribute) => (
          <AttributeRow
            key={attribute.id}
            attribute={attribute}
            pending={added[attribute.name] ?? []}
            onAdd={(option) =>
              onChange({
                ...added,
                [attribute.name]: [...(added[attribute.name] ?? []), option],
              })
            }
            onUndo={(option) =>
              onChange({
                ...added,
                [attribute.name]: (added[attribute.name] ?? []).filter(
                  (pendingOption) => pendingOption !== option,
                ),
              })
            }
          />
        ))}
      </ul>

      {newCombinations > 0 && (
        <Alert tone="info" title={`This will generate ${newCombinations} new ${newCombinations === 1 ? 'combination' : 'combinations'}`}>
          <p>
            The record goes from {existingCombinations} to{' '}
            {existingCombinations + newCombinations} combinations when you save.
          </p>
          <p className="mt-2">
            Every existing combination and every existing listing is left exactly as it
            is. A shop carrying one of them keeps carrying it, at the same price.
          </p>
        </Alert>
      )}
    </section>
  );
}

function AttributeRow({
  attribute,
  pending,
  onAdd,
  onUndo,
}: {
  attribute: AdminProductAttribute;
  pending: string[];
  onAdd: (option: string) => void;
  onUndo: (option: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const alreadyPresent = (option: string): boolean =>
    [...attribute.options, ...pending].some(
      (existing) => existing.toLowerCase() === option.toLowerCase(),
    );

  const trimmed = draft.trim();
  const duplicate = trimmed !== '' && alreadyPresent(trimmed);

  function add() {
    if (trimmed === '' || duplicate) return;
    onAdd(trimmed);
    setDraft('');
  }

  return (
    <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="font-medium">{attribute.name}</p>

      <ul className="mt-2 flex flex-wrap gap-2">
        {attribute.options.map((option) => (
          <li
            key={option}
            className="rounded-md bg-zinc-100 px-2 py-0.5 text-sm dark:bg-zinc-800"
          >
            {option}
          </li>
        ))}
        {pending.map((option) => (
          <li
            key={option}
            className="flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-0.5 text-sm text-green-900 dark:bg-green-950 dark:text-green-100"
          >
            {option}
            <span className="text-xs">new</span>
            {/* Undoes an unsaved addition. Nothing on the record is being removed. */}
            <button
              type="button"
              onClick={() => onUndo(option)}
              aria-label={`Do not add ${option}`}
              className="underline"
            >
              undo
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <Input
            label={`Add an option to ${attribute.name}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={duplicate ? 'That option is already there.' : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                // Otherwise Enter submits the surrounding form and saves the record.
                event.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={add} disabled={trimmed === '' || duplicate}>
          Add option
        </Button>
      </div>
    </li>
  );
}
