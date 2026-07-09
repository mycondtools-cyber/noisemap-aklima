// Photon (photon.komoot.io) — an open, OSM-based geocoding API.

import type { LatLng } from '../types';

const PHOTON_URL = 'https://photon.komoot.io/api';

export interface GeocodeResult {
  label: string;
  position: LatLng;
  city?: string;
  country?: string;
}

export async function geocode(
  query: string,
  limit = 5,
  lang: 'en' | 'pl' | 'uk' = 'en',
): Promise<GeocodeResult[]> {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=${lang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Photon request failed: ${res.status}`);
  const json = (await res.json()) as {
    features: {
      properties: Record<string, string>;
      geometry: { coordinates: [number, number] };
    }[];
  };
  return json.features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties;
    const parts = [p.name, p.street, p.housenumber, p.city, p.state, p.country]
      .filter(Boolean)
      .join(', ');
    return {
      label: parts,
      position: { lat, lng },
      city: p.city,
      country: p.country,
    };
  });
}
