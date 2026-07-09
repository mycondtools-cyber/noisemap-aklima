// ISO 9613-2 outdoor sound propagation calculation (MVP).
// Reference clauses noted inline. All results in dB (band level) unless the
// return value is A-weighted total (dBA).

import {
  OCTAVES,
  aWeight as aWeightSpectrum,
  energeticSum,
  directivityIndex,
  synthesiseSpectrumFromTotalDBA,
} from './spectrum';
import {
  distance3,
  firstObstruction,
  pathDifference,
  toLocalXY,
  Point3,
  BuildingPrism,
  BarrierWall,
} from './geometry';
import type {
  Source,
  Receiver,
  Building,
  Barrier,
  EquipmentModel,
} from './types';

// --- Atmospheric absorption ---------------------------------------------------

// Aatm coefficients (dB / km) at 10 °C / 70 % RH — ISO 9613-1 Annex D, one of
// the tabulated reference conditions. Values are at 63, 125, 250, 500, 1000,
// 2000, 4000, 8000 Hz.
export const AATM_10C_70RH_DB_PER_KM: readonly number[] = [
  0.1, 0.4, 1.0, 1.9, 3.7, 9.7, 32.8, 117.0,
];

export function atmosphericAttenuation(distanceMeters: number): number[] {
  const km = distanceMeters / 1000;
  return AATM_10C_70RH_DB_PER_KM.map((c) => c * km);
}

// --- Geometric divergence -----------------------------------------------------

/**
 * ISO 9613-2 §7.1: Adiv = 20·log10(d/d0) + 11, with d0 = 1 m (point source).
 * Guards against d < 1 m (near-field falls outside ISO 9613-2 validity).
 */
export function geometricDivergence(distanceMeters: number): number {
  const d = Math.max(distanceMeters, 1);
  return 20 * Math.log10(d) + 11;
}

// --- Ground attenuation (alternative method §7.3.2) --------------------------

/**
 * ISO 9613-2 §7.3.2 alternative method for the A-weighted total Agr.
 *
 *   Agr = 4.8 − (2·hm/d)·(17 + 300/d)   with a floor of 0 dB.
 *
 * Result is scaled linearly by G (ground factor 0..1).
 */
export function groundAttenuationAlternative(
  hm: number,
  distanceMeters: number,
  G: number,
): number {
  if (distanceMeters <= 0) return 0;
  const raw = 4.8 - ((2 * hm) / distanceMeters) * (17 + 300 / distanceMeters);
  const capped = Math.max(0, raw);
  return capped * Math.max(0, Math.min(1, G));
}

// --- Barrier attenuation ------------------------------------------------------

/**
 * ISO 9613-2 §7.4: Dz = 10·log10(3 + (C2/λ)·δ·Kmet), capped at 20 dB per band.
 * λ = 340 / f  (m).
 */
export function barrierAttenuationPerOctave(
  delta: number,
  Kmet = 1,
  C2 = 20,
): number[] {
  if (delta <= 0) return OCTAVES.map(() => 0);
  return OCTAVES.map((f) => {
    const lambda = 340 / f;
    const arg = 3 + (C2 / lambda) * delta * Kmet;
    if (arg <= 0) return 0;
    const Dz = 10 * Math.log10(arg);
    return Math.max(0, Math.min(20, Dz));
  });
}

// --- Full calculation ---------------------------------------------------------

export type MountingType = 'free' | 'wall' | 'corner';

export interface EngineSource {
  position: Point3;
  octaveLw?: number[];
  totalLwA?: number;
  mounting: MountingType;
  count: number;
}

export interface EngineReceiver {
  position: Point3;
}

export interface EnvironmentSettings {
  G: number;
  Kmet?: number;
  C2?: number;
}

export interface SinglePairResult {
  octave: number[];
  octaveA: number[];
  totalDBA: number;
  distance: number;
  blocked: boolean;
}

export function Q_of(mounting: MountingType): number {
  switch (mounting) {
    case 'free':
      return 2;
    case 'wall':
      return 4;
    case 'corner':
      return 8;
  }
}

