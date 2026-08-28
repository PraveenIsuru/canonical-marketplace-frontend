/**
 * This application's own public origin.
 *
 * The same value `metadataBase` in the root layout uses, exported so structured data
 * can build absolute URLs from it. Next resolves relative paths in metadata against
 * `metadataBase` for us, but JSON-LD is a string we write ourselves, and schema.org
 * `@id` is an identifier rather than a link: a relative one identifies a different
 * thing on every host that serves the page, which defeats the point of having an id.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Turns a path into the absolute URL a crawler should see. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
