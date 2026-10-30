import { CONFIG } from '../data/config';
import { lerp, wrapAngle, TAU } from '../core/math';
import { EF_BURROWED, EF_LIT } from './stores';
import { DmgSrc, type World } from './world';
import { Ev } from './events';
import { damageEnemy, isShielded } from './enemies';

/** Beam table stride: angle, halfWidth, range, dps fraction, source. */
export const BEAM_STRIDE = 5;
export const MAX_BEAMS = 3;

export function mainHalfWidth(w: World, focus: number): number {
  const B = CONFIG.beam;
  return lerp(B.halfWidthWide, B.halfWidthNarrow, focus) * w.stats.beamWidthMult;
}

export function beamRange(w: World): number {
  return CONFIG.beam.range * w.stats.beamRangeMult;
}

function putBeam(w: World, angle: number, half: number, range: number, frac: number, src: DmgSrc): void {
  const o = w.beamCount * BEAM_STRIDE;
  const b = w.beams;
  b[o] = angle; b[o + 1] = half; b[o + 2] = range; b[o + 3] = frac; b[o + 4] = src;
  w.beamCount++;
}

/** Fill w.beams with the active beams for this tick; returns the count. */
export function computeBeams(w: World): number {
  const s = w.stats;
  const hw = Math.min(mainHalfWidth(w, w.focus), 1.35);
  const range = beamRange(w);
  w.beamCount = 0;
  putBeam(w, w.beamAngle, hw, range, 1, DmgSrc.Beam);
  if (s.secondBeam > 0) putBeam(w, wrapAngle(w.beamAngle + Math.PI), hw, range, s.secondBeam, DmgSrc.RearBeam);
  if (s.thirdBeam > 0) putBeam(w, w.sweepAngle, Math.min(mainHalfWidth(w, 0.5), 1.35), range, s.thirdBeam, DmgSrc.SweepBeam);
  return w.beamCount;
}

export function dronePosition(w: World, k: number, phase: number, out: { x: number; y: number }): void {
  const n = w.stats.drones;
  const a = phase + (k / n) * TAU;
  out.x = Math.cos(a) * w.stats.droneRadius;
  out.y = Math.sin(a) * w.stats.droneRadius;
}

function markLit(w: World, i: number): void {
  const E = w.enemies;
  if (!(E.flags[i]! & EF_LIT)) {
    E.flags[i]! |= EF_LIT;
    w.lit[w.litCount++] = i;
    const s = w.stats;
    if (s.burnDps > 0 && !isShielded(w, i)) {
      E.burnT[i] = s.burnTime;
      if (E.burnDps[i]! < s.burnDps) E.burnDps[i] = s.burnDps;
    }
  } else if (w.stats.burnDps > 0) {
    E.burnT[i] = w.stats.burnTime;
  }
}

const tmp = { x: 0, y: 0 };

