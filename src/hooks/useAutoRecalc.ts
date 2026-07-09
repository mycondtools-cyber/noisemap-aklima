import { useEffect, useRef } from 'react';
import equipment from '../data/equipment.json';
import { generateReceivers } from '../engine/receivers';
import { useStore } from '../store';
import { currentLimit } from '../components/Sidebar/NormSelector';
import type {
  BBox,
  Barrier,
  Building,
  EquipmentModel,
  NormSelection,
  Receiver,
  Source,
} from '../types';
import type { WorkerJob, WorkerResult } from '../engine/worker';

const EQUIPMENT = equipment as EquipmentModel[];

function computeBBox(
  buildings: Building[],
  sources: Source[],
  center: { lat: number; lng: number },
): BBox {
  const lats: number[] = [center.lat];
  const lngs: number[] = [center.lng];
  for (const b of buildings) {
    for (const [lat, lng] of b.polygon) {
      lats.push(lat);
      lngs.push(lng);
    }
  }
  for (const s of sources) {
    lats.push(s.lat);
    lngs.push(s.lng);
  }
  const pad = 0.002; // ~ 200 m
  return {
    minLat: Math.min(...lats) - pad,
    maxLat: Math.max(...lats) + pad,
    minLng: Math.min(...lngs) - pad,
    maxLng: Math.max(...lngs) + pad,
  };
}

function statusFor(dBA: number, limit: number): 'ok' | 'warn' | 'over' {
  if (dBA > limit) return 'over';
  if (dBA > limit - 5) return 'warn';
  return 'ok';
}

function nearestSourceDistance(
  receiver: Receiver,
  sources: readonly Source[],
): number {
  if (sources.length === 0) return 0;
  let best = Infinity;
  for (const s of sources) {
    const dLat = ((receiver.lat - s.lat) * Math.PI) / 180;
    const dLng = ((receiver.lng - s.lng) * Math.PI) / 180;
    const meanLat = ((receiver.lat + s.lat) / 2) * (Math.PI / 180);
    const R = 6378137;
    const x = dLng * Math.cos(meanLat) * R;
    const y = dLat * R;
    const dz = receiver.h - s.hs;
    const d = Math.sqrt(x * x + y * y + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

export function useAutoRecalc() {
  const sources = useStore((s) => s.sources);
  const buildings = useStore((s) => s.buildings);
  const barriers = useStore((s) => s.barriers);
  const receivers = useStore((s) => s.receivers);
  const norm = useStore((s) => s.norm);
  const G = useStore((s) => s.groundFactor);
  const mapCenter = useStore((s) => s.mapCenter);
  const setResults = useStore((s) => s.setResults);
  const setCalculating = useStore((s) => s.setCalculating);
  const setReceivers = useStore((s) => s.setReceivers);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const jobIdRef = useRef<number>(0);

  // Auto-generate façade receivers when buildings change and no auto-receivers exist.
  useEffect(() => {
    const anyAuto = receivers.some((r) => r.auto);
    if (!anyAuto && buildings.some((b) => b.protected)) {
      const generated = generateReceivers(buildings);
      const manual = receivers.filter((r) => !r.auto);
      setReceivers([...manual, ...generated]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (sources.length === 0 || receivers.length === 0) {
      setResults(null);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setCalculating(true);
      const jobId = ++jobIdRef.current;
      try {
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL('../engine/worker.ts', import.meta.url),
            { type: 'module' },
          );
        }
        const bbox = computeBBox(buildings, sources, mapCenter);
        const job: WorkerJob = {
          jobId,
          sources,
          receivers,
          buildings,
          barriers,
          equipment: EQUIPMENT,
          groundFactor: G,
          mode: norm.timeOfDay,
          grid: {
            bbox,
            stepMeters: 6,
            height: 1.5,
            isolineLevels: [35, 40, 45, 50, 55, 60],
          },
        };
        const result = await new Promise<WorkerResult>((resolve) => {
          workerRef.current!.onmessage = (ev: MessageEvent<WorkerResult>) =>
            resolve(ev.data);
          workerRef.current!.postMessage(job);
        });
        if (jobId !== jobIdRef.current) return; // stale

        // Also compute per-receiver day+night by running a second job in-worker
        // isn't necessary here — we approximate by running receiver-only for
        // whichever mode is not selected.
        const otherMode: NormSelection['timeOfDay'] =
          norm.timeOfDay === 'day' ? 'night' : 'day';
        const otherJob: WorkerJob = { ...job, jobId: jobId + 1_000_000, grid: undefined, mode: otherMode };
        const otherResult = await new Promise<WorkerResult>((resolve) => {
          workerRef.current!.onmessage = (ev: MessageEvent<WorkerResult>) =>
            resolve(ev.data);
          workerRef.current!.postMessage(otherJob);
        });
        if (jobId !== jobIdRef.current) return;

        const dayMap = new Map<string, number>();
        const nightMap = new Map<string, number>();
        for (const r of result.receivers) {
          if (norm.timeOfDay === 'day') dayMap.set(r.receiverId, r.LpA);
          else nightMap.set(r.receiverId, r.LpA);
        }
        for (const r of otherResult.receivers) {
          if (otherMode === 'day') dayMap.set(r.receiverId, r.LpA);
          else nightMap.set(r.receiverId, r.LpA);
        }

        const limit = currentLimit(norm);
        const rows = receivers.map((rc) => {
          const day = dayMap.get(rc.id) ?? 0;
          const night = nightMap.get(rc.id) ?? 0;
          const worse = Math.max(day, night);
          return {
            receiverId: rc.id,
            dBAday: day,
            dBAnight: night,
            distance: nearestSourceDistance(rc, sources),
            buildingId: rc.buildingId,
            normLimit: limit,
            margin: limit - worse,
            status: statusFor(worse, limit),
          };
        });
        let worstReceiverId: string | undefined;
        let worstLevel = -Infinity;
        for (const r of rows) {
          const worse = Math.max(r.dBAday, r.dBAnight);
          if (worse > worstLevel) {
            worstLevel = worse;
            worstReceiverId = r.receiverId;
          }
        }

        setResults({
          receivers: rows,
          grid: result.grid && {
            minLat: 0,
            minLng: 0,
            maxLat: 0,
            maxLng: 0,
            stepMeters: 6,
            points: result.grid.points,
            isolines: result.grid.isolines,
          },
          worstReceiverId,
          computedAt: Date.now(),
        });
      } finally {
        setCalculating(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sources, buildings, barriers, receivers, norm, G, mapCenter, setResults, setCalculating]);
}
