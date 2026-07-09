import { describe, it, expect } from 'vitest';
import {
  AATM_10C_70RH_DB_PER_KM,
  atmosphericAttenuation,
  barrierAttenuationPerOctave,
  calculatePair,
  calculateReceiver,
  geometricDivergence,
  groundAttenuationAlternative,
  Q_of,
  calcAdiv,
  calcAatm,
  calcAgr,
  calcAbar,
  calcDI,
  energySum,
  aWeight,
  checkLineOfSight,
  calcLpA,
} from '../../src/engine/iso9613';
import { energeticSum } from '../../src/engine/spectrum';
import type {
  Source,
  Receiver,
  Building,
  EquipmentModel,
} from '../../src/engine/types';

describe('iso9613: Adiv (geometric divergence)', () => {
  it('at d=10 m: 20·log10(10)+11 = 31 dB', () => {
    expect(geometricDivergence(10)).toBeCloseTo(31, 6);
  });
  it('at d=100 m: 20·log10(100)+11 = 51 dB', () => {
    expect(geometricDivergence(100)).toBeCloseTo(51, 6);
  });
  it('is clamped at d=1 m so it never goes negative', () => {
    expect(geometricDivergence(0.001)).toBeCloseTo(11, 6);
  });
});

describe('iso9613: Aatm (atmospheric absorption 10°C/70%RH)', () => {
  it('has one coefficient per octave', () => {
    expect(AATM_10C_70RH_DB_PER_KM.length).toBe(8);
  });
  it('is linear in distance', () => {
    const at100 = atmosphericAttenuation(100);
    const at200 = atmosphericAttenuation(200);
    for (let i = 0; i < 8; i++) {
      expect(at200[i]).toBeCloseTo(2 * at100[i], 6);
    }
  });
  it('matches published coefficients at 1 km', () => {
    const at1km = atmosphericAttenuation(1000);
    for (let i = 0; i < 8; i++) {
      expect(at1km[i]).toBeCloseTo(AATM_10C_70RH_DB_PER_KM[i], 6);
    }
  });
});

describe('iso9613: Agr (ground alternative method §7.3.2)', () => {
  it('is 0 for hard ground (G=0)', () => {
    expect(groundAttenuationAlternative(1.5, 50, 0)).toBe(0);
  });
  it('is positive for soft ground and typical geometry', () => {
    // hm=1.5, d=100, G=0.5 → 4.8 − (0.03)*(20) = 4.8 − 0.6 = 4.2, ×0.5 = 2.1 dB
    expect(groundAttenuationAlternative(1.5, 100, 0.5)).toBeCloseTo(2.1, 3);
  });
  it('is floored at 0 dB for very low heights and short distances', () => {
    // Negative raw value gets clamped to 0.
    expect(groundAttenuationAlternative(0.5, 5, 1)).toBe(0);
  });
});

describe('iso9613: Abar (barrier diffraction)', () => {
  it('is 0 across the whole spectrum when δ=0', () => {
    const A = barrierAttenuationPerOctave(0);
    for (const v of A) expect(v).toBe(0);
  });
  it('grows with δ and is larger at high frequencies', () => {
    const small = barrierAttenuationPerOctave(0.05);
    const large = barrierAttenuationPerOctave(1.0);
    // Larger δ ⇒ more attenuation at every band.
    for (let i = 0; i < 8; i++) expect(large[i]).toBeGreaterThan(small[i]);
    // High frequencies attenuate more than low frequencies for the same δ.
    expect(large[7]).toBeGreaterThan(large[0]);
  });
  it('is capped at 20 dB per band', () => {
    const A = barrierAttenuationPerOctave(1000);
    for (const v of A) expect(v).toBeLessThanOrEqual(20 + 1e-9);
  });
});

describe('iso9613: mounting DI factors', () => {
  it('maps mounting → Q', () => {
    expect(Q_of('free')).toBe(2);
    expect(Q_of('wall')).toBe(4);
    expect(Q_of('corner')).toBe(8);
  });
});

