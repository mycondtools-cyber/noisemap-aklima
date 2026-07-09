// Off-main-thread ISO 9613-2 calculation.
//
// Receives a full scenario snapshot from the UI, evaluates LpA at every
// receiver (day + night) and — when requested — samples a coarse grid used to
// draw isolines. Sends the updated receivers back plus the grid points.
//
// The worker is intentionally stateless: every message carries the whole
// scenario so the UI can debounce as aggressively as it wants without worrying
// about racing older jobs.

import { calcLpA } from '../engine/iso9613';
import { generateGrid } from '../engine/noisegrid';
import type {
  BBox,
  Barrier,
  Building,
  EquipmentModel,
  GridPoint,
  Receiver,
  ReceiverResults,
  Source,
} from '../engine/types';

export interface CalculationRequest {
  jobId: number;
  sources: Source[];
  receivers: Receiver[];
  buildings: Building[];
  barriers: Barrier[];
  equipment: EquipmentModel[];
  grid?: {
    bbox: BBox;
    stepMeters: number;
  };
}

export interface CalculationResponse {
  jobId: number;
  receivers: Receiver[];
  grid?: GridPoint[];
}

function combineOctaveEnergy(bands: number[][], mode: 'day' | 'night'): number[] {
  if (bands.length === 0) return Array(8).fill(-Infinity);
  const out = Array<number>(8).fill(0);
  for (const perBand of bands) {
    for (let i = 0; i < 8; i++) {
      const v = perBand[i];
      if (Number.isFinite(v)) out[i] += Math.pow(10, v / 10);
    }
  }
  // Silence unused parameter warning — mode is used by callers upstream.
  void mode;
  return out.map((e) => (e > 0 ? 10 * Math.log10(e) : -Infinity));
}

function evaluateReceiver(
  receiver: Receiver,
  sources: readonly Source[],
  buildings: readonly Building[],
  barriers: readonly Barrier[],
  equipment: readonly EquipmentModel[],
): ReceiverResults {
  const dayBands: number[][] = [];
  const nightBands: number[][] = [];
  const dayLevels: number[] = [];
  const nightLevels: number[] = [];
  let worstSourceId: string | undefined;
  let worstLevel = -Infinity;

  for (const source of sources) {
    try {
      const day = calcLpA(source, receiver, buildings, barriers, equipment, 0.5, 'day');
      const night = calcLpA(source, receiver, buildings, barriers, equipment, 0.5, 'night');
      if (source.mode !== 'night') {
        dayBands.push(day.perBand);
        dayLevels.push(day.LpA);
      }
      if (source.mode !== 'day') {
        nightBands.push(night.perBand);
        nightLevels.push(night.LpA);
      }
      const best = Math.max(day.LpA, night.LpA);
      if (best > worstLevel) {
        worstLevel = best;
        worstSourceId = source.id;
      }
    } catch {
      // Unknown equipment or degenerate geometry — skip that pair.
    }
  }

  const LpA_day = energeticSum(dayLevels);
  const LpA_night = energeticSum(nightLevels);
  const perBand = combineOctaveEnergy(dayBands.length ? dayBands : nightBands, 'day');
  return { LpA_day, LpA_night, perBand, worstSourceId };
}

function energeticSum(levels: readonly number[]): number {
  let e = 0;
  for (const v of levels) if (Number.isFinite(v)) e += Math.pow(10, v / 10);
  return e > 0 ? 10 * Math.log10(e) : -Infinity;
}

self.onmessage = (evt: MessageEvent<CalculationRequest>) => {
  const req = evt.data;
  const updatedReceivers: Receiver[] = req.receivers.map((r) => ({
    ...r,
    results: evaluateReceiver(
      r,
      req.sources,
      req.buildings,
      req.barriers,
      req.equipment,
    ),
  }));

  let grid: GridPoint[] | undefined;
  if (req.grid) {
    grid = generateGrid(
      req.grid.bbox,
      req.grid.stepMeters,
      req.sources,
      req.buildings,
      req.barriers,
      req.equipment,
    );
  }

  const response: CalculationResponse = {
    jobId: req.jobId,
    receivers: updatedReceivers,
    grid,
  };
  (self as unknown as Worker).postMessage(response);
};
