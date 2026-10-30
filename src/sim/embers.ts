import { CONFIG } from '../data/config';
import { Ev } from './events';
import { pointLit } from './beam';
import type { World } from './world';

export function spawnEmber(w: World, x: number, y: number, value: number): void {
  const M = w.embers;
  const i = M.pool.alloc();
  if (i < 0) {
    // pool full: fold the value into an existing ember rather than losing it
    const j = w.tick % Math.max(1, M.pool.hi);
    if (M.pool.alive[j]) M.value[j]! += value;
    return;
  }
  const a = w.rng.next() * Math.PI * 2;
  const sp = 20 + w.rng.next() * 50;
  M.x[i] = x; M.y[i] = y; M.px[i] = x; M.py[i] = y;
  M.vx[i] = Math.cos(a) * sp; M.vy[i] = Math.sin(a) * sp;
  M.value[i] = value;
  M.age[i] = 0;
  M.lit[i] = 0;
}

/** Embers drift to the rock only while lit (or inside the magnet radius). */
export function updateEmbers(w: World, dt: number): void {
  const M = w.embers;
  const C = CONFIG.embers;
  const s = w.stats;
  const accel = C.accel * s.emberSpeedMult;
  const maxV = C.maxSpeed * s.emberSpeedMult;
  const drag = Math.exp(-C.drag * dt);
  const pick2 = C.pickupRadius * C.pickupRadius;
  const mag2 = s.magnetRadius * s.magnetRadius;
  const hi = M.pool.hi;
  for (let i = 0; i < hi; i++) {
    if (!M.pool.alive[i]) continue;
    M.age[i]! += dt;
    if (M.age[i]! > C.lifetime) {
      M.pool.free(i);
      continue;
    }
    const x = M.x[i]!, y = M.y[i]!;
    const d2 = x * x + y * y;
    if (d2 <= pick2) {
      const v = M.value[i]! * s.xpMult;
      w.xp += v;
      w.embersCollected += M.value[i]!;
      w.events.push(Ev.EmberPick, x, y, v);
      M.pool.free(i);
      continue;
    }
    const lit = d2 <= mag2 || pointLit(w, x, y);
    M.lit[i] = lit ? 1 : 0;
    let vx = M.vx[i]! * drag, vy = M.vy[i]! * drag;
    if (lit) {
      const d = Math.sqrt(d2);
      vx -= (x / d) * accel * dt;
      vy -= (y / d) * accel * dt;
      const sp2 = vx * vx + vy * vy;
      if (sp2 > maxV * maxV) {
        const k = maxV / Math.sqrt(sp2);
        vx *= k; vy *= k;
      }
    }
    M.vx[i] = vx; M.vy[i] = vy;
    M.x[i] = x + vx * dt;
    M.y[i] = y + vy * dt;
  }
}
