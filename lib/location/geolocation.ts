/**
 * Browser geolocation (X-03).
 *
 * A null result is not an error state. The visitor enters a location by hand instead,
 * which is an equal path rather than a fallback, so permission denied, an unavailable
 * API, and a timeout all resolve to the same null.
 */

import type { Coordinates } from '@/types/api';

/** Eight seconds, after which the manual field is offered instead. */
const TIMEOUT_MS = 8000;

export async function requestLocation(): Promise<Coordinates | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => resolve(null),
      { timeout: TIMEOUT_MS },
    );
  });
}

/** Plausible bounds, matching what the API validates. Catches a typo before a round trip. */
export function isPlausible({ lat, lng }: Coordinates): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
