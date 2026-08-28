/**
 * The canonical product record.
 *
 * Note what is absent: there is no owner, creator, or `created_by_store_id` field
 * anywhere in this file. Records are platform owned, and the backend never emits
 * that attribution. Adding it here would be the first step to rendering it.
 */

export interface ProductImage {
  id: number;
  url: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  position: number;
}

export interface ProductAttribute {
  id: number;
  name: string;
  options: string[];
  position: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  specifications: Record<string, unknown>;
  images: ProductImage[];
  attributes: ProductAttribute[];
  current_version_number: number;
  seller_count: number;
}

/** The card shape used by catalogue listings and search results. */
export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  category: string;
  primary_image: ProductImage | null;
  /** Null when no live store carries this product. Such products stay visible. */
  lowest_price_minor: number | null;
  currency: string | null;
  seller_count: number;
}

/**
 * A generated variant combination.
 *
 * Every combination is returned by the API, including those with a seller count of
 * zero. They render as "No sellers yet" and are never hidden, because generated
 * combinations are permanent and cannot be removed by anyone.
 */
export interface Variant {
  id: number;
  product_id: number;
  attribute_values: Record<string, string>;
  is_default: boolean;
  seller_count: number;
  lowest_price_minor: number | null;
}

export interface SentimentSummary {
  summary: string;
  generated_at: string;
}

export interface Category {
  name: string;
  product_count: number;
}

/**
 * One entry in the version chain, which is the audit record (EP-46).
 *
 * Rewritten at M10 rather than extended. The M0 version of this file guessed at
 * `causing_store` and `causing_admin`, and neither is what shipped. Section 11.11 is
 * the authority.
 *
 * **No administrator is named.** An administrator edit says so through
 * `is_admin_originated` and carries a null store. **There is no proposal id either**:
 * EP-29 answers 404 to any store that was neither the proposer nor a frozen reviewer,
 * so an id here would be a link that mostly does not open.
 *
 * A rejected proposal writes no version at all, so nothing in a chain describes a
 * change that was argued for and refused.
 */
export interface ProductVersion {
  version_number: number;
  created_at: string;
  is_admin_originated: boolean;
  caused_by_store: { id: number; name: string } | null;
  /**
   * Which top level parts of the snapshot differ from the version before.
   *
   * **Empty on version 1**, which created the record rather than changing it.
   */
  changed_fields: string[];
}

/** The record state at one version, as returned by EP-47. */
export interface ProductVersionSnapshotFields {
  name: string;
  slug: string;
  description: string | null;
  category: string;
  specifications: Record<string, unknown>;
  attributes: { name: string; options: string[]; position: number }[];
  variants: {
    attribute_values: Record<string, string>;
    combination_hash: string;
    is_default: boolean;
  }[];
}

/**
 * EP-47. The list entry plus the whole record as it stood.
 *
 * A snapshot rather than a diff, so reading one version costs a single row instead of
 * replaying the chain. There is no rollback control anywhere and none is planned: an
 * administrator wanting an old value back edits forward, which writes a further
 * version.
 */
export interface ProductVersionSnapshot extends ProductVersion {
  snapshot: ProductVersionSnapshotFields;
}
