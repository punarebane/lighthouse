import { CONFIG } from '../data/config';
import { Ev } from './events';
import { EF_BURROWED, EF_LIT, PK_HARPOON } from './stores';
import { DmgSrc, type World } from './world';
import { damageEnemy, hurtPlayer, isShielded } from './enemies';
import { dronePosition } from './beam';

export function spawnProjectile(
  w: World, kind: number, x: number, y: number, vx: number, vy: number,
  damage: number, radius: number, pierce: number, hostile: boolean, life: number,
): number {
  const P = w.projectiles;
  const i = P.pool.alloc();
  if (i < 0) return -1;
  P.x[i] = x; P.y[i] = y; P.px[i] = x; P.py[i] = y;
  P.vx[i] = vx; P.vy[i] = vy;
  P.damage[i] = damage; P.radius[i] = radius; P.pierce[i] = pierce;
  P.life[i] = life; P.kind[i] = kind; P.hostile[i] = hostile ? 1 : 0;
  P.lastHit[i] = -1;
  return i;
}

const MAXR = 72;
const nearIdx = new Int32Array(16);
const nearD = new Float32Array(16);
const visited = new Int32Array(32);
const tmp = { x: 0, y: 0 };

/** k nearest live, non-burrowed enemies to (x, y) within r. Results in nearIdx; returns count. */
function nearest(w: World, x: number, y: number, r: number, k: number, litOnly: boolean, skipShielded: boolean): number {
  const E = w.enemies;
  const n = w.hash.queryCircle(x, y, r, E.x, E.y, null, 0, w.q2);
  let m = 0;
  for (let a = 0; a < n; a++) {
    const i = w.q2[a]!;
    if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
    if (litOnly && !(E.flags[i]! & EF_LIT)) continue;
    if (skipShielded && isShielded(w, i)) continue;
    const dx = E.x[i]! - x, dy = E.y[i]! - y;
    const d = dx * dx + dy * dy;
    // insertion into the sorted top-k
    let p = m < k ? m++ : k;
    if (p === k && d >= nearD[k - 1]!) continue;
    if (p === k) p = k - 1;
    while (p > 0 && nearD[p - 1]! > d) {
      nearD[p] = nearD[p - 1]!;
      nearIdx[p] = nearIdx[p - 1]!;
      p--;
    }
    nearD[p] = d;
    nearIdx[p] = i;
  }
  return m;
}

