import { CONFIG, ENEMIES, BOSSES, EnemyType } from '../data/config';
import { curve, TAU } from '../core/math';
import { Ev } from './events';
import { EF_BURROWED, EF_CHARGING, EF_LIT, EF_NOXP, EF_SHIELDED, PK_INK, PK_ORB, PK_SPIT } from './stores';
import { DmgSrc, RunState, type World } from './world';
import { spawnEmber } from './embers';
import { spawnProjectile } from './weapons';

export function spawnEnemy(w: World, type: EnemyType, x: number, y: number, gen: number): number {
  const E = w.enemies;
  const i = E.pool.alloc();
  if (i < 0) return -1;
  const d = ENEMIES[type]!;
  const AI = CONFIG.enemyAI;
  const hpScale = w.bench ? 1 : curve(CONFIG.director.hpCurve, w.t);
  let hp = d.hp * hpScale;
  let r = d.radius;
  if (type === EnemyType.Jelly && gen > 0) {
    hp *= Math.pow(AI.jellyGenHpScale, gen);
    r *= Math.pow(AI.jellyGenRadiusScale, gen);
  }
  E.x[i] = x; E.y[i] = y; E.px[i] = x; E.py[i] = y;
  E.vx[i] = 0; E.vy[i] = 0;
  E.hp[i] = hp; E.maxHp[i] = hp;
  E.radius[i] = r;
  E.speed[i] = d.speed * (type === EnemyType.Jelly && gen > 0 ? 1 + 0.25 * gen : 1);
  E.stun[i] = 0; E.burnT[i] = 0; E.burnDps[i] = 0; E.flash[i] = 0;
  E.timer[i] = type === EnemyType.Spitter ? AI.spitterFireCd * 0.5 : 0;
  E.timer2[i] = 0; E.dmgAcc[i] = 0; E.dmgT[i] = 0; E.age[i] = 0;
  E.phase[i] = w.rng.next() * TAU;
  E.type[i] = type;
  E.gen[i] = gen;
  E.flags[i] = type === EnemyType.Burrower ? EF_BURROWED : 0;
  E.shield[i] = E.shieldMax[i] = type === EnemyType.Ship ? CONFIG.beam.shipShield * hpScale : 0;
  if (!(w.seenTypes & (1 << type))) {
    w.seenTypes |= 1 << type;
    w.events.push(Ev.FirstSeen, x, y, type);
  }
  return i;
}

export function spawnBoss(w: World, variant: number, x: number, y: number): number {
  const E = w.enemies;
  const b = BOSSES[variant]!;
  const i = spawnEnemy(w, EnemyType.Boss, x, y, variant);
  if (i < 0) return -1;
  E.hp[i] = b.hp; E.maxHp[i] = b.hp;
  E.radius[i] = b.radius;
  E.speed[i] = b.speed;
  E.timer[i] = variant === 0 ? CONFIG.boss.leviathanChargeCd : 2;
  E.timer2[i] = 0;
  w.bossAlive++;
  w.bossIndex = i;
  w.events.push(Ev.BossSpawn, x, y, variant);
  return i;
}

export function isShielded(w: World, i: number): boolean {
  return w.enemies.shield[i]! > 0 || (w.enemies.flags[i]! & EF_SHIELDED) !== 0;
}

/**
 * Apply damage. Shielded targets only take beam damage (and the caller checks focus).
 * `instant` emits the damage number now instead of accumulating it.
 */
export function damageEnemy(w: World, i: number, amount: number, src: DmgSrc, instant = false): void {
  const E = w.enemies;
  if (!E.pool.alive[i]) return;
  if (E.flags[i]! & EF_BURROWED) return;
  if (src !== DmgSrc.Beam && src !== DmgSrc.RearBeam && isShielded(w, i)) return;
  const hp = E.hp[i]!;
  const dealt = amount < hp ? amount : hp;
  E.hp[i] = hp - amount;
  w.damageBySource[src]! += dealt;
  E.dmgAcc[i]! += amount;
  if (instant) {
    w.events.push(Ev.Hit, E.x[i]!, E.y[i]! - E.radius[i]!, E.dmgAcc[i]!, 1);
    E.dmgAcc[i] = 0;
    E.dmgT[i] = 0;
    E.flash[i] = CONFIG.juice.hitFlashTime;
  }
  if (E.hp[i]! <= 0) killEnemy(w, i, true);
}

