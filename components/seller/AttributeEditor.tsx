'use client';

import { Button, Input } from '@/components/ui';
import { hasDuplicateOptions } from '@/lib/attach/combinations';
import type { AttributeDefinition } from '@/types/attach';

interface Props {
  attributes: AttributeDefinition[];
  onChange: (attributes: AttributeDefinition[]) => void;
  disabled?: boolean;
}

/**
 * Step 3 of S-25. Defining the ways the product varies.
 *
 * A note on what removal means here, because there are two different things and only
 * one of them is forbidden.
 *
 * Removing an attribute row **on this screen** is fine. Nothing has been generated
 * yet: this is a form the seller is still filling in, and taking a row out is editing
 * a draft. What no control anywhere may do is remove a variant combination that has
 * been generated, because those are permanent once the product is created. The
 * combination preview at the next step therefore has no remove control at all.
 *
 * A product with no attributes is entirely normal. It carries a single default
 * variant, and the seller is told so rather than being pushed into inventing variation
 * that does not exist.
 */
export function AttributeEditor({ attributes, onChange, disabled }: Props) {
  function updateAttribute(index: number, patch: Partial<AttributeDefinition>) {
    onChange(attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function updateOption(attributeIndex: number, optionIndex: number, value: string) {
    const attribute = attributes[attributeIndex];
    const options = attribute.options.map((o, i) => (i === optionIndex ? value : o));
    updateAttribute(attributeIndex, { options });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">How does it vary?</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Colour, size, capacity, and so on. Add the ones a buyer would choose between.
          If this product comes in exactly one version, skip this step.
        </p>
      </div>

      {attributes.length === 0 && (
        <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No variations yet. Left as it is, this product gets a single default version,
          which is the right answer for anything that only comes one way.
        </p>
      )}

      <ul className="flex flex-col gap-6">
        {attributes.map((attribute, attributeIndex) => (
          <li
            key={attributeIndex}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label={`Variation ${attributeIndex + 1}`}
                  value={attribute.name}
                  disabled={disabled}
                  placeholder="Colour"
                  onChange={(event) =>
                    updateAttribute(attributeIndex, { name: event.target.value })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange(attributes.filter((_, i) => i !== attributeIndex))}
              >
                Remove
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Options</span>

              {attribute.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    value={option}
                    disabled={disabled}
                    placeholder={optionIndex === 0 ? 'Black' : 'Another option'}
                    onChange={(event) =>
                      updateOption(attributeIndex, optionIndex, event.target.value)
                    }
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  {attribute.options.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        updateAttribute(attributeIndex, {
                          options: attribute.options.filter((_, i) => i !== optionIndex),
                        })
                      }
                    >
                      &times;
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  updateAttribute(attributeIndex, { options: [...attribute.options, ''] })
                }
              >
                Add an option
              </Button>

              {hasDuplicateOptions(attribute) && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Two options are the same. Each one has to be different, or they would
                  produce the same version twice.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/*
        Capped at five to match the API. The real reason is the cross product: five
        attributes of five options each is over three thousand permanent combinations,
        and nothing can remove them afterwards.
      */}
      {attributes.length < 5 && (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => onChange([...attributes, { name: '', options: [''] }])}
        >
          Add a variation
        </Button>
      )}
    </div>
  );
}
