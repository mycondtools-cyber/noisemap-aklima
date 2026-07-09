// Fetch building footprints from Overpass API with localStorage caching and
// exponential-backoff retries. Cache TTL is 1 hour; on failure the hook returns
// an empty list and surfaces the error message so the UI can decide what to do.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Building } from '../engine/types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_PREFIX = 'noisemap:overpass:';
const MAX_RETRIES = 3;

interface CacheEntry {
  ts: number;
  buildings: Building[];
}

interface OverpassElement {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    type: string;
    role: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function cacheKey(lat: number, lng: number, radius: number): string {
  return `${CACHE_PREFIX}${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}`;
}

function readCache(key: string): Building[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.buildings;
  } catch {
    return null;
  }
}

function writeCache(key: string, buildings: Building[]): void {
  try {
    const entry: CacheEntry = { ts: Date.now(), buildings };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Storage full or disabled — silent drop.
  }
}

function parseHeight(tags: Record<string, string> | undefined): number {
  if (!tags) return 6;
  if (tags.height) {
    const n = parseFloat(tags.height);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (Number.isFinite(levels) && levels > 0) return levels * 3;
  }
  return 6;
}

function elementToBuilding(el: OverpassElement): Building | null {
  const geom =
    el.geometry ??
    el.members?.find((m) => m.role === 'outer')?.geometry ??
    null;
  if (!geom || geom.length < 3) return null;
  const polygon: [number, number][] = geom.map((p) => [p.lat, p.lon]);
  return {
    id: `osm-${el.type}-${el.id}`,
    polygon,
    height: parseHeight(el.tags),
    protected: true,
    source: 'osm',
    osmId: el.id,
  };
}

async function fetchWithRetry(
  query: string,
  attempt = 0,
): Promise<OverpassResponse> {
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    return (await res.json()) as OverpassResponse;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const backoff = 500 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, backoff));
    return fetchWithRetry(query, attempt + 1);
  }
}

export interface UseOverpassResult {
  buildings: Building[];
  loading: boolean;
  error: string | null;
  refresh: (lat: number, lng: number, radius: number) => Promise<void>;
}

export function useOverpass(): UseOverpassResult {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (lat: number, lng: number, radius: number) => {
      const key = cacheKey(lat, lng, radius);
      const cached = readCache(key);
      if (cached) {
        setBuildings(cached);
        return;
      }
      setLoading(true);
      setError(null);
      inflight.current?.abort();
      inflight.current = new AbortController();
      try {
        const query = `[out:json][timeout:25];(way["building"](around:${radius},${lat},${lng});relation["building"](around:${radius},${lat},${lng}););out body geom;`;
        const json = await fetchWithRetry(query);
        const parsed = json.elements
          .map(elementToBuilding)
          .filter((b): b is Building => b !== null);
        writeCache(key, parsed);
        setBuildings(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      inflight.current?.abort();
    };
  }, []);

  return { buildings, loading, error, refresh };
}
