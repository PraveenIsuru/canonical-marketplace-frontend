'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Coordinates } from '@/types/api';

interface Props {
  centre: Coordinates;
  pin: Coordinates | null;
  onPinChange: (coordinates: Coordinates) => void;
}

/**
 * The draggable pin map.
 *
 * Loaded only through next/dynamic with ssr false, because Leaflet touches `window` at
 * import time and would crash a server render.
 *
 * Clicking the map and dragging the marker both set the pin, since neither is obviously
 * the "right" gesture to somebody meeting this screen once.
 */
export function StorePinMap({ centre, pin, onPinChange }: Props) {
  const [tilesFailed, setTilesFailed] = useState(false);

  if (tilesFailed) {
    /*
     * Tiles can fail where the map itself cannot help: an offline machine, a blocked
     * tile host, a missing NEXT_PUBLIC_MAP_TILE_URL. The numeric fields on the parent
     * screen remain the way through, so this says so rather than showing grey squares.
     */
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        The map could not load. Enter the latitude and longitude below instead.
      </div>
    );
  }

  return (
    <MapContainer
      center={[centre.lat, centre.lng]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-md"
    >
      <TileLayer
        url={process.env.NEXT_PUBLIC_MAP_TILE_URL ?? ''}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        eventHandlers={{ tileerror: () => setTilesFailed(true) }}
      />

      <ClickToPlace onPlace={onPinChange} />

      {pin && <DraggablePin position={pin} onMove={onPinChange} />}
    </MapContainer>
  );
}

function ClickToPlace({ onPlace }: { onPlace: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click: (event) => onPlace({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });

  return null;
}

function DraggablePin({
  position,
  onMove,
}: {
  position: Coordinates;
  onMove: (coordinates: Coordinates) => void;
}) {
  const ref = useRef<LeafletMarker | null>(null);
  const [icon, setIcon] = useState<import('leaflet').Icon | null>(null);

  useEffect(() => {
    /*
     * Leaflet's default marker icon resolves its image by a relative path that a
     * bundler rewrites, so the pin renders invisibly. Building the icon explicitly
     * from the packaged assets is the standard fix, and it has to happen on the client
     * because the import touches window.
     */
    let cancelled = false;

    void (async () => {
      const leaflet = await import('leaflet');
      const [marker, marker2x, shadow] = await Promise.all([
        import('leaflet/dist/images/marker-icon.png'),
        import('leaflet/dist/images/marker-icon-2x.png'),
        import('leaflet/dist/images/marker-shadow.png'),
      ]);

      if (cancelled) return;

      setIcon(
        new leaflet.Icon({
          iconUrl: marker.default.src ?? (marker.default as unknown as string),
          iconRetinaUrl: marker2x.default.src ?? (marker2x.default as unknown as string),
          shadowUrl: shadow.default.src ?? (shadow.default as unknown as string),
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!icon) return null;

  return (
    <Marker
      position={[position.lat, position.lng]}
      draggable
      icon={icon}
      ref={ref}
      eventHandlers={{
        dragend: () => {
          const next = ref.current?.getLatLng();
          if (next) onMove({ lat: next.lat, lng: next.lng });
        },
      }}
    />
  );
}
