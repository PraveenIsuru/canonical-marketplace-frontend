'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

/**
 * The specification map, edited as a whole.
 *
 * EP-43 **replaces** this map rather than merging into it, so a key left out of the
 * request is removed from the record. That is why this is a full editor with a remove
 * control per row rather than an add-only form: the endpoint's semantics are wholesale
 * replacement, and an interface that could only add would make removal impossible while
 * looking like it worked.
 *
 * A specification can be removed where an attribute option cannot, and the difference
 * is not arbitrary: nothing is generated from a specification. No combination refers to
 * it, so nothing is stranded by its going.
 */
export function SpecificationEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = Object.entries(value);

  function update(key: string, next: string) {
    onChange({ ...value, [key]: next });
  }

  function remove(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  function add() {
    const key = newKey.trim();
    if (key === '') return;

    onChange({ ...value, [key]: newValue });
    setNewKey('');
    setNewValue('');
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Specifications</h2>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Free form facts about the product. Removing one here removes it from the record
        when you save, because the whole map is replaced rather than patched.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">None recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(([key, entryValue]) => (
            <li key={key} className="flex flex-wrap items-end gap-2">
              <span className="w-32 shrink-0 pb-2 text-sm font-medium">{key}</span>
              <div className="min-w-[12rem] flex-1">
                <Input
                  label={`${key} value`}
                  aria-label={`${key} value`}
                  value={entryValue}
                  onChange={(event) => update(key, event.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(key)}
                className="pb-2 text-sm text-red-700 underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <div className="min-w-[10rem] flex-1">
          <Input
            label="New specification"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="Battery"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <Input
            label="Value"
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            placeholder="5200 mAh"
          />
        </div>
        <Button type="button" variant="secondary" onClick={add} disabled={newKey.trim() === ''}>
          Add
        </Button>
      </div>
    </section>
  );
}
