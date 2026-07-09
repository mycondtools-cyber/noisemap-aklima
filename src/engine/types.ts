// Domain types shared between the engine, worker, and UI layers.
// Coordinates are lat/lng (WGS-84) at the UI/data layer; the engine converts to
// a local metric plane before running the ISO 9613-2 formulas.

export const OCTAVE_HZ = [63, 125, 250, 500, 1000, 2000, 4000, 8000] as const;
export type OctaveHz = (typeof OCTAVE_HZ)[number];

export interface OctaveBands {
  bands: number[];
}

export type MountingType = 'free' | 'wall' | 'corner';
export type OperatingMode = 'day' | 'night' | 'both';
export type CountryNorm = 'PL' | 'UA';
export type Language = 'uk' | 'pl' | 'en';

export type EquipmentCategory =
  | 'heat-pump'
  | 'vrf'
  | 'split'
  | 'chiller'
  | 'other';

export interface EquipmentModel {
  id: string;
  brand: string;
  model: string;
  category?: EquipmentCategory;
  lwA: number; // total A-weighted sound power (dBA)
  octaveLw: number[]; // 8 octave-band Lw at 63..8000 Hz (dB)
  nightLwA?: number; // optional quiet-mode Lw(A)
  notes?: string;
}

export interface Source {
  id: string;
  lat: number;
  lng: number;
  hs: number; // mounting height above ground (m)
  mounting: MountingType;
  count: number; // identical units, energy summed
  modelId: string;
  mode: OperatingMode;
  /** Optional night-time Lw offset in dB (e.g. -3 for quiet mode). */
  nightOffsetDb?: number;
}

export interface Building {
  id: string;
  polygon: [number, number][]; // [lat, lng] pairs, ring closed implicitly
  height: number; // m
  protected: boolean;
  source: 'osm' | 'manual';
  osmId?: number;
}

export interface Barrier {
  id: string;
  line: [number, number][]; // polyline of [lat, lng]
  height: number; // m
}

export interface ReceiverResults {
  LpA_day: number;
  LpA_night: number;
  perBand: number[]; // 8 octave-band Lp values, A-weighted (dB)
  worstSourceId?: string;
}

export interface Receiver {
  id: string;
  lat: number;
  lng: number;
  h: number; // height above ground (m)
  buildingId?: string;
  auto?: boolean;
  results?: ReceiverResults;
}

export interface Norms {
  dayLimit: number;
  nightLimit: number;
  country: CountryNorm;
}

export interface Project {
  id: string;
  name: string;
  center: [number, number]; // lat, lng
  norms: Norms;
  sources: Source[];
  buildings: Building[];
  barriers: Barrier[];
  receivers: Receiver[];
}

export interface GridPoint {
  lat: number;
  lng: number;
  LpA: number;
}

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}
