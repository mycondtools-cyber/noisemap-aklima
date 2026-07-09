import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useMap } from './MapContext';
import { useStore } from '../../store';

const SRC_ID = 'isolines-src';
const LAYER_ID = 'isolines-layer';

const EMPTY: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

export default function IsolineLayer() {
  const map = useMap();
  const results = useStore((s) => s.results);

  useEffect(() => {
    if (!map) return;
    const data = results?.grid?.isolines ?? EMPTY;
    const existing = map.getSource(SRC_ID);
    if (existing && 'setData' in existing) {
      (existing as GeoJSONSource).setData(data as GeoJSON.FeatureCollection);
    } else {
      map.addSource(SRC_ID, { type: 'geojson', data });
      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SRC_ID,
        paint: {
          'line-color': [
            'match',
            ['get', 'LpA'],
            35, '#22c55e',
            40, '#84cc16',
            45, '#eab308',
            50, '#f97316',
            55, '#ef4444',
            60, '#b91c1c',
            /* other */ '#6b7280',
          ],
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });
    }
  }, [map, results]);

  return null;
}
