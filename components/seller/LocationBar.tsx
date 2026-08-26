'use client';

import { useState } from 'react';
import { isPlausible } from '@/lib/location/geolocation';
import { useBuyerLocation } from '@/lib/location/useBuyerLocation';
import { Button } from '@/components/ui';

/**
 * X-03 Location prompt and manual entry, for catalogue flows.
 *
 * Manual entry is an equal path, not a fallback. A declined permission prompt is a
 * normal choice and gets no error styling, because nothing has gone wrong: the seller
 * list simply sorts by price instead of distance.
 *
 * This component reports nothing upward. It and its parent both read the same
 * external store through useBuyerLocation, so a location restored from storage on a
 * fresh page load reaches the seller list without a callback having to fire. An
 * earlier version passed the value up through onChange and silently lost exactly that
 * case: the bar showed a saved location while the list below it still sorted by price.
 */
export function LocationBar() {
  const { coordinates, declined, asking, askBrowser, remember, clear } = useBuyerLocation();
  const [manual, setManual] = useState({ lat: '', lng: '' });
  const [invalid, setInvalid] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function submitManual() {
    const next = { lat: Number(manual.lat), lng: Number(manual.lng) };

    if (Number.isNaN(next.lat) || Number.isNaN(next.lng) || !isPlausible(next)) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    remember(next);
    setExpanded(false);
  }

  if (coordinates) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
        <span className="text-zinc-600 dark:text-zinc-400">
          Showing distances from {coordinates.lat.toFixed(3)}, {coordinates.lng.toFixed(3)}
        </span>
        <button
          type="button"
          onClick={clear}
          className="underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          Share your location to sort sellers by how close they are.
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={askBrowser} loading={asking}>
          Use my location
        </Button>
        <button type="button" onClick={() => setExpanded((open) => !open)} className="underline">
          Enter it manually
        </button>
      </div>

      {declined && !expanded && (
        // Informational, deliberately. Declining is a normal choice, not a failure,
        // and the list still works without it.
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No location came back from your browser. You can type one in instead, or carry
          on without one and sellers will be sorted by price.
        </p>
      )}

      {(expanded || declined) && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Latitude</span>
            <input
              inputMode="decimal"
              placeholder="6.9271"
              value={manual.lat}
              onChange={(event) => setManual((p) => ({ ...p, lat: event.target.value }))}
              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Longitude</span>
            <input
              inputMode="decimal"
              placeholder="79.8612"
              value={manual.lng}
              onChange={(event) => setManual((p) => ({ ...p, lng: event.target.value }))}
              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <Button type="button" size="sm" onClick={submitManual} disabled={!manual.lat || !manual.lng}>
            Use this location
          </Button>
        </div>
      )}

      {invalid && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Enter a latitude between -90 and 90, and a longitude between -180 and 180.
        </p>
      )}
    </div>
  );
}
