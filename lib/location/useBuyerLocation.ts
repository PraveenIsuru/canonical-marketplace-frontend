'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { isPlausible, requestLocation } from '@/lib/location/geolocation';
import type { Coordinates } from '@/types/api';

const STORAGE_KEY = 'buyer_location';

/** Same-tab writes do not fire the native storage event, so one is raised by hand. */
const CHANGED_EVENT = 'buyer-location-changed';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED_EVENT, onChange);

  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED_EVENT, onChange);
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // A private window or blocked site data. Not knowing the location is supported.
    return null;
  }
}

/** The server has no localStorage, so it always renders the unknown-location state. */
function serverSnapshot(): string | null {
  return null;
}

function parse(raw: string | null): Coordinates | null {
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as Coordinates;

    return isPlausible(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The buyer's location for distance sorting (X-03).
 *
 * Backed by localStorage through useSyncExternalStore rather than an effect, so the
 * server render and the first client render agree on "unknown" and React reconciles
 * once without a setState during commit.
 *
 * Anonymous visitors keep the location locally so it survives navigation between
 * product pages. An authenticated visitor additionally persists it from the account
 * screen, which is what nearby availability alerts are calculated against. That write
 * is deliberately not done here: browsing should not silently change a saved setting.
 *
 * "Declined" is tracked separately from "unknown", because a visitor who said no
 * should not be asked again on every page, and their choice is a normal outcome
 * rather than an error.
 */
export function useBuyerLocation() {
  const raw = useSyncExternalStore(subscribe, readRaw, serverSnapshot);
  const coordinates = parse(raw);

  const [declined, setDeclined] = useState(false);
  const [asking, setAsking] = useState(false);

  const remember = useCallback((next: Coordinates) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGED_EVENT));
    } catch {
      // Storage unavailable. Nothing else to do; the caller still gets the value.
    }

    setDeclined(false);
  }, []);

  const askBrowser = useCallback(async () => {
    setAsking(true);
    const result = await requestLocation();
    setAsking(false);

    if (result) {
      remember(result);
      return;
    }

    // Denied, unavailable, or timed out. All three lead to manual entry, which is an
    // equal path rather than a fallback.
    setDeclined(true);
  }, [remember]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(CHANGED_EVENT));
    } catch {
      // Nothing to do.
    }

    setDeclined(false);
  }, []);

  return { coordinates, declined, asking, askBrowser, remember, clear };
}
