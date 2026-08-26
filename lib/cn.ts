/** Joins class names, dropping falsy values. Keeps conditional classes readable. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
