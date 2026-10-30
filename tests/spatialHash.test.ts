import { describe, expect, it } from 'vitest';
import { SpatialHash } from '../src/core/spatialHash';
import { inCone } from '../src/core/math';
import { Rng } from '../src/core/rng';

function setup(seed: number, n: number, spread: number) {
  const rng = new Rng(seed);
  const xs = new Float32Array(n), ys = new Float32Array(n), rs = new Float32Array(n);
  const alive = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = rng.range(-spread, spread);
    ys[i] = rng.range(-spread, spread);
    rs[i] = rng.range(0, 20);
    alive[i] = rng.chance(0.85) ? 1 : 0;
  }
  const hash = new SpatialHash(1088, 64, n);
  hash.rebuild(xs, ys, alive, n);
  return { rng, xs, ys, rs, alive, hash };
}

const sorted = (a: Int32Array, n: number) => Array.from(a.subarray(0, n)).sort((x, y) => x - y);

describe('SpatialHash', () => {
  it('indexes every live item exactly once', () => {
    const { hash, alive } = setup(1, 2000, 1500);
    const live = alive.reduce((s, v) => s + v, 0);
    expect(hash.count).toBe(live);
    const seen = new Set(Array.from(hash.items.subarray(0, hash.count)));
    expect(seen.size).toBe(live);
  });

  it('circle queries match brute force (randomised)', () => {
    for (let trial = 0; trial < 20; trial++) {
      const { rng, xs, ys, rs, alive, hash } = setup(100 + trial, 1500, 1400);
      const out = new Int32Array(1500);
      for (let q = 0; q < 50; q++) {
        const x = rng.range(-1200, 1200), y = rng.range(-1200, 1200), r = rng.range(0, 400);
        const useR = q % 2 === 0;
        const n = hash.queryCircle(x, y, r, xs, ys, useR ? rs : null, 20, out);
        const brute: number[] = [];
        for (let i = 0; i < xs.length; i++) {
          if (!alive[i]) continue;
          const rr = r + (useR ? rs[i]! : 0);
          const dx = xs[i]! - x, dy = ys[i]! - y;
          if (dx * dx + dy * dy <= rr * rr) brute.push(i);
        }
        expect(sorted(out, n)).toEqual(brute);
      }
    }
  });

  it('cone queries match brute force, including the +-PI seam, zero width and wide cones', () => {
    for (let trial = 0; trial < 20; trial++) {
      const { rng, xs, ys, rs, alive, hash } = setup(500 + trial, 1500, 1400);
      const out = new Int32Array(1500);
      for (let q = 0; q < 60; q++) {
        const ox = q % 3 === 0 ? 0 : rng.range(-300, 300);
        const oy = q % 3 === 0 ? 0 : rng.range(-300, 300);
        const dir = q % 5 === 0 ? (rng.chance(0.5) ? Math.PI : -Math.PI) + rng.range(-0.05, 0.05) : rng.range(-Math.PI, Math.PI);
        const half = q % 7 === 0 ? 0 : q % 11 === 0 ? rng.range(1.5, Math.PI) : rng.range(0.02, 1.2);
        const range = rng.range(50, 900);
        const useR = q % 2 === 0;
        const n = hash.queryCone(ox, oy, dir, half, range, xs, ys, useR ? rs : null, 20, out);
        const brute: number[] = [];
        for (let i = 0; i < xs.length; i++) {
          if (!alive[i]) continue;
          if (inCone(xs[i]! - ox, ys[i]! - oy, useR ? rs[i]! : 0, dir, half, range)) brute.push(i);
        }
        expect(sorted(out, n)).toEqual(brute);
      }
    }
  });
});
