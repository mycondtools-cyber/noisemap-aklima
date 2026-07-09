import { useEffect } from 'react';
import { useMap } from './MapContext';
import { useStore } from '../../store';

const SRC_ID = 'sources-src';
const LAYER_ID = 'sources-layer';

export default function SourceLayer() {
  const map = useMap();
  const sources = useStore((s) => s.sources);

  useEffect(() => {
    if (!map) return;
    const features = sources.map((s) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: { id: s.id, mounting: s.mounting },
    }));
    const geojson = { type: 'FeatureCollection' as const, features };

    const existing = map.getSource(SRC_ID);
    if (existing && 'setData' in existing) {
      (existing as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource(SRC_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SRC_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#dc2626',
          'circle-stroke-color': '#7f1d1d',
          'circle-stroke-width': 2,
        },
      });
    }
    return () => {
      // no cleanup; source persists across renders and is updated in place.
    };
  }, [map, sources]);

  return null;
}
