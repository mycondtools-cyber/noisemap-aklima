import { useEffect, useRef, useState, PropsWithChildren } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import { useStore } from '../../store';
import { MapContext } from './MapContext';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
}

export default function MapView({
  onMapClick,
  children,
}: PropsWithChildren<Props>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const mapCenter = useStore((s) => s.mapCenter);
  const mapZoom = useStore((s) => s.mapZoom);
  const setMapCenter = useStore((s) => s.setMapCenter);
  const setMapZoom = useStore((s) => s.setMapZoom);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [mapCenter.lng, mapCenter.lat],
      zoom: mapZoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({}), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }));
    map.on('load', () => setReady(true));
    map.on('moveend', () => {
      const c = map.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
      setMapZoom(map.getZoom());
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !onMapClick) return;
    const map = mapRef.current;
    const handler = (e: maplibregl.MapMouseEvent) => onMapClick(e.lngLat);
    map.on('click', handler);
    return () => {
      map.off('click', handler);
    };
  }, [onMapClick]);

  return (
    <div className="map">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {ready && mapRef.current && (
        <MapContext.Provider value={mapRef.current}>
          {children}
        </MapContext.Provider>
      )}
    </div>
  );
}
