// Octave band centre frequencies used throughout the engine.
export const OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000] as const;
export type OctaveIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// IEC 61672-1 A-weighting corrections at nominal octave centres (dB).
export const A_WEIGHTING: readonly number[] = [
  -26.2, -16.1, -8.6, -3.2, 0.0, 1.2, 1.0, -1.1,
];

// Typical compressor + fan outdoor-unit relative spectrum (dB re: total Lw(A)).
// Numbers are derived from measured heat-pump / VRF outdoor units and normalised
// so that A-weighted energy summation equals 0 dB. They are used only when the
// equipment record does not provide octave-band Lw values.
export const TYPICAL_COMPRESSOR_FAN_SPECTRUM: readonly number[] = [
  -15, -8, -3, -2, -4, -7, -11, -16,
];

export function aWeight(octaveDb: readonly number[]): number[] {
  return octaveDb.map((v, i) => v + A_WEIGHTING[i]);
}

// Energetic sum of a set of dB values: 10 * log10( sum( 10^(x/10) ) ).
export function energeticSum(values: readonly number[]): number {
  if (values.length === 0) return -Infinity;
  let acc = 0;
  for (const v of values) {
    if (Number.isFinite(v)) acc += Math.pow(10, v / 10);
  }
  if (acc <= 0) return -Infinity;
  return 10 * Math.log10(acc);
}

// Sum multiple identical sources: +10 * log10(n).
export function multiSourceSum(baseLevel: number, count: number): number {
  if (count <= 1) return baseLevel;
  return baseLevel + 10 * Math.log10(count);
}

// Total dBA from a per-octave (unweighted) Lw or Lp array.
export function toDBA(octaveDb: readonly number[]): number {
  return energeticSum(aWeight(octaveDb));
}

/**
 * Build an octave-band Lw spectrum given only the total dB(A) rating.
 * The typical compressor/fan spectrum is scaled so that A-weighted energetic
 * sum equals the requested total.
 */
export function synthesiseSpectrumFromTotalDBA(totalDBA: number): number[] {
  const relative = TYPICAL_COMPRESSOR_FAN_SPECTRUM.slice();
  const dbaOfRelative = toDBA(relative);
  const offset = totalDBA - dbaOfRelative;
  return relative.map((v) => v + offset);
}

// Directivity index from mounting-type factor Q.
export function directivityIndex(Q: number): number {
  if (Q <= 0) return 0;
  return 10 * Math.log10(Q);
}
