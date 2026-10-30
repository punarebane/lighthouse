import { describe, expect, it } from 'vitest';
import { Pool } from '../src/core/pool';
import { EnemyStore } from '../src/sim/stores';

describe('Pool', () => {
  it('allocates lowest indices first and returns -1 when full', () => {
    const p = new Pool(4);
    expect([p.alloc(), p.alloc(), p.alloc(), p.alloc()]).toEqual([0, 1, 2, 3]);
    expect(p.alloc()).toBe(-1);
    expect(p.count).toBe(4);
  });

  it('reuses freed slots and tracks the high-water mark', () => {
    const p = new Pool(8);
    for (let i = 0; i < 6; i++) p.alloc();
    p.free(2);
    p.free(5);
    expect(p.count).toBe(4);
    expect(p.hi).toBe(5);
    const a = p.alloc();
    expect([2, 5]).toContain(a);
    const b = p.alloc();
    expect(new Set([a, b])).toEqual(new Set([2, 5]));
    expect(p.hi).toBe(6);
    p.free(1);
    p.free(1); // double free is a no-op
    expect(p.count).toBe(5);
  });

  it('never hands out a live slot under random churn', () => {
    const p = new Pool(64);
    const live = new Set<number>();
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let step = 0; step < 5000; step++) {
      if (rnd() < 0.55) {
        const i = p.alloc();
        if (i >= 0) {
          if (live.has(i)) throw new Error(`slot ${i} handed out twice`);
          live.add(i);
        } else expect(live.size).toBe(64);
      } else if (live.size > 0) {
        const arr = [...live];
        const i = arr[Math.floor(rnd() * arr.length)]!;
        p.free(i);
        live.delete(i);
      }
      if (p.count !== live.size) throw new Error('count drift');
      if (step % 250 === 0) for (const i of live) expect(i).toBeLessThan(p.hi);
    }
  });

  it('SoA stores keep fixed typed-array capacity', () => {
    const s = new EnemyStore(100);
    expect(s.x).toBeInstanceOf(Float32Array);
    expect(s.type).toBeInstanceOf(Uint8Array);
    expect(s.x.length).toBe(100);
  });
});