export function sourceOctaveLw(source: EngineSource): number[] {
  if (source.octaveLw && source.octaveLw.length === OCTAVES.length) {
    return source.octaveLw.slice();
  }
  if (source.totalLwA != null) {
    return synthesiseSpectrumFromTotalDBA(source.totalLwA);
  }
  throw new Error('Source has neither octaveLw nor totalLwA');
}

export function calculatePair(
  source: EngineSource,
  receiver: EngineReceiver,
  buildings: readonly BuildingPrism[],
  barriers: readonly BarrierWall[],
  env: EnvironmentSettings,
): SinglePairResult {
  const Lw = sourceOctaveLw(source);
  const d = distance3(source.position, receiver.position);
  const Adiv = geometricDivergence(d);
  const Aatm = atmosphericAttenuation(d);
  const hm = 0.5 * (source.position.z + receiver.position.z);
  const AgrTotal = groundAttenuationAlternative(hm, d, env.G);
  const delta = pathDifference(
    source.position,
    receiver.position,
    buildings,
    barriers,
  );
  const Abar = barrierAttenuationPerOctave(delta, env.Kmet ?? 1, env.C2 ?? 20);
  const DI = directivityIndex(Q_of(source.mounting));
  const multi = source.count > 1 ? 10 * Math.log10(source.count) : 0;

  const octave = Lw.map(
    (lw, i) => lw + DI + multi - Adiv - Aatm[i] - AgrTotal - Abar[i],
  );
  const octaveA = aWeightSpectrum(octave);
  const totalDBA = energeticSum(octaveA);
  const blocked =
    firstObstruction(source.position, receiver.position, buildings) !== null;
  return { octave, octaveA, totalDBA, distance: d, blocked };
}

export function calculateReceiver(
  sources: readonly EngineSource[],
  receiver: EngineReceiver,
  buildings: readonly BuildingPrism[],
  barriers: readonly BarrierWall[],
  env: EnvironmentSettings,
): { totalDBA: number; contributions: SinglePairResult[] } {
  const contributions = sources.map((s) =>
    calculatePair(s, receiver, buildings, barriers, env),
  );
  const totalDBA = energeticSum(contributions.map((c) => c.totalDBA));
  return { totalDBA, contributions };
}

// --- Public "cal*" API matching the SPEC surface -----------------------------

/** Geometric divergence Adiv = 20·log10(d) + 11 (single value). */
export function calcAdiv(d: number): number {
  return geometricDivergence(d);
}

/** Atmospheric absorption for a single octave centre frequency, distance in m. */
export function calcAatm(f: number, d: number): number {
  const idx = OCTAVES.indexOf(f as (typeof OCTAVES)[number]);
  if (idx < 0) throw new Error(`Unsupported octave frequency: ${f}`);
  return AATM_10C_70RH_DB_PER_KM[idx] * (d / 1000);
}

/** Ground attenuation (§7.3.2 alternative). f is ignored (single-valued method). */
export function calcAgr(
  _f: number,
  hs: number,
  hr: number,
  d: number,
  G = 0.5,
): number {
  const hm = 0.5 * (hs + hr);
  return groundAttenuationAlternative(hm, d, G);
}

/** Barrier attenuation for a single frequency and δ. */
export function calcAbar(delta: number, f: number, C2 = 20, Kmet = 1): number {
  if (delta <= 0) return 0;
  const lambda = 340 / f;
  const arg = 3 + (C2 / lambda) * delta * Kmet;
  if (arg <= 0) return 0;
  return Math.max(0, Math.min(20, 10 * Math.log10(arg)));
}

/** Directivity index from mounting type. */
export function calcDI(mounting: MountingType): number {
  return directivityIndex(Q_of(mounting));
}

/** Energetic sum: 10·log10(Σ 10^(L/10)). */
export function energySum(levels: readonly number[]): number {
  return energeticSum(levels);
}

