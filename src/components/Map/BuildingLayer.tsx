import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMap } from './MapContext';
import { useStore } from '../../store';

const SRC_ID = 'buildings-src';
const LAYER_ID = 'buildings-layer';

export default function BuildingLayer() {
  const map = useMap();
  const buildings = useStore((s) => s.buildings);

  useEffect(() => {
    if (!map) return;
    // GeoJSON expects [lng, lat] rings; our Building.polygon is [lat, lng].
    const features = buildings.map((b) => {
      const ring = b.polygon.map(([lat, lng]) => [lng, lat] as [number, number]);
      if (ring.length > 0) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      }
      return {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [ring] },
        properties: {
          id: b.id,
          protected: b.protected,
          height: b.height,
        },
      };
    });
    const geojson = { type: 'FeatureCollection' as const, features };
    const existing = map.getSource(SRC_ID);
    if (existing && 'setData' in existing) {
      (existing as GeoJSONSource).setData(geojson);
    } else {
      map.addSource(SRC_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_ID,
        type: 'fill',
        source: SRC_ID,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['get', 'protected'], false],
            '#3b82f6',
            '#9ca3af',
          ],
          'fill-opacity': 0.35,
          'fill-outline-color': '#1e40af',
        },
      });
    }
  }, [map, buildings]);

  return null;
}
