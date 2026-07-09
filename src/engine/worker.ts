/// <reference lib="webworker" />
// Web Worker wrapper for the ISO 9613-2 engine.
//
// The main thread posts a job description with sources, receivers, buildings,
// barriers and environment; the worker replies with per-receiver results and
// (optionally) a noise grid used to draw isolines.

import { calcLpA } from './iso9613';
import { generateGrid } from './noisegrid';
import { generateIsolines } from './isolines';
import type {
  BBox,
  Barrier,
  Building,
  EquipmentModel,
  GridPoint,
  Receiver,
  Source,
} from './types';

export interface WorkerJob {
  jobId: number;
  sources: Source[];
  receivers: Receiver[];
  buildings: Building[];
  barriers: Barrier[];
  equipment: EquipmentModel[];
  groundFactor: number;
  mode: 'day' | 'night';
  grid?: {
    bbox: BBox;
    stepMeters: number;
    height: number;
    isolineLevels?: number[];
  };
}

export interface WorkerReceiverResult {
  receiverId: string;
  LpA: number;
  perBand: number[];
  contributions: { sourceId: string; LpA: number }[];
}

export interface WorkerResult {
  jobId: number;
  receivers: WorkerReceiverResult[];
  grid?: {
    points: GridPoint[];
    isolines: GeoJSON.FeatureCollection<GeoJSON.MultiLineString>;
  };
  timeMs: number;
}

function runReceivers(job: WorkerJob): WorkerReceiverResult[] {
  return job.receivers.map((r) => {
    const contributions: { sourceId: string; LpA: number }[] = [];
    const perBandEnergy = new Array<number>(8).fill(0);
    for (const s of job.sources) {
      try {
        const { LpA, perBand } = calcLpA(
          s,
          r,
          job.buildings,
          job.barriers,
          job.equipment,
          job.groundFactor,
          job.mode,
        );
        contributions.push({ sourceId: s.id, LpA });
        for (let i = 0; i < 8; i++) {
          perBandEnergy[i] += Math.pow(10, perBand[i] / 10);
        }
      } catch {
        // Unknown equipment model — skip.
      }
    }
    const totalEnergy = contributions.reduce(
      (acc, c) => acc + Math.pow(10, c.LpA / 10),
      0,
    );
    const LpA = totalEnergy > 0 ? 10 * Math.log10(totalEnergy) : 0;
    const perBand = perBandEnergy.map((e) =>
      e > 0 ? 10 * Math.log10(e) : 0,
    );
    return { receiverId: r.id, LpA, perBand, contributions };
  });
}

export function runJob(job: WorkerJob): WorkerResult {
  const t0 = performance.now();
  const receivers = runReceivers(job);
  let grid: WorkerResult['grid'];
  if (job.grid) {
    const points = generateGrid(
      job.grid.bbox,
      job.grid.stepMeters,
      job.sources,
      job.buildings,
      job.barriers,
      job.equipment,
      job.grid.height,
      job.mode,
    );
    const isolines = generateIsolines(
      points,
      job.grid.isolineLevels ?? [35, 40, 45, 50, 55, 60],
    );
    grid = { points, isolines };
  }
  return { jobId: job.jobId, receivers, grid, timeMs: performance.now() - t0 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = typeof self !== 'undefined' ? (self as any) : undefined;
if (workerSelf && typeof workerSelf.postMessage === 'function') {
  workerSelf.onmessage = (ev: MessageEvent<WorkerJob>) => {
    const result = runJob(ev.data);
    workerSelf.postMessage(result);
  };
}