/** A-weight a per-octave (unweighted) spectrum → total dBA. */
export function aWeightTotalDBA(octaveLevels: readonly number[]): number {
  return energeticSum(aWeightSpectrum(octaveLevels));
}
export { aWeightTotalDBA as aWeight };

// --- Line-of-sight and full-scenario LpA -------------------------------------

/**
 * 3D ray cast returning whether the direct source→receiver line is unobstructed
 * by any building prism. Inputs are [lat, lng, z].
 */
export function checkLineOfSight(
  src: [number, number, number],
  rec: [number, number, number],
  buildings: readonly Building[],
): { visible: boolean; blocker?: Building } {
  const origin = { lat: src[0], lng: src[1] };
  const srcXY = toLocalXY(src[0], src[1], origin);
  const recXY = toLocalXY(rec[0], rec[1], origin);
  const s: Point3 = { x: srcXY.x, y: srcXY.y, z: src[2] };
  const r: Point3 = { x: recXY.x, y: recXY.y, z: rec[2] };

  let bestHeight = -Infinity;
  let blocker: Building | undefined;
  for (const b of buildings) {
    const polygon = b.polygon.map(([lat, lng]) => toLocalXY(lat, lng, origin));
    const prism: BuildingPrism = { polygon, height: b.height };
    const hit = firstObstruction(s, r, [prism]);
    if (hit && hit.buildingHeight > bestHeight) {
      bestHeight = hit.buildingHeight;
      blocker = b;
    }
  }
  return blocker ? { visible: false, blocker } : { visible: true };
}

/**
 * Full ISO 9613-2 LpA at a receiver for a single source.
 *
 * `source` uses lat/lng/hs/mounting/count/modelId (see engine/types).
 * `receiver` uses lat/lng/h.
 * `buildings` polygons are [lat, lng] pairs.
 * Returns total LpA (dBA) and the per-octave A-weighted Lp array.
 */
export function calcLpA(
  source: Source,
  receiver: Receiver,
  buildings: readonly Building[],
  barriers: readonly Barrier[],
  equipment: readonly EquipmentModel[],
  G = 0.5,
  mode: 'day' | 'night' = 'day',
): { LpA: number; perBand: number[] } {
  const eq = equipment.find((e) => e.id === source.modelId);
  if (!eq) throw new Error(`Unknown equipment model: ${source.modelId}`);

  const origin = { lat: source.lat, lng: source.lng };
  const srcXY = toLocalXY(source.lat, source.lng, origin);
  const recXY = toLocalXY(receiver.lat, receiver.lng, origin);
  const s: Point3 = { x: srcXY.x, y: srcXY.y, z: source.hs };
  const r: Point3 = { x: recXY.x, y: recXY.y, z: receiver.h };

  const buildingPrisms: BuildingPrism[] = buildings.map((b) => ({
    polygon: b.polygon.map(([lat, lng]) => toLocalXY(lat, lng, origin)),
    height: b.height,
  }));
  const barrierWalls: BarrierWall[] = barriers.map((b) => ({
    points: b.line.map(([lat, lng]) => toLocalXY(lat, lng, origin)),
    height: b.height,
  }));

  const baseLw = eq.octaveLw.slice();
  let Lw = baseLw;
  if (mode === 'night') {
    if (eq.nightLwA != null) {
      const baseTotalA = energeticSum(aWeightSpectrum(baseLw));
      const delta = eq.nightLwA - baseTotalA;
      Lw = baseLw.map((v) => v + delta);
    } else if (source.nightOffsetDb != null) {
      Lw = baseLw.map((v) => v + source.nightOffsetDb!);
    }
  }

  const engineSrc: EngineSource = {
    position: s,
    octaveLw: Lw,
    mounting: source.mounting,
    count: source.count,
  };
  const res = calculatePair(
    engineSrc,
    { position: r },
    buildingPrisms,
    barrierWalls,
    { G },
  );
  return { LpA: res.totalDBA, perBand: res.octaveA };
}
