import { CONFIG, ENEMIES, BOSSES, EnemyType } from '../data/config';
import { curve, TAU } from '../core/math';
import { Ev } from './events';
import { spawnEnemy, spawnBoss } from './enemies';
import type { World } from './world';

/**
 * Threat-budget director. Every random roll comes from w.dirRng and is made regardless of
 * whether the spawn succeeds (pool full / cap hit), so the spawn sequence is a pure function
 * of the seed: ?seed=123 reproduces a run's spawns.
 */
export function threatRate(t: number): number {
  const D = CONFIG.director;
  let rate = curve(D.threatCurve, t);
  for (const b of BOSSES) if (t >= b.at && t < b.at + 45) rate *= D.bossBudgetScale;
  return rate;
}

export function updateDirector(w: World, dt: number): void {
  const D = CONFIG.director;
  const rng = w.dirRng;

  while (w.nextBoss < BOSSES.length && w.t >= BOSSES[w.nextBoss]!.at) {
    const a = rng.next() * TAU;
    const R = CONFIG.world.spawnRadius;
    spawnBoss(w, w.nextBoss, Math.cos(a) * R, Math.sin(a) * R);
    w.nextBoss++;
  }

  while (w.nextEvent < D.events.length && w.t >= D.events[w.nextEvent]!.at) {
    const e = D.events[w.nextEvent]!;
    w.nextEvent++;
    const R = CONFIG.world.spawnRadius;
    const base = rng.next() * TAU;
    w.events.push(Ev.Wave, Math.cos(base) * R, Math.sin(base) * R, e.kind === 'ring' ? 0 : 1, base);
    for (let i = 0; i < e.count; i++) {
      let a: number, r: number;
      if (e.kind === 'ring') {
        a = base + (i / e.count) * TAU;
        r = R - 40 + rng.next() * 20;
      } else {
        a = base + (rng.next() - 0.5) * D.floodArc;
        r = R + rng.next() * 160;
      }
      trySpawn(w, e.type, Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  w.budget += threatRate(w.t) * dt;
  for (let guard = 0; guard < 8; guard++) {
    if (w.dirPendingType < 0) {
      // roll the next purchase
      let total = 0;
      for (let k = 0; k < ENEMIES.length; k++) if (w.t >= ENEMIES[k]!.unlockAt) total += ENEMIES[k]!.weight;
      let r = rng.next() * total;
      let type = 0;
      for (let k = 0; k < ENEMIES.length; k++) {
        const d = ENEMIES[k]!;
        if (w.t < d.unlockAt || d.weight <= 0) continue;
        type = k;
        r -= d.weight;
        if (r < 0) break;
      }
      const d = ENEMIES[type]!;
      w.dirPendingType = type;
      w.dirPendingGroup = d.groupMin + Math.floor(rng.next() * (d.groupMax - d.groupMin + 1));
    }
    const d = ENEMIES[w.dirPendingType]!;
    const cost = d.cost * w.dirPendingGroup;
    if (w.budget < cost) break;
    w.budget -= cost;
    const a = rng.next() * TAU;
    const R = CONFIG.world.spawnRadius + rng.next() * 60;
    const cx = Math.cos(a) * R, cy = Math.sin(a) * R;
    for (let g = 0; g < w.dirPendingGroup; g++) {
      const jx = (rng.next() - 0.5) * 60, jy = (rng.next() - 0.5) * 60;
      trySpawn(w, w.dirPendingType as EnemyType, cx + jx, cy + jy);
    }
    w.dirPendingType = -1;
  }
}

function trySpawn(w: World, type: EnemyType, x: number, y: number): void {
  if (w.spawnLog) w.spawnLog.push(Math.round(w.t * 60), type, Math.round(x), Math.round(y));
  if (w.enemies.pool.count >= CONFIG.director.maxEnemies) return;
  spawnEnemy(w, type, x, y, 0);
}
