import { describe, expect, it } from 'vitest';
import { inCone, wrapAngle, approachAngle, falloff, curve } from '../src/core/math';

const P = Math.PI;
const at = (a: number, d: number) => [Math.cos(a) * d, Math.sin(a) * d] as const;

describe('wrapAngle', () => {
  it('maps into (-PI, PI]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(P)).toBeCloseTo(P);
    expect(wrapAngle(-P)).toBeCloseTo(P);
    expect(wrapAngle(3 * P)).toBeCloseTo(P);
    expect(wrapAngle(P + 0.1)).toBeCloseTo(-P + 0.1);
    expect(wrapAngle(-P - 0.1)).toBeCloseTo(P - 0.1);
    for (let k = -50; k <= 50; k++) {
      const w = wrapAngle(k * 0.37);
      expect(w).toBeGreaterThan(-P - 1e-9);
      expect(w).toBeLessThanOrEqual(P + 1e-9);
    }
  });
});

describe('inCone', () => {
  it('accepts points on the axis and rejects behind the apex', () => {
    expect(inCone(...at(0.3, 100), 0, 0.3, 0.2, 200)).toBe(true);
    expect(inCone(...at(0.3 + P, 100), 0, 0.3, 0.2, 200)).toBe(false);
  });

  it('handles angle wrap at +-PI', () => {
    // beam pointing at +PI, target just across the seam at -PI + 0.05
    expect(inCone(...at(-P + 0.05, 100), 0, P, 0.1, 200)).toBe(true);
    expect(inCone(...at(P - 0.05, 100), 0, -P, 0.1, 200)).toBe(true);
    // beam at -PI + 0.02, target at PI - 0.02 (0.04 apart across the seam)
    expect(inCone(...at(P - 0.02, 100), 0, -P + 0.02, 0.05, 200)).toBe(true);
    expect(inCone(...at(P - 0.2, 100), 0, -P + 0.02, 0.05, 200)).toBe(false);
  });

  it('zero width: only points exactly on the ray, unless they have radius', () => {
    expect(inCone(100, 0, 0, 0, 0, 200)).toBe(true);
    expect(inCone(100, 0.5, 0, 0, 0, 200)).toBe(false);
    // a circle of radius 2 whose centre is 1 unit off the ray still touches it
    expect(inCone(100, 1, 2, 0, 0, 200)).toBe(true);
    expect(inCone(100, 3, 2, 0, 0, 200)).toBe(false);
  });

  it('range boundary is inclusive and extends by the target radius', () => {
    expect(inCone(200, 0, 0, 0, 0.3, 200)).toBe(true);
    expect(inCone(200.01, 0, 0, 0, 0.3, 200)).toBe(false);
    expect(inCone(205, 0, 5, 0, 0.3, 200)).toBe(true);
    expect(inCone(205.01, 0, 5, 0, 0.3, 200)).toBe(false);
  });

  it('edge of the cone is inclusive', () => {
    expect(inCone(...at(0.5 - 1e-6, 100), 0, 0, 0.5, 200)).toBe(true);
    expect(inCone(...at(0.5 + 1e-3, 100), 0, 0, 0.5, 200)).toBe(false);
  });

  it('a target overlapping the apex is always inside', () => {
    expect(inCone(-1, 0, 3, 0, 0.1, 200)).toBe(true);
  });
});

describe('helpers', () => {
  it('approachAngle takes the short way across the seam', () => {
    const a = approachAngle(P - 0.1, -P + 0.1, 0.05);
    expect(wrapAngle(a - (P - 0.05))).toBeCloseTo(0);
    expect(approachAngle(0, 0.02, 0.05)).toBeCloseTo(0.02);
  });
  it('falloff is 1 at apex and 1-strength at range', () => {
    expect(falloff(0, 100, 0.5)).toBe(1);
    expect(falloff(100, 100, 0.5)).toBe(0.5);
    expect(falloff(500, 100, 0.5)).toBe(0.5);
  });
  it('curve interpolates and clamps', () => {
    const c: Array<[number, number]> = [[0, 1], [10, 3]];
    expect(curve(c, -5)).toBe(1);
    expect(curve(c, 5)).toBe(2);
    expect(curve(c, 50)).toBe(3);
  });
});
