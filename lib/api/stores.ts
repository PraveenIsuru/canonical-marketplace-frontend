/**
 * Seller onboarding (EP-16, EP-17, EP-18, EP-54).
 *
 * Every call here is authenticated, so it goes through this application's own proxy at
 * `/api/proxy`, which attaches the Bearer token server side. The token lives in an
 * httpOnly cookie and is never readable by this code.
 *
 * That is the opposite of the catalogue helpers, which are public reads fetched server
 * side straight from Laravel.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import { ownStoreSchema, type OwnStore } from '@/lib/schemas/catalogue';

/** The fields a seller supplies at registration. Coordinates are never among them. */
export interface StoreRegistrationDetails {
  name: string;
  category: string;
  contact_email: string;
  contact_phone?: string | null;
  address_line: string;
  city: string;
}

export type StoreSettingsDetails = Partial<StoreRegistrationDetails>;

function parse(payload: unknown, endpoint: string): OwnStore {
  const result = ownStoreSchema.safeParse(payload);

  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(
      `${endpoint} returned an unexpected shape at "${first?.path.join('.') || '(root)'}": ${first?.message}. ` +
        'The API and development-docs/shared/api-contract.md disagree.',
    );
  }

  return result.data;
}

/**
 * EP-16 Register a store.
 *
 * **A failed geocode is not an error.** The API answers 201 with the store created,
 * the submitted details kept, and `geocoding_failed: true` inside `data`. That is a
 * routing signal into manual pin placement, not a failure to report, and the caller
 * must not present it as one.
 *
 * Throws only for genuine refusals: 409 `store_exists` and 422 `validation_failed`.
 */
export async function registerStore(details: StoreRegistrationDetails): Promise<OwnStore> {
  const payload = await apiFetch<unknown>('/api/stores', { method: 'POST', body: details });

  return parse(payload, 'POST /api/stores');
}

/** EP-54 The caller's own store, which prefills the settings form. */
export async function getMyStore(): Promise<OwnStore> {
  const payload = await apiFetch<unknown>('/api/stores/mine');

  return parse(payload, 'GET /api/stores/mine');
}

/**
 * EP-18 Update the editable details.
 *
 * Re-geocodes only when the address or city changed. If that fails the previous
 * coordinates are kept and `geocoding_failed` is set, so the seller can place a pin
 * without having lost the location they already had.
 */
export async function updateMyStore(details: StoreSettingsDetails): Promise<OwnStore> {
  const payload = await apiFetch<unknown>('/api/stores/mine', { method: 'PATCH', body: details });

  return parse(payload, 'PATCH /api/stores/mine');
}

/** EP-17 Place the pin by hand. Records the source as manual placement. */
export async function placeStorePin(latitude: number, longitude: number): Promise<OwnStore> {
  const payload = await apiFetch<unknown>('/api/stores/mine/pin', {
    method: 'POST',
    body: { latitude, longitude },
  });

  return parse(payload, 'POST /api/stores/mine/pin');
}

/**
 * True when a store has no usable location yet.
 *
 * Either the write said geocoding failed, or the coordinates are simply absent. Both
 * mean the same thing to the interface: the seller has to place a pin. Checking both
 * matters because EP-54 does not carry `geocoding_failed` at all, so a settings page
 * loading a half configured store can only tell from the null coordinates.
 */
export function needsPinPlacement(store: OwnStore): boolean {
  return store.geocoding_failed === true || store.latitude === null || store.longitude === null;
}

/** A store already exists for this account. */
export function isStoreExists(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'store_exists';
}
