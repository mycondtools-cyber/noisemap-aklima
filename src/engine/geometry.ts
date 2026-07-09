// Geometry helpers used by the ISO 9613-2 engine.
// All coordinates in this module are Cartesian (metres). Callers convert from
// lat/lng to a local metric plane before invoking these routines.

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Segment2 {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

// Polygon footprint plus top height (roof z, in metres).
export interface BuildingPrism {
  polygon: { x: number; y: number }[];
  height: number; // metres above ground (z=0)
}

// A barrier is a vertical wall along a polyline with a given top height.
export interface BarrierWall {
  points: { x: number; y: number }[];
  height: number;
}

export function distance3(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distance2(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert lat/lng to a local ENU (east-north) metric plane centred at
 * `origin`. Uses the equirectangular approximation — accurate at the ~300 m
 * radius used by the app.
 */
export function toLocalXY(
  lat: number,
  lng: number,
  origin: { lat: number; lng: number },
): { x: number; y: number } {
  const R = 6378137;
  const latRad = (origin.lat * Math.PI) / 180;
  const x = ((lng - origin.lng) * Math.PI) / 180 * R * Math.cos(latRad);
  const y = ((lat - origin.lat) * Math.PI) / 180 * R;
  return { x, y };
}

// 2D segment intersection returning parametric distance t along AB in [0,1].
function segmentsIntersectT(a: Segment2, b: Segment2): number | null {
  const r = { x: a.b.x - a.a.x, y: a.b.y - a.a.y };
  const s = { x: b.b.x - b.a.x, y: b.b.y - b.a.y };
  const denom = r.x * s.y - r.y * s.x;
  if (denom === 0) return null;
  const qp = { x: b.a.x - a.a.x, y: b.a.y - a.a.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t;
}

/**
 * 3D ray casting: is the straight line from `source` to `receiver` obstructed
 * by any building prism? A building blocks the ray when the ray crosses its
 * footprint at a z lower than the building's roof height.
 * Returns the highest obstruction top and its z at the crossing (if any).
 */
export function firstObstruction(
  source: Point3,
  receiver: Point3,
  buildings: readonly BuildingPrism[],
): { z: number; buildingHeight: number } | null {
  let best: { z: number; buildingHeight: number } | null = null;
  const seg: Segment2 = {
    a: { x: source.x, y: source.y },
    b: { x: receiver.x, y: receiver.y },
  };
  for (const b of buildings) {
    for (let i = 0; i < b.polygon.length; i++) {
      const p1 = b.polygon[i];
      const p2 = b.polygon[(i + 1) % b.polygon.length];
      const edge: Segment2 = { a: p1, b: p2 };
      const t = segmentsIntersectT(seg, edge);
      if (t == null) continue;
      const zAtCrossing = source.z + t * (receiver.z - source.z);
      if (zAtCrossing < b.height) {
        if (!best || b.height > best.buildingHeight) {
          best = { z: zAtCrossing, buildingHeight: b.height };
        }
      }
    }
  }
  return best;
}

export function hasLineOfSight(
  source: Point3,
  receiver: Point3,
  buildings: readonly BuildingPrism[],
): boolean {
  return firstObstruction(source, receiver, buildings) === null;
}

/**
 * ISO 9613-2 §7.4 path-difference δ = (dss + dsr) − d, where dss and dsr are
 * distances from source and receiver to the top of the barrier edge and d is
 * the direct source-receiver distance. Returns the largest δ across all
 * building/barrier tops that the ray-cast identifies.
 * Returns 0 when nothing blocks.
 */
export function pathDifference(
  source: Point3,
  receiver: Point3,
  buildings: readonly BuildingPrism[],
  barriers: readonly BarrierWall[] = [],
): number {
  const seg: Segment2 = {
    a: { x: source.x, y: source.y },
    b: { x: receiver.x, y: receiver.y },
  };
  const direct = distance3(source, receiver);
  let bestDelta = 0;

  const evaluate = (t: number, topZ: number) => {
    const x = source.x + t * (receiver.x - source.x);
    const y = source.y + t * (receiver.y - source.y);
    const top: Point3 = { x, y, z: topZ };
    const dss = distance3(source, top);
    const dsr = distance3(top, receiver);
    const delta = dss + dsr - direct;
    if (delta > bestDelta) bestDelta = delta;
  };

  for (const b of buildings) {
    for (let i = 0; i < b.polygon.length; i++) {
      const p1 = b.polygon[i];
      const p2 = b.polygon[(i + 1) % b.polygon.length];
      const t = segmentsIntersectT(seg, { a: p1, b: p2 });
      if (t == null) continue;
      const zAtCrossing = source.z + t * (receiver.z - source.z);
      if (zAtCrossing < b.height) evaluate(t, b.height);
    }
  }

  for (const wall of barriers) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = wall.points[i];
      const p2 = wall.points[i + 1];
      const t = segmentsIntersectT(seg, { a: p1, b: p2 });
      if (t == null) continue;
      const zAtCrossing = source.z + t * (receiver.z - source.z);
      if (zAtCrossing < wall.height) evaluate(t, wall.height);
    }
  }

  return bestDelta;
}

// Point-in-polygon (ray casting).
export function pointInPolygon(
  p: { x: number; y: number },
  polygon: readonly { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
