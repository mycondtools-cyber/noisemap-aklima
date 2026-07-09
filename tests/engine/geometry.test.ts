import { describe, it, expect } from 'vitest';
import {
  distance3,
  hasLineOfSight,
  pathDifference,
  pointInPolygon,
  toLocalXY,
  BuildingPrism,
} from '../../src/engine/geometry';

describe('geometry: distances', () => {
  it('distance3 is Euclidean', () => {
    expect(
      distance3({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }),
    ).toBeCloseTo(5, 6);
    expect(
      distance3({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }),
    ).toBeCloseTo(10, 6);
  });
});

describe('geometry: local XY', () => {
  it('origin maps to (0,0)', () => {
    const origin = { lat: 50, lng: 20 };
    const xy = toLocalXY(50, 20, origin);
    expect(xy.x).toBeCloseTo(0, 6);
    expect(xy.y).toBeCloseTo(0, 6);
  });
  it('one degree of latitude is ~111 km', () => {
    const origin = { lat: 50, lng: 20 };
    const xy = toLocalXY(51, 20, origin);
    expect(xy.y).toBeGreaterThan(110000);
    expect(xy.y).toBeLessThan(112000);
  });
});

describe('geometry: point in polygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('interior points are inside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });
  it('exterior points are outside', () => {
    expect(pointInPolygon({ x: 20, y: 5 }, square)).toBe(false);
  });
});

describe('geometry: line of sight over a low building', () => {
  const building: BuildingPrism = {
    polygon: [
      { x: 40, y: -5 },
      { x: 60, y: -5 },
      { x: 60, y: 5 },
      { x: 40, y: 5 },
    ],
    height: 3,
  };
  it('ray at z=5 clears a 3 m building', () => {
    // Source at (0,0,5), receiver at (100,0,5): line stays at z=5 > 3.
    const src = { x: 0, y: 0, z: 5 };
    const rcv = { x: 100, y: 0, z: 5 };
    expect(hasLineOfSight(src, rcv, [building])).toBe(true);
  });
  it('ray at z=1 is blocked by a 3 m building', () => {
    const src = { x: 0, y: 0, z: 1 };
    const rcv = { x: 100, y: 0, z: 1 };
    expect(hasLineOfSight(src, rcv, [building])).toBe(false);
  });
});

describe('geometry: path difference δ', () => {
  it('is 0 when there is no barrier in the way', () => {
    const src = { x: 0, y: 0, z: 5 };
    const rcv = { x: 100, y: 0, z: 5 };
    expect(pathDifference(src, rcv, [], [])).toBeCloseTo(0, 6);
  });

  it('grows with barrier height for a horizontal source-receiver pair', () => {
    // Source and receiver both at 1.5 m, distance 20 m. Barrier at x=10, height h.
    const src = { x: 0, y: 0, z: 1.5 };
    const rcv = { x: 20, y: 0, z: 1.5 };
    const wall = (h: number): BuildingPrism => ({
      polygon: [
        { x: 9, y: -5 },
        { x: 11, y: -5 },
        { x: 11, y: 5 },
        { x: 9, y: 5 },
      ],
      height: h,
    });
    const d1 = pathDifference(src, rcv, [wall(2)], []);
    const d2 = pathDifference(src, rcv, [wall(4)], []);
    const d3 = pathDifference(src, rcv, [wall(6)], []);
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });
});
