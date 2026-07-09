// Ground-plane noise grid generator (used by isolines).

import { calcLpA } from './iso9613';
import type {
  BBox,
  Building,
  Barrier,
  EquipmentModel,
  GridPoint,
  Receiver,
  Source,
} from './types';

/**
 * Sample the map inside `bbox` on a regular latitude/longitude grid whose cell
 * size is roughly `stepMeters`. Returns the total LpA at each cell centre at
 * height 1.5 m.
 *
 * Grid resolution is deliberately coarse: acoustic isolines are dominated by
 * geometric divergence which is smooth, and rendering costs blow up quickly
 * beyond ~30×30 cells over a city block.
 */
export function generateGrid(
  bbox: BBox,
  stepMeters: number,
  sources: readonly Source[],
  buildings: readonly Building[],
  barriers: readonly Barrier[],
  equipment: readonly EquipmentModel[],
  gridHeight = 1.5,
  mode: 'day' | 'night' = 'day',
): GridPoint[] {
  const meanLat = 0.5 * (bbox.minLat + bbox.maxLat);
  const dLat = stepMeters / 111_320; // metres → degrees latitude
  const dLng = stepMeters / (111_320 * Math.cos((meanLat * Math.PI) / 180));

  const rows = Math.max(2, Math.ceil((bbox.maxLat - bbox.minLat) / dLat));
  const cols = Math.max(2, Math.ceil((bbox.maxLng - bbox.minLng) / dLng));
  const points: GridPoint[] = [];

  for (let r = 0; r <= rows; r++) {
    const lat = bbox.minLat + (r / rows) * (bbox.maxLat - bbox.minLat);
    for (let c = 0; c <= cols; c++) {
      const lng = bbox.minLng + (c / cols) * (bbox.maxLng - bbox.minLng);
      const receiver: Receiver = { id: `grid-${r}-${c}`, lat, lng, h: gridHeight };
      let sumEnergy = 0;
      for (const source of sources) {
        try {
          const { LpA } = calcLpA(source, receiver, buildings, barriers, equipment, 0.5, mode);
          if (Number.isFinite(LpA)) sumEnergy += Math.pow(10, LpA / 10);
        } catch {
          // Unknown equipment — skip.
        }
      }
      const LpA = sumEnergy > 0 ? 10 * Math.log10(sumEnergy) : 0;
      points.push({ lat, lng, LpA });
    }
  }
  return points;
}
