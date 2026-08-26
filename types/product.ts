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

/** A snapshot in the version chain. The chain is the audit record. */
export interface ProductVersion {
  version_number: number;
  created_at: string;
  is_admin_originated: boolean;
  causing_store: { id: number; name: string } | null;
  causing_admin: { id: number; name: string } | null;
}

export interface ProductVersionSnapshot extends ProductVersion {
  snapshot: Record<string, unknown>;
}
