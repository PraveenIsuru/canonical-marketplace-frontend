/**
 * Query key factory.
 *
 * Two rules here are load bearing rather than stylistic:
 *
 *  - Seller list keys include the coordinates. Omitting them would serve one buyer's
 *    distance ordering to another buyer standing somewhere else.
 *  - Search keys include the mode. The same query string can return AI interpreted or
 *    keyword results, and those must never share a cache entry.
 */

import type { Coordinates } from '@/types/api';

export const queryKeys = {
  user: {
    current: () => ['user'] as const,
  },
  categories: {
    all: () => ['categories'] as const,
  },
  products: {
    all: () => ['products'] as const,
    list: (category?: string, page?: number) => ['products', 'list', { category, page }] as const,
    detail: (slug: string) => ['products', slug] as const,
    variants: (slug: string) => ['products', slug, 'variants'] as const,
    summary: (slug: string) => ['products', slug, 'summary'] as const,
    sellers: (slug: string, variantId?: number, coords?: Coordinates | null, filters?: unknown) =>
      ['products', slug, 'sellers', { variantId, lat: coords?.lat, lng: coords?.lng, filters }] as const,
    versions: (slug: string) => ['products', slug, 'versions'] as const,
    version: (slug: string, versionNumber: number) =>
      ['products', slug, 'versions', versionNumber] as const,
  },
  search: {
    query: (q: string, mode: 'ai' | 'keyword', category?: string, page?: number) =>
      ['search', q, mode, { category, page }] as const,
  },
  stores: {
    detail: (id: number) => ['stores', id] as const,
    mine: () => ['stores', 'mine'] as const,
    listings: () => ['stores', 'mine', 'listings'] as const,
    analytics: (from: string, to: string) => ['stores', 'mine', 'analytics', { from, to }] as const,
  },
  proposals: {
    mine: () => ['proposals', 'mine'] as const,
    toReview: () => ['proposals', 'to-review'] as const,
    detail: (id: number) => ['proposals', id] as const,
  },
  community: {
    posts: (slug: string) => ['community', slug, 'posts'] as const,
    replies: (slug: string, postId: number) => ['community', slug, 'posts', postId, 'replies'] as const,
    verification: (slug: string) => ['community', slug, 'verification'] as const,
  },
  wishlist: {
    all: () => ['wishlist'] as const,
  },
  jobs: {
    detail: (id: string) => ['jobs', id] as const,
  },
  admin: {
    escalations: () => ['admin', 'escalations'] as const,
    proposals: (page?: number) => ['admin', 'proposals', { page }] as const,
    proposal: (id: number) => ['admin', 'proposals', id] as const,
    products: (q?: string, category?: string, page?: number) =>
      ['admin', 'products', { q, category, page }] as const,
    product: (id: number) => ['admin', 'products', id] as const,
    metrics: () => ['admin', 'metrics'] as const,
  },
} as const;

/**
 * Staleness per data type, in milliseconds.
 *
 * These follow how often the underlying data actually changes, not a single global
 * guess. Product detail changes only when a version is created; a seller's price can
 * change at any moment.
 */
export const staleTimes = {
  productDetail: 5 * 60 * 1000,
  sellerList: 30 * 1000,
  communityPosts: 30 * 1000,
  sentimentSummary: 10 * 60 * 1000,
  proposalsToReview: 60 * 1000,
  wishlist: 60 * 1000,
  analytics: 5 * 60 * 1000,
} as const;