export function killEnemy(w: World, i: number, drop: boolean): void {
  const E = w.enemies;
  if (!E.pool.alive[i]) return;
  const type = E.type[i]! as EnemyType;
  const x = E.x[i]!, y = E.y[i]!, r = E.radius[i]!;
  const AI = CONFIG.enemyAI;
  if (E.dmgAcc[i]! > 0.5) w.events.push(Ev.Hit, x, y - r, E.dmgAcc[i]!, 0);
  E.pool.free(i);
  if (drop) {
    w.kills++;
    w.killsByType[type]!++;
  }
  w.events.push(Ev.Kill, x, y, type, r);

  if (type === EnemyType.Boss) {
    const variant = E.gen[i]!;
    w.bossAlive--;
    if (drop) {
      w.bossesKilled++;
      w.events.push(Ev.BossKill, x, y, variant);
      w.slowmo = CONFIG.juice.bossKillSlowmoTime;
      const b = BOSSES[variant]!;
      for (let k = 0; k < 24 && b.xp > 0; k++) {
        const a = (k / 24) * TAU;
        spawnEmber(w, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, b.xp / 24);
      }
      if (variant === BOSSES.length - 1 && !w.bench) {
        w.state = RunState.Won;
        w.events.push(Ev.Victory, x, y);
      }
    }
    return;
  }

  if (drop && !(E.flags[i]! & EF_NOXP)) spawnEmber(w, x, y, ENEMIES[type]!.xp);

  if (type === EnemyType.Jelly && E.gen[i]! < AI.jellyMaxGen && drop) {
    const g = E.gen[i]! + 1;
    w.events.push(Ev.Split, x, y, r);
    for (let k = 0; k < AI.jellySplitCount; k++) {
      const a = w.rng.next() * TAU;
      const j = spawnEnemy(w, EnemyType.Jelly, x + Math.cos(a) * r, y + Math.sin(a) * r, g);
      if (j >= 0) {
        E.vx[j] = Math.cos(a) * 90;
        E.vy[j] = Math.sin(a) * 90;
      }
    }
  }

  if (w.bench && w.enemies.pool.count < w.bench) respawnBench(w);
}

export function respawnBench(w: World): void {
  const a = w.rng.next() * TAU;
  const R = 300 + w.rng.next() * 700;
  const type = w.rng.int(7) as EnemyType;
  spawnEnemy(w, type, Math.cos(a) * R, Math.sin(a) * R, 0);
}

export function hurtPlayer(w: World, amount: number, src: number, continuous = false): void {
  if (w.bench || w.state !== RunState.Running) return;
  const dmg = amount * (1 - w.stats.armour);
  w.hp -= dmg;
  w.damageTaken += dmg;
  w.damageTakenBy[src]! += dmg;
  if (!continuous || w.hurtT <= 0) {
    w.events.push(Ev.Hurt, 0, 0, dmg);
    w.hurtT = 0.3;
  }
  if (w.hp <= 0) {
    w.hp = 0;
    w.state = RunState.Dead;
    w.events.push(Ev.Death, 0, 0);
  }
}

/** Movement, AI, status effects, separation and rock contact for every live enemy. */
const SEP_SCAN = 24;

