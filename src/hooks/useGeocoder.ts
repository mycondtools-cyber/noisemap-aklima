// Photon geocoder client with a 1 req/s throttle. Returns the top matches
// re-shaped into a friendly {display_name, lat, lng} tuple.

import { useCallback, useRef, useState } from 'react';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const MIN_INTERVAL_MS = 1000;

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    country?: string;
    postcode?: string;
    state?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function displayName(props: PhotonFeature['properties']): string {
  const parts = [
    [props.street, props.housenumber].filter(Boolean).join(' '),
    props.postcode,
    props.city,
    props.state,
    props.country,
  ].filter(Boolean);
  const label = parts.join(', ');
  return label || props.name || '';
}

export function useGeocoder() {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCallAt = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (pending.current) clearTimeout(pending.current);
    const now = Date.now();
    const wait = Math.max(0, lastCallAt.current + MIN_INTERVAL_MS - now);
    pending.current = setTimeout(async () => {
      lastCallAt.current = Date.now();
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=5`,
        );
        if (!res.ok) throw new Error(`Photon ${res.status}`);
        const json = (await res.json()) as PhotonResponse;
        const mapped: GeocodeResult[] = json.features.map((f) => ({
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          display_name: displayName(f.properties),
        }));
        setResults(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, wait);
  }, []);

  return { results, loading, error, search };
}
