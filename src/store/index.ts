import { create } from 'zustand';
import type {
  Building,
  CalculationResults,
  LatLng,
  NormSelection,
  Receiver,
  Source,
  Barrier,
} from '../types';

interface StoreState {
  sources: Source[];
  buildings: Building[];
  receivers: Receiver[];
  barriers: Barrier[];
  norm: NormSelection;
  groundFactor: number;
  mapCenter: LatLng;
  mapZoom: number;
  results: CalculationResults | null;
  isCalculating: boolean;

  addSource: (source: Source) => void;
  updateSource: (id: string, patch: Partial<Source>) => void;
  removeSource: (id: string) => void;

  addBuilding: (building: Building) => void;
  updateBuilding: (id: string, patch: Partial<Building>) => void;
  removeBuilding: (id: string) => void;
  setBuildings: (buildings: Building[]) => void;

  addReceiver: (receiver: Receiver) => void;
  updateReceiver: (id: string, patch: Partial<Receiver>) => void;
  removeReceiver: (id: string) => void;
  setReceivers: (receivers: Receiver[]) => void;
  clearAutoReceivers: () => void;

  addBarrier: (barrier: Barrier) => void;
  removeBarrier: (id: string) => void;

  setNorm: (norm: NormSelection) => void;
  setGroundFactor: (g: number) => void;
  setMapCenter: (center: LatLng) => void;
  setMapZoom: (zoom: number) => void;

  setResults: (r: CalculationResults | null) => void;
  setCalculating: (v: boolean) => void;

  loadSnapshot: (snapshot: {
    sources: Source[];
    buildings: Building[];
    receivers: Receiver[];
    barriers: Barrier[];
    norm: NormSelection;
    groundFactor: number;
    mapCenter: LatLng;
    mapZoom: number;
  }) => void;
}

const DEFAULT_CENTER: LatLng = { lat: 50.4501, lng: 30.5234 }; // Kyiv

export const useStore = create<StoreState>((set) => ({
  sources: [],
  buildings: [],
  receivers: [],
  barriers: [],
  norm: { country: 'PL', areaType: 'residential', timeOfDay: 'night' },
  groundFactor: 0.5,
  mapCenter: DEFAULT_CENTER,
  mapZoom: 17,
  results: null,
  isCalculating: false,

  addSource: (s) => set((st) => ({ sources: [...st.sources, s] })),
  updateSource: (id, patch) =>
    set((st) => ({
      sources: st.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  removeSource: (id) =>
    set((st) => ({ sources: st.sources.filter((s) => s.id !== id) })),

  addBuilding: (b) => set((st) => ({ buildings: [...st.buildings, b] })),
  updateBuilding: (id, patch) =>
    set((st) => ({
      buildings: st.buildings.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    })),
  removeBuilding: (id) =>
    set((st) => ({ buildings: st.buildings.filter((b) => b.id !== id) })),
  setBuildings: (buildings) => set(() => ({ buildings })),

  addReceiver: (r) => set((st) => ({ receivers: [...st.receivers, r] })),
  updateReceiver: (id, patch) =>
    set((st) => ({
      receivers: st.receivers.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    })),
  removeReceiver: (id) =>
    set((st) => ({ receivers: st.receivers.filter((r) => r.id !== id) })),
  setReceivers: (receivers) => set(() => ({ receivers })),
  clearAutoReceivers: () =>
    set((st) => ({ receivers: st.receivers.filter((r) => !r.auto) })),

  addBarrier: (b) => set((st) => ({ barriers: [...st.barriers, b] })),
  removeBarrier: (id) =>
    set((st) => ({ barriers: st.barriers.filter((b) => b.id !== id) })),

  setNorm: (norm) => set(() => ({ norm })),
  setGroundFactor: (groundFactor) => set(() => ({ groundFactor })),
  setMapCenter: (mapCenter) => set(() => ({ mapCenter })),
  setMapZoom: (mapZoom) => set(() => ({ mapZoom })),

  setResults: (results) => set(() => ({ results })),
  setCalculating: (isCalculating) => set(() => ({ isCalculating })),

  loadSnapshot: (snapshot) => set(() => ({ ...snapshot, results: null })),
}));
