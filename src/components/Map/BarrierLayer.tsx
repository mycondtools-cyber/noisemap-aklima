import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMap } from './MapContext';
import { useStore } from '../../store';

const SRC_ID = 'barriers-src';
const LAYER_ID = 'barriers-layer';

export default function BarrierLayer() {
  const map = useMap();
  const barriers = useStore((s) => s.barriers);

  useEffect(() => {
    if (!map) return;
    const features = barriers.map((b) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: b.line.map(([lat, lng]) => [lng, lat]),
      },
      properties: { id: b.id, height: b.height },
    }));
    const geojson = { type: 'FeatureCollection' as const, features };
    const existing = map.getSource(SRC_ID);
    if (existing && 'setData' in existing) {
      (existing as GeoJSONSource).setData(geojson);
    } else {
      map.addSource(SRC_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SRC_ID,
        paint: {
          'line-color': '#7c3aed',
          'line-width': 3,
        },
      });
    }
  }, [map, barriers]);

  return null;
}
