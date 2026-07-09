// Auto-generate façade receivers around every "protected" building.
//
// The ISO 9613-2 assessment lives at the residential façade. For each protected
// building we walk the perimeter, place a candidate every `step` metres one
// metre outward from the wall, and offer two heights: 1.5 m (ground floor) and
// 4.5 m (first floor). Corner-facing points fall out of the ring naturally.

import type { Building, Receiver } from './types';
import { toLocalXY } from './geometry';

interface PointXY {
  x: number;
  y: number;
}

function segmentLength(a: PointXY, b: PointXY): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function outwardNormal(a: PointXY, b: PointXY, centroid: PointXY): PointXY {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mid = { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y) };
  const toC = { x: centroid.x - mid.x, y: centroid.y - mid.y };
  const dot = nx * toC.x + ny * toC.y;
  return dot > 0 ? { x: -nx, y: -ny } : { x: nx, y: ny };
}

function centroidOf(points: readonly PointXY[]): PointXY {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x: cx, y: cy };
}

/**
 * Generate façade receivers for every protected building.
 * `step` metres between consecutive receivers, `offset` metres away from the
 * wall, heights [1.5 m, 4.5 m].
 */
export function generateReceivers(
  buildings: readonly Building[],
  step = 4,
  offset = 1,
): Receiver[] {
  const receivers: Receiver[] = [];
  const heights = [1.5, 4.5];

  for (const b of buildings) {
    if (!b.protected) continue;
    if (b.polygon.length < 3) continue;

    // Project to a local metric plane centred on the first vertex.
    const origin = { lat: b.polygon[0][0], lng: b.polygon[0][1] };
    const xy = b.polygon.map(([lat, lng]) => toLocalXY(lat, lng, origin));
    const centroid = centroidOf(xy);

    for (let i = 0; i < xy.length; i++) {
      const a = xy[i];
      const bx = xy[(i + 1) % xy.length];
      const length = segmentLength(a, bx);
      if (length < 0.5) continue;
      const count = Math.max(1, Math.floor(length / step));
      const normal = outwardNormal(a, bx, centroid);
      for (let k = 0; k <= count; k++) {
        const t = count === 0 ? 0.5 : k / count;
        const px = a.x + t * (bx.x - a.x) + normal.x * offset;
        const py = a.y + t * (bx.y - a.y) + normal.y * offset;
        // Convert back to lat/lng.
        const dLat = py / 111_320;
        const dLng =
          px / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
        const lat = origin.lat + dLat;
        const lng = origin.lng + dLng;
        for (const h of heights) {
          receivers.push({
            id: `${b.id}-${i}-${k}-${Math.round(h * 10)}`,
            lat,
            lng,
            h,
            buildingId: b.id,
            auto: true,
          });
        }
      }
    }
  }
  return receivers;
}
