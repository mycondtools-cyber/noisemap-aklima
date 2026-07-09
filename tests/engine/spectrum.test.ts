import { describe, it, expect } from 'vitest';
import {
  A_WEIGHTING,
  OCTAVES,
  aWeight,
  energeticSum,
  multiSourceSum,
  toDBA,
  synthesiseSpectrumFromTotalDBA,
  directivityIndex,
} from '../../src/engine/spectrum';

describe('spectrum: A-weighting', () => {
  it('has one correction per octave', () => {
    expect(A_WEIGHTING.length).toBe(OCTAVES.length);
  });

  it('sums an equal-per-octave spectrum correctly', () => {
    // For a flat 0 dB spectrum, dBA equals the energetic sum of A-weight values.
    const flat = OCTAVES.map(() => 0);
    const expected = energeticSum(A_WEIGHTING);
    expect(toDBA(flat)).toBeCloseTo(expected, 3);
  });

  it('shifts every octave when adding a scalar', () => {
    const flat = OCTAVES.map(() => 10);
    expect(aWeight(flat).map((v) => Math.round(v * 10) / 10)).toEqual(
      A_WEIGHTING.map((w) => Math.round((10 + w) * 10) / 10),
    );
  });
});

describe('spectrum: energetic sum', () => {
  it('two equal sources add 3 dB', () => {
    expect(energeticSum([60, 60])).toBeCloseTo(63.0103, 3);
  });

  it('N equal sources add 10·log10(N)', () => {
    expect(multiSourceSum(60, 4)).toBeCloseTo(66.0206, 3);
  });

  it('dominant source hides the weaker one', () => {
    expect(energeticSum([80, 40])).toBeCloseTo(80.00004, 3);
  });
});

describe('spectrum: synthetic spectrum from total dBA', () => {
  it('round-trips to the requested total', () => {
    for (const total of [50, 58, 65, 72]) {
      const spec = synthesiseSpectrumFromTotalDBA(total);
      expect(toDBA(spec)).toBeCloseTo(total, 2);
    }
  });
});

describe('spectrum: directivity index', () => {
  it('Q=2 free field → +3 dB', () => {
    expect(directivityIndex(2)).toBeCloseTo(3.0103, 3);
  });
  it('Q=4 wall → +6 dB', () => {
    expect(directivityIndex(4)).toBeCloseTo(6.0206, 3);
  });
  it('Q=8 corner → +9 dB', () => {
    expect(directivityIndex(8)).toBeCloseTo(9.0309, 3);
  });
});
