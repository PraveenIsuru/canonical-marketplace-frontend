'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyStore, placeStorePin } from '@/lib/api/stores';
import { ApiError } from '@/lib/api/client';
import { isPlausible } from '@/lib/location/geolocation';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Input, Skeleton } from '@/components/ui';
import type { Coordinates } from '@/types/api';

/**
 * Leaflet touches `window` at import time, so it cannot be server rendered at all.
 * The skeleton keeps the layout from jumping while the chunk loads.
 */
const StorePinMap = dynamic(
  () => import('@/components/seller/StorePinMap').then((module) => module.StorePinMap),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full" /> },
);

/** Falls back to the centre of Sri Lanka when there is nothing better to centre on. */
const DEFAULT_CENTRE: Coordinates = { lat: 7.8731, lng: 80.7718 };

/**
 * S-18 Manual pin placement.
 *
 * Reached when geocoding could not find the address. That is a normal outcome, not a
 * failure the seller caused, so nothing on this screen is styled as an error: it reads
 * as the next step in registration, which is what it is.
 *
 * The seller cannot leave without coordinates, because proximity sorting is how buyers
 * find them at all. A store with no location can never appear in a seller list.
 */
export function PinPlacement() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: store, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.stores.mine(),
    queryFn: getMyStore,
  });

  const [pin, setPin] = useState<Coordinates | null>(null);
  const [manual, setManual] = useState({ lat: '', lng: '' });
  const [invalid, setInvalid] = useState(false);

  const save = useMutation({
    mutationFn: ({ lat, lng }: Coordinates) => placeStorePin(lat, lng),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.stores.mine() });
      router.push('/dashboard');
      router.refresh();
    },
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your store could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  // Already placed, so centre on where the store currently is.
  const existing: Coordinates | null =
    store.latitude !== null && store.longitude !== null
      ? { lat: store.latitude, lng: store.longitude }
      : null;

  const chosen = pin ?? existing;
  const error = save.error instanceof ApiError ? save.error : null;

  function submitManual() {
    const next = { lat: Number(manual.lat), lng: Number(manual.lng) };

    if (Number.isNaN(next.lat) || Number.isNaN(next.lng) || !isPlausible(next)) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    setPin(next);
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Place {store.name} on the map</h1>
        {/*
          Informational, deliberately. Nothing went wrong that the seller needs to fix:
          the address simply could not be matched automatically, which is common for
          new or informally addressed premises.
        */}
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          We could not find <span className="font-medium">{store.address_line}, {store.city}</span>{' '}
          automatically, so please show us where it is. Buyers see sellers sorted by how
          close they are, so this is how they find you.
        </p>
      </div>

      <StorePinMap centre={existing ?? DEFAULT_CENTRE} pin={chosen} onPinChange={setPin} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Click the map to drop a pin, then drag it to adjust.
      </p>

      <details className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-medium">
          Enter coordinates instead
        </summary>
        {/*
          Kept available even when the map works. If tiles fail to load there has to be
          a way through, and some sellers will simply know their coordinates.
        */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Input
            label="Latitude"
            inputMode="decimal"
            placeholder="6.9271"
            value={manual.lat}
            onChange={(event) => setManual((p) => ({ ...p, lat: event.target.value }))}
            error={invalid ? 'Between -90 and 90.' : undefined}
          />
          <Input
            label="Longitude"
            inputMode="decimal"
            placeholder="79.8612"
            value={manual.lng}
            onChange={(event) => setManual((p) => ({ ...p, lng: event.target.value }))}
            error={invalid ? 'Between -180 and 180.' : undefined}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={submitManual}
            disabled={!manual.lat || !manual.lng}
          >
            Use these
          </Button>
        </div>
      </details>

      {chosen && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          Pin at {chosen.lat.toFixed(5)}, {chosen.lng.toFixed(5)}
        </p>
      )}

      {error && (
        <Alert tone="error">
          {error.fieldError('latitude') ?? error.fieldError('longitude') ?? error.message}
        </Alert>
      )}

      <div>
        <Button
          onClick={() => chosen && save.mutate(chosen)}
          // Disabled until a pin exists. Saving nothing would leave the store
          // permanently invisible with no sign of why.
          disabled={chosen === null}
          loading={save.isPending}
        >
          Save this location
        </Button>
        {chosen === null && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Drop a pin on the map, or enter coordinates, to continue.
          </p>
        )}
      </div>
    </div>
  );
}