describe('iso9613: end-to-end reference pair', () => {
  // Reference case: a point source with Lw(A)=60 dBA, wall-mounted (Q=4, DI=6 dB),
  // over hard ground (G=0), no barrier, distance 10 m, source at 2 m, receiver at
  // 1.5 m. Manual computation:
  //   Adiv = 20·log10(10)+11 = 31 dB
  //   Aatm at 10 m ≈ 0 (< 0.1 dB summed)
  //   Agr(G=0) = 0
  //   Abar = 0
  //   DI = +6 dB
  //   Lp,total(dBA) ≈ Lw,total + DI − Adiv = 60 + 6 − 31 = 35 dBA
  // Because the source uses the synthesised spectrum whose A-weighted sum equals
  // 60, and every band gets the same +DI −Adiv shift, the total should track
  // the manual calc within a small rounding tolerance.
  it('60 dBA at 10 m, wall-mounted → ~35 dBA', () => {
    const res = calculatePair(
      {
        position: { x: 0, y: 0, z: 2 },
        totalLwA: 60,
        mounting: 'wall',
        count: 1,
      },
      { position: { x: 10, y: 0, z: 1.5 } },
      [],
      [],
      { G: 0 },
    );
    expect(res.totalDBA).toBeCloseTo(35, 0);
    expect(res.blocked).toBe(false);
    expect(res.distance).toBeCloseTo(
      Math.sqrt(10 * 10 + 0.5 * 0.5),
      3,
    );
  });

  it('doubling identical sources adds 3 dB', () => {
    const base = calculatePair(
      {
        position: { x: 0, y: 0, z: 2 },
        totalLwA: 60,
        mounting: 'wall',
        count: 1,
      },
      { position: { x: 20, y: 0, z: 1.5 } },
      [],
      [],
      { G: 0 },
    );
    const doubled = calculatePair(
      {
        position: { x: 0, y: 0, z: 2 },
        totalLwA: 60,
        mounting: 'wall',
        count: 2,
      },
      { position: { x: 20, y: 0, z: 1.5 } },
      [],
      [],
      { G: 0 },
    );
    expect(doubled.totalDBA - base.totalDBA).toBeCloseTo(3.0103, 2);
  });

  it('two independent sources sum energetically at the receiver', () => {
    const r = { position: { x: 50, y: 0, z: 1.5 } };
    const s1 = {
      position: { x: 0, y: 0, z: 2 },
      totalLwA: 60,
      mounting: 'free' as const,
      count: 1,
    };
    const s2 = {
      position: { x: 0, y: 10, z: 2 },
      totalLwA: 60,
      mounting: 'free' as const,
      count: 1,
    };
    const single1 = calculatePair(s1, r, [], [], { G: 0 });
    const single2 = calculatePair(s2, r, [], [], { G: 0 });
    const both = calculateReceiver([s1, s2], r, [], [], { G: 0 });
    const expected = energeticSum([single1.totalDBA, single2.totalDBA]);
    expect(both.totalDBA).toBeCloseTo(expected, 3);
    // Two near-equal-level sources ⇒ ~3 dB gain over one.
    expect(both.totalDBA - single1.totalDBA).toBeCloseTo(3.0103, 0);
  });

  it('adding a tall barrier reduces the received level', () => {
    const src = {
      position: { x: 0, y: 0, z: 1.5 },
      totalLwA: 65,
      mounting: 'free' as const,
      count: 1,
    };
    const rcv = { position: { x: 30, y: 0, z: 1.5 } };
    const buildings = [
      {
        polygon: [
          { x: 14, y: -5 },
          { x: 16, y: -5 },
          { x: 16, y: 5 },
          { x: 14, y: 5 },
        ],
        height: 5,
      },
    ];
    const open = calculatePair(src, rcv, [], [], { G: 0 });
    const shielded = calculatePair(src, rcv, buildings, [], { G: 0 });
    expect(shielded.totalDBA).toBeLessThan(open.totalDBA);
    expect(shielded.blocked).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Public "calc*" API wrappers (SPEC surface).
// -----------------------------------------------------------------------------

describe('calc* wrappers: divergence and attenuation', () => {
  it('calcAdiv: ~31 dB at 10 m', () => {
    expect(calcAdiv(10)).toBeCloseTo(31, 0);
  });
  it('calcAdiv: ~45 dB at 50 m', () => {
    expect(calcAdiv(50)).toBeCloseTo(45, 0);
  });
  it('calcAatm: ~0.3 dB at 1 kHz over 100 m', () => {
    const v = calcAatm(1000, 100);
    expect(v).toBeGreaterThan(0.2);
    expect(v).toBeLessThan(0.5);
  });
  it('calcAatm: rejects non-standard frequencies', () => {
    expect(() => calcAatm(1234, 100)).toThrow();
  });
  it('calcAgr: never negative', () => {
    expect(calcAgr(1000, 1.5, 1.5, 100, 0.5)).toBeGreaterThanOrEqual(0);
  });
  it('calcAbar: ~9.5 dB for δ=0.1 m at 1 kHz', () => {
    const dz = calcAbar(0.1, 1000);
    expect(dz).toBeGreaterThan(8);
    expect(dz).toBeLessThan(11);
  });
  it('calcAbar: 0 when δ ≤ 0', () => {
    expect(calcAbar(0, 1000)).toBe(0);
    expect(calcAbar(-1, 1000)).toBe(0);
  });
});

describe('calc* wrappers: DI, energySum, aWeight', () => {
  it('calcDI: free/wall/corner map to +3/+6/+9 dB', () => {
    expect(calcDI('free')).toBeCloseTo(3, 0);
    expect(calcDI('wall')).toBeCloseTo(6, 0);
    expect(calcDI('corner')).toBeCloseTo(9, 0);
  });
  it('energySum: two equal 60 dB sources → +3 dB', () => {
    expect(energySum([60, 60])).toBeCloseTo(63, 1);
  });
  it('aWeight: flat spectrum returns a plausible dBA', () => {
    const v = aWeight(Array(8).fill(60));
    expect(v).toBeGreaterThan(55);
    expect(v).toBeLessThan(75);
  });
});

describe('checkLineOfSight', () => {
  it('empty world → visible', () => {
    const res = checkLineOfSight(
      [52.23, 21.01, 1.5],
      [52.2305, 21.01, 1.5],
      [],
    );
    expect(res.visible).toBe(true);
  });
});

describe('calcLpA (integration)', () => {
  const equipment: EquipmentModel[] = [
    {
      id: 'test',
      brand: 'T',
      model: 'M',
      octaveLw: [65, 70, 73, 72, 68, 63, 58, 52],
      lwA: 74,
      nightLwA: 71,
    },
  ];
  const src: Source = {
    id: 's1',
    lat: 52.23,
    lng: 21.01,
    hs: 1.5,
    mounting: 'free',
    count: 1,
    modelId: 'test',
    mode: 'day',
  };

  it('reasonable LpA near a source', () => {
    const rec: Receiver = { id: 'n', lat: 52.230009, lng: 21.01, h: 1.5 };
    const { LpA, perBand } = calcLpA(src, rec, [], [], equipment);
    expect(perBand.length).toBe(8);
    expect(LpA).toBeGreaterThan(40);
    expect(LpA).toBeLessThan(90);
  });

  it('LpA falls off with distance', () => {
    const near: Receiver = { id: 'n', lat: 52.2302, lng: 21.01, h: 1.5 };
    const far: Receiver = { id: 'f', lat: 52.24, lng: 21.01, h: 1.5 };
    expect(calcLpA(src, near, [], [], equipment).LpA).toBeGreaterThan(
      calcLpA(src, far, [], [], equipment).LpA,
    );
  });

  it('night quieter than day', () => {
    const rec: Receiver = { id: 'r', lat: 52.2302, lng: 21.01, h: 1.5 };
    const day = calcLpA(src, rec, [], [], equipment, 0.5, 'day').LpA;
    const night = calcLpA(src, rec, [], [], equipment, 0.5, 'night').LpA;
    expect(night).toBeLessThan(day);
  });

  it('a tall building shields the receiver', () => {
    const rec: Receiver = { id: 'r', lat: 52.2309, lng: 21.01, h: 1.5 };
    const wall: Building = {
      id: 'b1',
      polygon: [
        [52.2304, 21.0098],
        [52.2304, 21.0102],
        [52.23045, 21.0102],
        [52.23045, 21.0098],
      ],
      height: 30,
      protected: false,
      source: 'manual',
    };
    const open = calcLpA(src, rec, [], [], equipment).LpA;
    const shielded = calcLpA(src, rec, [wall], [], equipment).LpA;
    expect(shielded).toBeLessThan(open);
  });
});
