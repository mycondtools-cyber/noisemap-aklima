// Overpass API service: fetch building footprints + heights within a radius.
// Responses are cached in localStorage keyed by (lat, lng, radius) rounded to
// coarse buckets, so repeated pans don't hammer the server.

import type { Building, LatLng } from '../types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_PREFIX = 'aklima:overpass:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

interface OverpassResponse {
  elements: {
    type: 'way' | 'relation';
    id: number;
    geometry?: { lat: number; lon: number }[];
    tags?: Record<string, string>;
    members?: { role: string; geometry?: { lat: number; lon: number }[] }[];
  }[];
}

function bucketKey(center: LatLng, radiusMeters: number): string {
  const bucketed = {
    lat: Math.round(center.lat * 1e4) / 1e4,
    lng: Math.round(center.lng * 1e4) / 1e4,
    r: radiusMeters,
  };
  return `${CACHE_PREFIX}${bucketed.lat},${bucketed.lng},${bucketed.r}`;
}

function readCache(key: string): Building[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: Building[] };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: Building[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // localStorage full or unavailable — skip caching silently.
  }
}

function parseHeight(tags: Record<string, string> | undefined): number {
  if (!tags) return 6;
  if (tags.height) {
    const h = parseFloat(tags.height);
    if (!Number.isNaN(h) && h > 0) return h;
  }
  if (tags['building:levels']) {
    const lvls = parseFloat(tags['building:levels']);
    if (!Number.isNaN(lvls) && lvls > 0) return lvls * 3;
  }
  return 6;
}

function isProtectedBuilding(tags: Record<string, string> | undefined): boolean {
  if (!tags) return true;
  const b = tags.building;
  if (!b) return true;
  const neutral = new Set([
    'garage',
    'shed',
    'roof',
    'carport',
    'greenhouse',
    'ruins',
    'construction',
    'industrial',
    'warehouse',
  ]);
  return !neutral.has(b);
}

export async function fetchBuildings(
  center: LatLng,
  radiusMeters: number,
): Promise<Building[]> {
  const key = bucketKey(center, radiusMeters);
  const cached = readCache(key);
  if (cached) return cached;

  const query = `
    [out:json][timeout:25];
    (
      way["building"](around:${radiusMeters},${center.lat},${center.lng});
      relation["building"](around:${radiusMeters},${center.lat},${center.lng});
    );
    out geom tags;
  `.trim();

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`);
  const json = (await res.json()) as OverpassResponse;

  const buildings: Building[] = [];
  for (const el of json.elements) {
    const geom = el.geometry;
    if (!geom || geom.length < 3) continue;
    const polygon: [number, number][] = geom.map((g) => [g.lat, g.lon]);
    buildings.push({
      id: `osm-${el.type}-${el.id}`,
      polygon,
      height: parseHeight(el.tags),
      protected: isProtectedBuilding(el.tags),
      source: 'osm',
      osmId: el.id,
    });
  }

  writeCache(key, buildings);
  return buildings;
}
