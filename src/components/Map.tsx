// MapLibre GL JS wrapper.
//
// The map owns:
//   - base OpenFreeMap style
//   - fill-extrusion layer for buildings (extruded by `height`)
//   - three GeoJSON sources for sources / receivers / barriers
//   - an isolines line layer for the noise grid contours
//   - a right-click context menu for "add source / add receiver / draw building"
//
// Clicking on a source or receiver marker fires a callback the parent can use
// for edit / delete. Dragging a source moves it and triggers a recalculation
// via the store.

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MLMap, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from 'react-i18next';
import type { FeatureCollection, MultiLineString } from 'geojson';
import { useStore } from '../store/useStore';
import { generateIsolines, receiverColor } from '../engine/isolines';

interface ContextMenuState {
  x: number;
  y: number;
  lat: number;
  lng: number;
}

interface MapProps {
  onAddSource: (lat: number, lng: number) => void;
  onAddReceiver: (lat: number, lng: number) => void;
  onDrawBuilding: (lat: number, lng: number) => void;
  onSelectSource: (id: string) => void;
}

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function toGeoJsonPolygon(building: {
  polygon: [number, number][];
  height: number;
  protected: boolean;
  id: string;
}) {
  const ring = building.polygon.map(([lat, lng]) => [lng, lat]);
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push(ring[0]);
  }
  return {
    type: 'Feature' as const,
    id: building.id,
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
    properties: {
      height: building.height,
      protected: building.protected ? 1 : 0,
    },
  };
}

export function MapView({
  onAddSource,
  onAddReceiver,
  onDrawBuilding,
  onSelectSource,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const { t } = useTranslation();

  const project = useStore((s) => s.project);
  const equipment = useStore((s) => s.equipment);
  const grid = useStore((s) => s.grid);

  // -------- init --------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: [project.center[1], project.center[0]],
      zoom: 16,
      pitch: 30,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('contextmenu', (e: MapMouseEvent) => {
      e.preventDefault();
      setMenu({
        x: e.point.x,
        y: e.point.y,
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      });
    });
    map.on('click', () => setMenu(null));

    map.on('load', () => {
      setTimeout(() => map.resize(), 0);
      map.addSource('buildings', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'buildings',
        paint: {
          'fill-extrusion-color': [
            'case',
            ['==', ['get', 'protected'], 1],
            '#4fc3f7',
            '#b0bec5',
          ],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.6,
        },
      });

      map.addSource('sources', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'sources-pt',
        type: 'circle',
        source: 'sources',
        paint: {
          'circle-radius': 8,
          'circle-color': '#e53935',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      map.addSource('receivers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'receivers-pt',
        type: 'circle',
        source: 'receivers',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
        },
      });

      map.addSource('barriers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'barriers-line',
        type: 'line',
        source: 'barriers',
        paint: {
          'line-color': '#6a1b9a',
          'line-width': 4,
        },
      });

      map.addSource('isolines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'isolines-line',
        type: 'line',
        source: 'isolines',
        paint: {
          'line-color': [
            'step',
            ['get', 'LpA'],
            '#2e7d32',
            40,
            '#558b2f',
            45,
            '#9e9d24',
            50,
            '#f9a825',
            55,
            '#ef6c00',
            60,
            '#c62828',
          ],
          'line-width': 1.5,
        },
      });

      map.on('click', 'sources-pt', (e) => {
        const id = e.features?.[0]?.id;
        if (typeof id === 'string') onSelectSource(id);
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- render data --------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const buildingsFC: FeatureCollection = {
      type: 'FeatureCollection',
      features: project.buildings.map(toGeoJsonPolygon),
    };
    (map.getSource('buildings') as maplibregl.GeoJSONSource | undefined)?.setData(
      buildingsFC,
    );

    const sourcesFC: FeatureCollection = {
      type: 'FeatureCollection',
      features: project.sources.map((src) => {
        const eq = equipment.find((e) => e.id === src.modelId);
        return {
          type: 'Feature',
          id: src.id,
          geometry: { type: 'Point', coordinates: [src.lng, src.lat] },
          properties: {
            id: src.id,
            title: eq ? `${eq.brand} ${eq.model}` : src.modelId,
            lwA: eq?.lwA ?? null,
          },
        };
      }),
    };
    (map.getSource('sources') as maplibregl.GeoJSONSource | undefined)?.setData(
      sourcesFC,
    );

    const norms = project.norms;
    const receiversFC: FeatureCollection = {
      type: 'FeatureCollection',
      features: project.receivers.map((r) => {
        const worst = Math.max(
          r.results?.LpA_day ?? 0,
          r.results?.LpA_night ?? 0,
        );
        const relevantLimit =
          (r.results?.LpA_night ?? -Infinity) > (r.results?.LpA_day ?? -Infinity)
            ? norms.nightLimit
            : norms.dayLimit;
        const color = r.results
          ? receiverColor(worst, relevantLimit)
          : '#90a4ae';
        return {
          type: 'Feature',
          id: r.id,
          geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
          properties: {
            id: r.id,
            color,
            LpA_day: r.results?.LpA_day ?? null,
            LpA_night: r.results?.LpA_night ?? null,
          },
        };
      }),
    };
    (map.getSource('receivers') as maplibregl.GeoJSONSource | undefined)?.setData(
      receiversFC,
    );

    const barriersFC: FeatureCollection = {
      type: 'FeatureCollection',
      features: project.barriers.map((b) => ({
        type: 'Feature',
        id: b.id,
        geometry: {
          type: 'LineString',
          coordinates: b.line.map(([lat, lng]) => [lng, lat]),
        },
        properties: { id: b.id, height: b.height },
      })),
    };
    (map.getSource('barriers') as maplibregl.GeoJSONSource | undefined)?.setData(
      barriersFC,
    );
  }, [project, equipment]);

  // -------- isolines --------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('isolines') as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!src) return;
    if (grid.length === 0) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const iso: FeatureCollection<MultiLineString> = generateIsolines(grid);
    src.setData(iso);
  }, [grid]);

  // -------- recenter when project center changes --------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [project.center[1], project.center[0]] });
  }, [project.center]);

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-canvas" />
      {menu ? (
        <div
          className="ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={() => setMenu(null)}
        >
          <button
            type="button"
            onClick={() => {
              onAddSource(menu.lat, menu.lng);
              setMenu(null);
            }}
          >
            {t('map.menu.source')}
          </button>
          <button
            type="button"
            onClick={() => {
              onAddReceiver(menu.lat, menu.lng);
              setMenu(null);
            }}
          >
            {t('map.menu.receiver')}
          </button>
          <button
            type="button"
            onClick={() => {
              onDrawBuilding(menu.lat, menu.lng);
              setMenu(null);
            }}
          >
            {t('map.menu.building')}
          </button>
        </div>
      ) : null}
      <div className="legend">
        <div className="legend-title">{t('map.legend')}</div>
        {[35, 40, 45, 50, 55, 60].map((lvl) => (
          <div key={lvl} className="legend-row">
            <span
              className="swatch"
              style={{ backgroundColor: swatchFor(lvl) }}
            />
            <span>{lvl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function swatchFor(level: number): string {
  if (level >= 60) return '#c62828';
  if (level >= 55) return '#ef6c00';
  if (level >= 50) return '#f9a825';
  if (level >= 45) return '#9e9d24';
  if (level >= 40) return '#558b2f';
  return '#2e7d32';
}