function chainFrom(w: World, sx: number, sy: number, first: number, jumps: number): void {
  const E = w.enemies;
  const s = w.stats;
  let cur = first;
  let x0 = sx, y0 = sy;
  let nv = 0;
  for (let j = 0; j < jumps && cur >= 0; j++) {
    const x = E.x[cur]!, y = E.y[cur]!;
    w.events.push(Ev.Chain, x0, y0, x, y);
    visited[nv++] = cur;
    damageEnemy(w, cur, s.chainDamage, DmgSrc.Chain, true);
    x0 = x; y0 = y;
    if (nv >= visited.length) break;
    // nearest unvisited lit neighbour
    const n = w.hash.queryCircle(x, y, s.chainRange, E.x, E.y, null, 0, w.q2);
    let best = -1, bestD = 1e18;
    for (let a = 0; a < n; a++) {
      const i = w.q2[a]!;
      if (!E.pool.alive[i] || !(E.flags[i]! & EF_LIT) || isShielded(w, i)) continue;
      let seen = false;
      for (let v = 0; v < nv; v++) if (visited[v] === i) { seen = true; break; }
      if (seen) continue;
      const dx = E.x[i]! - x, dy = E.y[i]! - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    cur = best;
  }
}

export function updateWeapons(w: World, dt: number): void {
  const s = w.stats;
  const E = w.enemies;
  const W = CONFIG.weapons;

  // Flash: periodic nova stunning everything on screen
  if (s.flashCd > 0) {
    w.flashT += dt;
    if (w.flashT >= s.flashCd) {
      w.flashT = 0;
      w.events.push(Ev.Flash, 0, 0, s.wildfire ? 1 : 0);
      const R2 = 950 * 950;
      for (let i = 0; i < E.pool.hi; i++) {
        if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
        const x = E.x[i]!, y = E.y[i]!;
        if (x * x + y * y > R2) continue;
        const stun = E.type[i] === 7 ? s.flashStun * 0.3 : s.flashStun;
        if (E.stun[i]! < stun) E.stun[i] = stun;
        if (s.wildfire && !isShielded(w, i)) {
          E.burnT[i] = s.burnTime * 2;
          if (E.burnDps[i]! < s.burnDps) E.burnDps[i] = s.burnDps;
        }
        damageEnemy(w, i, s.flashDamage, DmgSrc.Flash, true);
      }
    }
  }

  // Harpoon turret
  if (s.harpoonCd > 0) {
    w.harpoonT += dt;
    if (w.harpoonT >= s.harpoonCd) {
      const n = nearest(w, 0, 0, 640, Math.min(s.harpoonCount, 16), false, true);
      if (n > 0) {
        w.harpoonT = 0;
        const rr = CONFIG.lighthouse.rockRadius;
        for (let k = 0; k < s.harpoonCount; k++) {
          const t = nearIdx[k % n]!;
          let a = Math.atan2(E.y[t]!, E.x[t]!);
          if (k >= n) a += ((k % 3) - 1) * 0.12;
          const cx = Math.cos(a), cy = Math.sin(a);
          spawnProjectile(w, PK_HARPOON, cx * rr, cy * rr, cx * W.harpoonSpeed, cy * W.harpoonSpeed,
            s.harpoonDamage, W.harpoonRadius, s.harpoonPierce, false, W.harpoonLife);
        }
        w.events.push(Ev.Harpoon, 0, 0);
      }
    }
  }

  // Chain lightning between lit enemies
  if (s.chainCd > 0) {
    w.chainT += dt;
    if (w.chainT >= s.chainCd && w.litCount > 0) {
      w.chainT = 0;
      // start at a random lit enemy that is still alive and unshielded
      for (let tries = 0; tries < 6; tries++) {
        const i = w.lit[w.rng.int(w.litCount)]!;
        if (E.pool.alive[i] && !isShielded(w, i)) {
          chainFrom(w, 0, 0, i, s.chainJumps);
          break;
        }
      }
    }
    if (s.thunderLanterns && s.drones > 0) {
      w.droneChainT += dt;
      if (w.droneChainT >= s.chainCd) {
        w.droneChainT = 0;
        for (let k = 0; k < s.drones; k++) {
          dronePosition(w, k, w.dronePhase, tmp);
          const n = nearest(w, tmp.x, tmp.y, s.chainRange, 1, false, true);
          if (n > 0) chainFrom(w, tmp.x, tmp.y, nearIdx[0]!, Math.ceil(s.chainJumps / 2));
        }
      }
    }
  }

  // Fog horn knockback pulse
  if (s.foghornCd > 0) {
    w.foghornT += dt;
    if (w.foghornT >= s.foghornCd) {
      w.foghornT = 0;
      w.events.push(Ev.Foghorn, 0, 0, s.foghornRadius);
      const R = s.foghornRadius;
      const n = w.hash.queryCircle(0, 0, R, E.x, E.y, E.radius, MAXR, w.q2);
      for (let k = 0; k < n; k++) {
        const i = w.q2[k]!;
        if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
        const x = E.x[i]!, y = E.y[i]!;
        const d = Math.sqrt(x * x + y * y) || 1;
        const resist = E.type[i] === 7 ? 1 - CONFIG.boss.knockbackResist : 1;
        const f = s.foghornForce * (1 - 0.5 * (d / R)) * resist;
        E.vx[i]! += (x / d) * f;
        E.vy[i]! += (y / d) * f;
        damageEnemy(w, i, s.foghornDamage, DmgSrc.Foghorn, true);
      }
      const P = w.projectiles;
      for (let i = 0; i < P.pool.hi; i++) {
        if (!P.pool.alive[i] || !P.hostile[i]) continue;
        const x = P.x[i]!, y = P.y[i]!;
        if (x * x + y * y <= R * R) P.pool.free(i);
      }
    }
  }
}

export function updateProjectiles(w: World, dt: number): void {
  const P = w.projectiles;
  const E = w.enemies;
  const rr = CONFIG.lighthouse.rockRadius;
  for (let i = 0; i < P.pool.hi; i++) {
    if (!P.pool.alive[i]) continue;
    P.life[i]! -= dt;
    if (P.life[i]! <= 0) { P.pool.free(i); continue; }
    const x = (P.x[i] = P.x[i]! + P.vx[i]! * dt);
    const y = (P.y[i] = P.y[i]! + P.vy[i]! * dt);
    if (P.hostile[i]) {
      const reach = rr + P.radius[i]!;
      if (x * x + y * y <= reach * reach) {
        hurtPlayer(w, P.damage[i]!, 8);
        P.pool.free(i);
      }
      continue;
    }
    const n = w.hash.queryCircle(x, y, P.radius[i]!, E.x, E.y, E.radius, MAXR, w.q2);
    for (let k = 0; k < n; k++) {
      const j = w.q2[k]!;
      if (!E.pool.alive[j] || (E.flags[j]! & EF_BURROWED) || j === P.lastHit[i]) continue;
      if (isShielded(w, j)) {
        // harpoons bounce off shields
        w.events.push(Ev.Hit, x, y, 0, 2);
        P.pool.free(i);
        break;
      }
      P.lastHit[i] = j;
      damageEnemy(w, j, P.damage[i]!, DmgSrc.Harpoon, true);
      if (w.stats.ballista) explode(w, x, y, 55, P.damage[i]! * 0.5);
      if (--P.pierce[i]! < 0) { P.pool.free(i); break; }
    }
  }
}

function explode(w: World, x: number, y: number, r: number, dmg: number): void {
  const E = w.enemies;
  w.events.push(Ev.Explosion, x, y, r);
  const n = w.hash.queryCircle(x, y, r, E.x, E.y, E.radius, MAXR, w.q);
  for (let k = 0; k < n; k++) damageEnemy(w, w.q[k]!, dmg, DmgSrc.Harpoon, true);
}
