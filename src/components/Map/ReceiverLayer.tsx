import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMap } from './MapContext';
import { useStore } from '../../store';

const SRC_ID = 'receivers-src';
const LAYER_ID = 'receivers-layer';

export default function ReceiverLayer() {
  const map = useMap();
  const receivers = useStore((s) => s.receivers);
  const results = useStore((s) => s.results);

  useEffect(() => {
    if (!map) return;
    const perReceiver = new Map<string, number>();
    if (results?.receivers) {
      for (const r of results.receivers) {
        perReceiver.set(r.receiverId, Math.max(r.dBAday, r.dBAnight));
      }
    }
    const features = receivers.map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        LpA: perReceiver.get(r.id) ?? -1,
      },
    }));
    const geojson = { type: 'FeatureCollection' as const, features };
    const existing = map.getSource(SRC_ID);
    if (existing && 'setData' in existing) {
      (existing as GeoJSONSource).setData(geojson);
    } else {
      map.addSource(SRC_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 4,
          'circle-color': [
            'case',
            ['<', ['get', 'LpA'], 0],
            '#94a3b8',
            ['<', ['get', 'LpA'], 45],
            '#16a34a',
            ['<', ['get', 'LpA'], 55],
            '#eab308',
            '#dc2626',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0f172a',
        },
      });
    }
  }, [map, receivers, results]);

  return null;
}
