// Domain types shared across the app.
// Re-exports engine-side types plus a few app-only shapes.

export * from '../engine/types';
import type { Source, Building, Barrier, Receiver, Norms } from '../engine/types';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface NormSelection {
  country: 'PL' | 'UA';
  areaType: 'residential' | 'estate';
  timeOfDay: 'day' | 'night';
}

export interface ReceiverResult {
  receiverId: string;
  dBAday: number;
  dBAnight: number;
  distance: number;
  buildingId?: string;
  normLimit: number;
  margin: number;
  status: 'ok' | 'warn' | 'over';
}

export interface GridResult {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  stepMeters: number;
  points: { lat: number; lng: number; LpA: number }[];
  isolines?: GeoJSON.FeatureCollection<GeoJSON.MultiLineString>;
}

export interface CalculationResults {
  receivers: ReceiverResult[];
  grid?: GridResult;
  worstReceiverId?: string;
  computedAt: number;
}

export interface ProjectSnapshot {
  version: 1;
  name: string;
  center: LatLng;
  zoom: number;
  norm: NormSelection;
  norms: Norms;
  groundFactor: number;
  sources: Source[];
  buildings: Building[];
  receivers: Receiver[];
  barriers: Barrier[];
  createdAt: string;
}
