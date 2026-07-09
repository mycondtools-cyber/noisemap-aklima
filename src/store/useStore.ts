// Zustand store: scenario state + language + calculation status. Actions
// mutate immutably (spread arrays) so React re-renders reliably.

import { create } from 'zustand';
import equipmentData from '../data/equipment.json';
import type {
  Barrier,
  Building,
  CountryNorm,
  EquipmentModel,
  Language,
  Norms,
  Project,
  Receiver,
  Source,
  GridPoint,
} from '../engine/types';

const DEFAULT_CENTER: [number, number] = [52.2297, 21.0122]; // Warsaw

const NORMS_TABLE: Record<CountryNorm, Norms> = {
  PL: { country: 'PL', dayLimit: 50, nightLimit: 40 },
  UA: { country: 'UA', dayLimit: 55, nightLimit: 45 },
};

const DEFAULT_PROJECT: Project = {
  id: 'default',
  name: 'New project',
  center: DEFAULT_CENTER,
  norms: NORMS_TABLE.PL,
  sources: [],
  buildings: [],
  barriers: [],
  receivers: [],
};

interface AppState {
  project: Project;
  equipment: EquipmentModel[];
  isCalculating: boolean;
  language: Language;
  grid: GridPoint[];
  addSource: (s: Source) => void;
  removeSource: (id: string) => void;
  updateSource: (id: string, update: Partial<Source>) => void;
  addBuilding: (b: Building) => void;
  setBuildings: (b: Building[]) => void;
  toggleProtected: (id: string) => void;
  removeBuilding: (id: string) => void;
  addBarrier: (b: Barrier) => void;
  removeBarrier: (id: string) => void;
  addReceiver: (r: Receiver) => void;
  setReceivers: (r: Receiver[]) => void;
  updateReceiverResults: (r: Receiver[]) => void;
  setNorms: (country: CountryNorm) => void;
  setLanguage: (lang: Language) => void;
  setCalculating: (busy: boolean) => void;
  setGrid: (grid: GridPoint[]) => void;
  setCenter: (center: [number, number]) => void;
  setProjectName: (name: string) => void;
}

export const useStore = create<AppState>((set) => ({
  project: DEFAULT_PROJECT,
  equipment: equipmentData as EquipmentModel[],
  isCalculating: false,
  language: 'uk',
  grid: [],
  addSource: (s) =>
    set((state) => ({
      project: { ...state.project, sources: [...state.project.sources, s] },
    })),
  removeSource: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        sources: state.project.sources.filter((s) => s.id !== id),
      },
    })),
  updateSource: (id, update) =>
    set((state) => ({
      project: {
        ...state.project,
        sources: state.project.sources.map((s) =>
          s.id === id ? { ...s, ...update } : s,
        ),
      },
    })),
  addBuilding: (b) =>
    set((state) => ({
      project: { ...state.project, buildings: [...state.project.buildings, b] },
    })),
  setBuildings: (b) =>
    set((state) => {
      // Preserve "protected" flag for buildings we already know.
      const prior = new Map(state.project.buildings.map((x) => [x.id, x]));
      const merged = b.map((next) => {
        const old = prior.get(next.id);
        return old ? { ...next, protected: old.protected } : next;
      });
      // Keep manual buildings that aren't in the fresh OSM set.
      const manual = state.project.buildings.filter(
        (x) => x.source === 'manual' && !merged.find((m) => m.id === x.id),
      );
      return {
        project: { ...state.project, buildings: [...merged, ...manual] },
      };
    }),
  toggleProtected: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        buildings: state.project.buildings.map((b) =>
          b.id === id ? { ...b, protected: !b.protected } : b,
        ),
      },
    })),
  removeBuilding: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        buildings: state.project.buildings.filter((b) => b.id !== id),
      },
    })),
  addBarrier: (b) =>
    set((state) => ({
      project: { ...state.project, barriers: [...state.project.barriers, b] },
    })),
  removeBarrier: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        barriers: state.project.barriers.filter((b) => b.id !== id),
      },
    })),
  addReceiver: (r) =>
    set((state) => ({
      project: {
        ...state.project,
        receivers: [...state.project.receivers, r],
      },
    })),
  setReceivers: (r) =>
    set((state) => ({ project: { ...state.project, receivers: r } })),
  updateReceiverResults: (r) =>
    set((state) => ({ project: { ...state.project, receivers: r } })),
  setNorms: (country) =>
    set((state) => ({
      project: { ...state.project, norms: NORMS_TABLE[country] },
    })),
  setLanguage: (lang) => set(() => ({ language: lang })),
  setCalculating: (busy) => set(() => ({ isCalculating: busy })),
  setGrid: (grid) => set(() => ({ grid })),
  setCenter: (center) =>
    set((state) => ({ project: { ...state.project, center } })),
  setProjectName: (name) =>
    set((state) => ({ project: { ...state.project, name } })),
}));