export function updateEnemies(w: World, dt: number): void {
  const E = w.enemies;
  const AI = CONFIG.enemyAI;
  const B = CONFIG.boss;
  const rockR = CONFIG.lighthouse.rockRadius;
  const bound = CONFIG.world.bound;
  const hash = w.hash;
  const dim = hash.dim;
  const sepForce = AI.separationForce;
  const knockDecay = Math.exp(-AI.knockDrag * dt);
  const frost = w.stats.frost;
  const numInterval = CONFIG.damageNumbers.interval;
  const hi = E.pool.hi;
  const alive = E.pool.alive;

  for (let i = 0; i < hi; i++) {
    if (!alive[i]) continue;
    const type = E.type[i]!;
    E.age[i]! += dt;
    if (E.flash[i]! > 0) E.flash[i]! -= dt;

    // burning
    if (E.burnT[i]! > 0) {
      E.burnT[i]! -= dt;
      damageEnemy(w, i, E.burnDps[i]! * dt, DmgSrc.Burn);
      if (!alive[i]) continue;
    }
    // pooled damage numbers for continuous damage
    E.dmgT[i]! += dt;
    if (E.dmgT[i]! >= numInterval) {
      if (E.dmgAcc[i]! >= 0.5) {
        w.events.push(Ev.Hit, E.x[i]!, E.y[i]! - E.radius[i]!, E.dmgAcc[i]!, 0);
        E.flash[i] = CONFIG.juice.hitFlashTime;
      }
      E.dmgAcc[i] = 0;
      E.dmgT[i] = 0;
    }

    const x = E.x[i]!, y = E.y[i]!;
    const d = Math.sqrt(x * x + y * y) || 1;
    const nx = -x / d, ny = -y / d; // toward rock
    let speed = E.speed[i]!;
    if (E.flags[i]! & EF_LIT) speed *= 1 - frost;
    let mvx = nx, mvy = ny;
    const stunned = E.stun[i]! > 0;
    if (stunned) {
      E.stun[i]! -= dt;
      speed = 0;
    }

    switch (type) {
      case EnemyType.Eel: {
        const s = Math.sin(E.age[i]! * AI.eelWeaveFreq + E.phase[i]!) * AI.eelWeaveAmp;
        mvx = nx - ny * s;
        mvy = ny + nx * s;
        const l = Math.sqrt(mvx * mvx + mvy * mvy);
        mvx /= l; mvy /= l;
        break;
      }
      case EnemyType.Spitter: {
        if (d < AI.spitterHoldRange) {
          speed = 0;
          if (!stunned) {
            E.timer[i]! -= dt;
            if (E.timer[i]! <= 0) {
              E.timer[i] = AI.spitterFireCd;
              spawnProjectile(w, PK_SPIT, x, y, nx * AI.spitSpeed, ny * AI.spitSpeed, AI.spitDamage, 5, 0, true, 6);
              w.events.push(Ev.Spit, x, y);
            }
          }
        }
        break;
      }
      case EnemyType.Burrower: {
        if (E.flags[i]! & EF_BURROWED) {
          speed *= AI.burrowSpeedMult;
          if (d < AI.burrowRevealRadius) {
            E.flags[i]! &= ~EF_BURROWED;
            w.events.push(Ev.Surface, x, y);
          }
        }
        break;
      }
      case EnemyType.Boss:
        if (!stunned) {
          const v = bossAI(w, i, d, nx, ny, dt);
          speed *= v;
          if (E.gen[i] === 1 && d < B.krakenOrbitRadius) {
            // orbit: tangential with a gentle pull to the orbit radius
            const pull = (d - B.krakenOrbitRadius) / 60;
            mvx = -ny + nx * pull;
            mvy = nx + ny * pull;
            const l = Math.sqrt(mvx * mvx + mvy * mvy);
            mvx /= l; mvy /= l;
          }
        }
        break;
    }

    let vx = mvx * speed + E.vx[i]!;
    let vy = mvy * speed + E.vy[i]!;
    E.vx[i]! *= type === EnemyType.Boss ? knockDecay * 0.5 : knockDecay;
    E.vy[i]! *= type === EnemyType.Boss ? knockDecay * 0.5 : knockDecay;

    // boids-style separation from neighbours in the 3x3 cell block
    if (type !== EnemyType.Boss && !(E.flags[i]! & EF_BURROWED)) {
      const ri = E.radius[i]!;
      const cx = hash.cellCoord(x), cy = hash.cellCoord(y);
      // scan at most SEP_SCAN candidates so dense crowds stay O(n)
      let scanned = 0;
      let sx = 0, sy = 0;
      for (let oy = -1; oy <= 1 && scanned < SEP_SCAN; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= dim) continue;
        for (let ox = -1; ox <= 1 && scanned < SEP_SCAN; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= dim) continue;
          const c = yy * dim + xx;
          const end = hash.cellStart[c + 1]!;
          for (let k = hash.cellStart[c]!; k < end && scanned < SEP_SCAN; k++) {
            const j = hash.items[k]!;
            if (j === i) continue;
            scanned++;
            if (!alive[j] || (E.flags[j]! & EF_BURROWED)) continue;
            const dx = x - E.x[j]!, dy = y - E.y[j]!;
            const min = ri + E.radius[j]!;
            const d2 = dx * dx + dy * dy;
            if (d2 < min * min && d2 > 1e-4) {
              const dd = Math.sqrt(d2);
              const push = (min - dd) / min;
              sx += (dx / dd) * push;
              sy += (dy / dd) * push;
            }
          }
        }
      }
      vx += sx * sepForce;
      vy += sy * sepForce;
    }

    let nxp = x + vx * dt, nyp = y + vy * dt;
    if (nxp > bound) nxp = bound; else if (nxp < -bound) nxp = -bound;
    if (nyp > bound) nyp = bound; else if (nyp < -bound) nyp = -bound;
    E.x[i] = nxp;
    E.y[i] = nyp;

    // rock contact
    const r = E.radius[i]!;
    const nd2 = nxp * nxp + nyp * nyp;
    const reach = rockR + r;
    if (nd2 <= reach * reach && !(E.flags[i]! & EF_BURROWED && d > reach + 4)) {
      if (type === EnemyType.Boss) {
        const nd = Math.sqrt(nd2) || 1;
        E.x[i] = (nxp / nd) * reach;
        E.y[i] = (nyp / nd) * reach;
        hurtPlayer(w, BOSSES[E.gen[i]!]!.contactDps * dt, EnemyType.Boss, true);
      } else if (w.bench) {
        // benchmark: recycle to the outer ring instead of hurting
        const a = E.phase[i]! + E.age[i]!;
        E.x[i] = E.px[i] = Math.cos(a) * 1000;
        E.y[i] = E.py[i] = Math.sin(a) * 1000;
        E.flags[i]! &= ~EF_BURROWED;
      } else {
        hurtPlayer(w, ENEMIES[type]!.contactDamage, type);
        E.flags[i]! |= EF_NOXP;
        killEnemy(w, i, false);
      }
    }
  }
}

