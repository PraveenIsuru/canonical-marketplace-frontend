/**
 * The variant combination preview.
 *
 * This mirrors the generation the backend performs on submit, and its whole purpose is
 * that the seller sees the number **before** committing to it. Three attributes of
 * four options each is sixty four permanent combinations, and finding that out
 * afterwards is too late: there is no path anywhere, for anyone, that removes a
 * generated combination once it exists.
 *
 * Being a preview, it is allowed to be wrong in one direction only. It must never show
 * fewer combinations than the backend will create.
 */

import type { AttributeDefinition } from '@/types/attach';

/**
 * The cross product of every attribute option.
 *
 * With no attributes this returns a single empty combination, which is not a special
 * case bolted on. The cross product of no sets is one empty tuple, and that is exactly
 * the rule the platform wants: a product with no meaningful variation carries one
 * default variant rather than none.
 *
 * Option order is preserved through the expansion, because a seller who typed Red
 * before Black expects to see them in that order.
 */
export function buildCombinations(
  attributes: AttributeDefinition[],
): Record<string, string>[] {
  let combinations: Record<string, string>[] = [{}];

  for (const attribute of attributes) {
    const name = attribute.name.trim();
    const options = attribute.options.map((option) => option.trim()).filter((o) => o !== '');

    // An attribute still being typed has no name or no options yet. Skipping it keeps
    // the preview stable while the seller works, instead of flickering to zero.
    if (name === '' || options.length === 0) continue;

    const expanded: Record<string, string>[] = [];

    for (const combination of combinations) {
      for (const option of options) {
        expanded.push({ ...combination, [name]: option });
      }
    }

    combinations = expanded;
  }

  return combinations;
}

/**
 * A stable identity for a combination, used as a React key and to match a combination
 * against the seller's carried list.
 *
 * Keys are sorted before joining, so two combinations differing only in key order
 * produce the same identity. That mirrors the backend, which hashes sorted attribute
 * values for exactly the same reason.
 */
export function combinationKey(combination: Record<string, string>): string {
  const entries = Object.entries(combination).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return '(default)';

  return entries.map(([name, value]) => `${name}=${value}`).join('|');
}

/** Human readable, for a row in the preview. */
export function describeCombination(combination: Record<string, string>): string {
  const entries = Object.entries(combination);

  if (entries.length === 0) return 'Single default version';

  return entries.map(([name, value]) => `${name}: ${value}`).join(', ');
}

/**
 * Attributes as the API wants them, with the half typed rows dropped.
 *
 * The form lets a seller add an empty attribute row and fill it in afterwards, so the
 * state legitimately holds rows that are not ready to send yet.
 */
export function cleanAttributes(attributes: AttributeDefinition[]): AttributeDefinition[] {
  return attributes
    .map((attribute) => ({
      name: attribute.name.trim(),
      options: attribute.options.map((option) => option.trim()).filter((option) => option !== ''),
    }))
    .filter((attribute) => attribute.name !== '' && attribute.options.length > 0);
}

/**
 * Names that would collide once the API compares them.
 *
 * A combination is a map keyed by attribute name, so two attributes sharing one would
 * silently overwrite each other and generate half the combinations the seller defined,
 * with nothing on screen indicating anything was lost.
 */
export function duplicateAttributeNames(attributes: AttributeDefinition[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const attribute of cleanAttributes(attributes)) {
    const key = attribute.name.toLowerCase();
    if (seen.has(key)) duplicates.add(attribute.name);
    seen.add(key);
  }

  return [...duplicates];
}

/** Options repeated within one attribute would generate the same combination twice. */
export function hasDuplicateOptions(attribute: AttributeDefinition): boolean {
  const options = attribute.options
    .map((option) => option.trim().toLowerCase())
    .filter((option) => option !== '');

  return new Set(options).size !== options.length;
}