/** Light + damage pass: beams (cone queries), the rock's glow, and lantern drones. */
export function beamPass(w: World, dt: number): void {
  const E = w.enemies;
  const B = CONFIG.beam;
  const s = w.stats;
  const hi = E.pool.hi;
  for (let i = 0; i < hi; i++) E.flags[i]! &= ~EF_LIT;
  w.litCount = 0;

  const n = computeBeams(w);
  const narrow = w.focus >= B.shieldFocus;
  const dpsFocus = lerp(B.dpsMultWide, B.dpsMultNarrow, w.focus);
  const q = w.q;
  const maxR = 72;
  for (let bi = 0; bi < n; bi++) {
    const o = bi * BEAM_STRIDE;
    const dir = w.beams[o]!, half = w.beams[o + 1]!, range = w.beams[o + 2]!, frac = w.beams[o + 3]!;
    const src = w.beams[o + 4]! as DmgSrc;
    const sweep = src === DmgSrc.SweepBeam;
    const dps = B.baseDps * s.beamDpsMult * frac * (sweep ? lerp(B.dpsMultWide, B.dpsMultNarrow, 0.5) : dpsFocus);
    const cnt = w.hash.queryCone(0, 0, dir, half, range, E.x, E.y, E.radius, maxR, q);
    for (let k = 0; k < cnt; k++) {
      const i = q[k]!;
      if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
      markLit(w, i);
      if (isShielded(w, i) && (sweep || !narrow)) {
        // visible feedback that the shield is deflecting a too-wide beam
        if ((w.tick + i) % 15 === 0) w.events.push(Ev.Hit, E.x[i]!, E.y[i]!, 0, 2);
        continue;
      }
      const x = E.x[i]!, y = E.y[i]!;
      const d = Math.sqrt(x * x + y * y);
      const t = d / range;
      let f = 1 - B.falloff * (t > 1 ? 1 : t * t);
      if (s.lensBonus > 0 && half > 0) {
        const off = Math.abs(wrapAngle(Math.atan2(y, x) - dir)) / half;
        f *= 1 + s.lensBonus * (off < 1 ? 1 - off : 0);
      }
      damageEnemy(w, i, dps * f * dt, src);
    }
  }

  // the main and rear beams burn enemy projectiles out of the air
  const P = w.projectiles;
  const burn = B.projectileBurnTime;
  for (let i = 0; i < P.pool.hi; i++) {
    if (!P.pool.alive[i] || !P.hostile[i]) continue;
    const x = P.x[i]!, y = P.y[i]!;
    const d = Math.sqrt(x * x + y * y);
    const ang = Math.atan2(y, x);
    let inBeam = false;
    for (let bi = 0; bi < n && !inBeam; bi++) {
      const o = bi * BEAM_STRIDE;
      if (w.beams[o + 4] === DmgSrc.SweepBeam) continue;
      inBeam = d <= w.beams[o + 2]! && Math.abs(wrapAngle(ang - w.beams[o]!)) <= w.beams[o + 1]!;
    }
    if (!inBeam) continue;
    P.heat[i]! += dt;
    if (P.heat[i]! >= burn) {
      w.events.push(Ev.ProjectileBurned, x, y);
      P.pool.free(i);
    }
  }

  // glow around the rock
  const gc = w.hash.queryCircle(0, 0, s.glowRadius, E.x, E.y, E.radius, maxR, q);
  for (let k = 0; k < gc; k++) {
    const i = q[k]!;
    if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
    markLit(w, i);
    if (s.glowDps > 0) damageEnemy(w, i, s.glowDps * dt, DmgSrc.Glow);
  }

  // lantern drones
  for (let k = 0; k < s.drones; k++) {
    dronePosition(w, k, w.dronePhase, tmp);
    const dc = w.hash.queryCircle(tmp.x, tmp.y, s.droneLight, E.x, E.y, E.radius, maxR, q);
    for (let m = 0; m < dc; m++) {
      const i = q[m]!;
      if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
      markLit(w, i);
      damageEnemy(w, i, s.droneDps * dt, DmgSrc.Drone);
    }
  }
}

/** Is a point lit by any beam, the glow, or a drone? (embers, rendering, tests) */
export function pointLit(w: World, x: number, y: number): boolean {
  const s = w.stats;
  const d2 = x * x + y * y;
  if (d2 <= s.glowRadius * s.glowRadius) return true;
  const d = Math.sqrt(d2);
  const ang = Math.atan2(y, x);
  for (let bi = 0; bi < w.beamCount; bi++) {
    const o = bi * BEAM_STRIDE;
    if (d <= w.beams[o + 2]! && Math.abs(wrapAngle(ang - w.beams[o]!)) <= w.beams[o + 1]!) return true;
  }
  for (let k = 0; k < s.drones; k++) {
    dronePosition(w, k, w.dronePhase, tmp);
    const dx = x - tmp.x, dy = y - tmp.y;
    if (dx * dx + dy * dy <= s.droneLight * s.droneLight) return true;
  }
  return false;
}
