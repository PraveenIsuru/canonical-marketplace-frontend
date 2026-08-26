'use client';

import { useState } from 'react';
import { isPlausible, requestLocation } from '@/lib/location/geolocation';
import { Alert, Button, Input } from '@/components/ui';
import type { Coordinates } from '@/types/api';

interface Props {
  onResolved: (coordinates: Coordinates) => void;
  pending?: boolean;
}

/**
 * X-03 Location prompt and manual entry.
 *
 * Manual entry is presented as an equal path, not as a failure. A declined permission
 * prompt is a normal choice, so it gets no error styling.
 */
export function LocationPrompt({ onResolved, pending = false }: Props) {
  const [asking, setAsking] = useState(false);
  const [manual, setManual] = useState({ lat: '', lng: '' });
  const [invalid, setInvalid] = useState(false);
  const [browserDeclined, setBrowserDeclined] = useState(false);

  async function useBrowser() {
    setAsking(true);
    const coordinates = await requestLocation();
    setAsking(false);

    if (coordinates) {
      onResolved(coordinates);
      return;
    }

    // Denied, unavailable, or timed out. All three lead to the same manual field.
    setBrowserDeclined(true);
  }

  function submitManual() {
    const coordinates = { lat: Number(manual.lat), lng: Number(manual.lng) };

    if (Number.isNaN(coordinates.lat) || Number.isNaN(coordinates.lng) || !isPlausible(coordinates)) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    onResolved(coordinates);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={useBrowser} loading={asking} disabled={pending}>
          Use my current location
        </Button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">or enter it below</span>
      </div>

      {browserDeclined && (
        // Deliberately informational. Declining is a normal choice, not a mistake.
        <Alert tone="info">
          No location came back from your browser. Entering coordinates by hand works
          just as well.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Latitude"
          inputMode="decimal"
          placeholder="6.9271"
          value={manual.lat}
          onChange={(event) => setManual((p) => ({ ...p, lat: event.target.value }))}
          error={invalid ? 'Enter a latitude between -90 and 90.' : undefined}
        />
        <Input
          label="Longitude"
          inputMode="decimal"
          placeholder="79.8612"
          value={manual.lng}
          onChange={(event) => setManual((p) => ({ ...p, lng: event.target.value }))}
          error={invalid ? 'Enter a longitude between -180 and 180.' : undefined}
        />
      </div>

      <div>
        <Button type="button" onClick={submitManual} disabled={pending || !manual.lat || !manual.lng}>
          Save this location
        </Button>
      </div>
    </div>
  );
}