/** Boss behaviours. Returns a speed multiplier. */
function bossAI(w: World, i: number, d: number, nx: number, ny: number, dt: number): number {
  const E = w.enemies;
  const B = CONFIG.boss;
  const x = E.x[i]!, y = E.y[i]!;
  const variant = E.gen[i]!;
  E.timer[i]! -= dt;
  if (variant === 0) {
    // Leviathan: periodic charges
    if (E.flags[i]! & EF_CHARGING) {
      E.timer2[i]! -= dt;
      if (E.timer2[i]! <= 0) E.flags[i]! &= ~EF_CHARGING;
      return B.leviathanChargeSpeed / E.speed[i]!;
    }
    if (E.timer[i]! <= 0) {
      E.timer[i] = B.leviathanChargeCd;
      E.timer2[i] = B.leviathanChargeTime;
      E.flags[i]! |= EF_CHARGING;
      w.events.push(Ev.BossAttack, x, y, 0);
    }
    return 1;
  }
  if (variant === 1) {
    // Kraken: orbits, summons swarmers, throws ink
    E.timer2[i]! -= dt;
    if (E.timer[i]! <= 0) {
      E.timer[i] = B.krakenSummonCd;
      w.events.push(Ev.BossAttack, x, y, 1);
      for (let k = 0; k < B.krakenSummonCount; k++) {
        const a = (k / B.krakenSummonCount) * TAU;
        spawnEnemy(w, EnemyType.Swarmer, x + Math.cos(a) * 70, y + Math.sin(a) * 70, 0);
      }
    }
    if (E.timer2[i]! <= 0) {
      E.timer2[i] = B.krakenInkCd;
      spawnProjectile(w, PK_INK, x, y, nx * 170, ny * 170, 9, 9, 0, true, 6);
      w.events.push(Ev.Spit, x, y);
    }
    return 1;
  }
  // Drowned Maw: fans of orbs, summons eels, shield phases
  E.timer2[i]! += dt;
  const cyc = E.timer2[i]! % B.mawShieldCycle;
  if (cyc > B.mawShieldCycle - B.mawShieldTime) E.flags[i]! |= EF_SHIELDED;
  else E.flags[i]! &= ~EF_SHIELDED;
  if (E.timer[i]! <= 0) {
    E.timer[i] = B.mawRingCd;
    w.events.push(Ev.BossAttack, x, y, 2);
    const base = Math.atan2(ny, nx);
    for (let k = 0; k < B.mawRingCount; k++) {
      const a = base + ((k / (B.mawRingCount - 1)) - 0.5) * 1.6;
      spawnProjectile(w, PK_ORB, x + nx * 50, y + ny * 50, Math.cos(a) * 140, Math.sin(a) * 140, 7, 8, 0, true, 7);
    }
    if (Math.floor(E.timer2[i]! / B.mawSummonCd) % 2 === 0) {
      for (let k = 0; k < 4; k++) {
        const a = base + Math.PI + (k - 1.5) * 0.5;
        spawnEnemy(w, EnemyType.Eel, x + Math.cos(a) * 90, y + Math.sin(a) * 90, 0);
      }
    }
  }
  return 1;
}
