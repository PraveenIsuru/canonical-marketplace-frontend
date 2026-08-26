/**
 * Stores, listings, and the session user.
 *
 * Roles are derived, never stored. A user is a seller when `store` is present and
 * an administrator when `is_admin` is true. There is no roles array in any payload.
 */

import type { Coordinates } from './api';

export interface Store {
  id: number;
  name: string;
  category: string;
  contact_email: string;
  contact_phone: string | null;
  address_line: string;
  city: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  is_live: boolean;
}

/** The fuller record behind the store settings form. */
export interface OwnStore extends Store {
  geocode_source: 'provider' | 'manual';
}

/** The minimal store object carried on the session. */
export interface SessionStore {
  id: number;
  name: string;
  is_live: boolean;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  email_verified_at: string | null;
  is_admin: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Null when the user holds no store. Its presence is what makes them a seller. */
  store: SessionStore | null;
}

/**
 * One row of the seller list.
 *
 * `distance_km` is null, not zero, when the caller supplied no coordinates.
 * Render nothing rather than "0 km".
 */
export interface SellerListing {
  store: Store;
  variant_id: number;
  price_minor: number;
  currency: string;
  is_available: boolean;
  distance_km: number | null;
}

/** A seller's own attachment, editable from the listings screen. */
export interface OwnAttachment {
  id: number;
  variant_id: number;
  attribute_values: Record<string, string>;
  price_minor: number;
  currency: string;
  is_available: boolean;
}

/** Own listings arrive grouped by product, because that is how they are edited. */
export interface OwnListingGroup {
  product: { id: number; slug: string; name: string };
  attachments: OwnAttachment[];
  /** Present when a proposal blocks this product. The group renders blocked, not editable. */
  pending_proposal: { id: number; review_closes_at: string | null; status: 'pending' | 'escalated' } | null;
}

/** Store creation response. Geocoding failure returns 201, not a 4xx. */
export interface StoreCreated {
  id: number;
  name: string;
  geocoding_failed: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface StoreAnalytics {
  total_views: number;
  from: string;
  to: string;
  per_product: { product_id: number; slug: string; name: string; views: number }[];
}

export type StoreCoordinates = Coordinates;
