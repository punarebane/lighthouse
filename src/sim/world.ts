import { CONFIG, ENEMY_TYPE_COUNT } from '../data/config';
import { UPGRADES, EVOLUTIONS } from '../data/upgrades';
import { META } from '../data/meta';
import { Rng, deriveSeed } from '../core/rng';
import { SpatialHash } from '../core/spatialHash';
import { EnemyStore, ProjectileStore, EmberStore } from './stores';
import { EventQueue } from './events';
import { baseStats, type Stats } from './stats';

export enum RunState { Running, Dead, Won }

export enum DmgSrc { Beam, RearBeam, SweepBeam, Flash, Harpoon, Chain, Burn, Drone, Foghorn, Glow, Count }
export const DMG_SRC_NAMES = ['Main beam', 'Rear beam', 'Sweeping beam', 'Flash', 'Harpoon', 'Chain lightning', 'Burn', 'Drones', 'Fog horn', 'Hearth glow'];

/** Offer encoding: 0..19 upgrade index, 100+k evolution k, OFFER_HEAL heal. */
export const OFFER_EVO = 100;
export const OFFER_HEAL = 200;

export interface SimInput {
  /** 0: rotate toward targetAngle at rotSpeed; 1: rotate by `turn` (-1..1) * rotSpeed */
  aimMode: 0 | 1;
  targetAngle: number;
  turn: number;
  /** focus change requested this tick (already scaled) */
  focusDelta: number;
  /** if >= 0, move focus toward this value (bot) */
  focusTarget: number;
}

export function makeInput(): SimInput {
  return { aimMode: 1, targetAngle: 0, turn: 0, focusDelta: 0, focusTarget: -1 };
}

export interface WorldOptions {
  seed: number;
  meta?: number[];
  bench?: number; // >0: benchmark mode with this many enemies
  /** disable director (tests) */
  noDirector?: boolean;
}

export class World {
  readonly seed: number;
  readonly bench: number;
  readonly noDirector: boolean;
  readonly enemies: EnemyStore;
  readonly projectiles: ProjectileStore;
  readonly embers: EmberStore;
  readonly hash: SpatialHash;
  readonly events = new EventQueue();
  readonly dirRng: Rng;
  readonly rng: Rng;
  /** scratch buffers for queries */
  readonly q: Int32Array;
  readonly q2: Int32Array;
  readonly lit: Int32Array;
  litCount = 0;
  /** active beams this tick (see beam.ts BEAM_STRIDE) */
  readonly beams = new Float32Array(15);
  beamCount = 0;

  state = RunState.Running;
  t = 0;
  tick = 0;
  hp: number;
  beamAngle = -Math.PI / 2;
  prevBeamAngle = -Math.PI / 2;
  focus: number = CONFIG.beam.focusStart;
  sweepAngle = Math.PI / 2;
  prevSweepAngle = Math.PI / 2;
  dronePhase = 0;
  prevDronePhase = 0;
  hurtT = 0;

  level = 1;
  xp = 0;
  xpNext: number;
  pendingLevels = 0;
  readonly offers = new Int16Array(CONFIG.levels.offerCount).fill(-1);
  offersReady = false;
  readonly upgradeLevels = new Int8Array(UPGRADES.length);
  readonly evolved = new Uint8Array(EVOLUTIONS.length);
  readonly pickCounts = new Int32Array(UPGRADES.length + EVOLUTIONS.length);
  readonly meta: number[];
  stats: Stats;

  flashT = 0;
  harpoonT = 0;
  chainT = 0;
  foghornT = 0;
  droneChainT = 0;

  // director
  budget = 0;
  dirPendingType = -1;
  dirPendingGroup = 0;
  nextEvent = 0;
  nextBoss = 0;
  bossAlive = 0;
  bossIndex = -1; // enemy slot of the current boss (most recent)

  // stats for the run summary
  kills = 0;
  readonly killsByType = new Int32Array(ENEMY_TYPE_COUNT);
  readonly damageBySource = new Float64Array(DmgSrc.Count);
  damageTaken = 0;
  embersCollected = 0;
  bossesKilled = 0;
  peakEnemies = 0;
  slowmo = 0;
  /** if set, the director appends [tick, type, x, y] for every spawn roll (tests) */
  spawnLog: number[] | null = null;

  constructor(opts: WorldOptions) {
    const C = CONFIG.capacity;
    this.seed = opts.seed >>> 0;
    this.bench = opts.bench ?? 0;
    this.noDirector = !!opts.noDirector || this.bench > 0;
    this.meta = opts.meta ?? META.map(() => 0);
    this.enemies = new EnemyStore(Math.max(C.enemies, this.bench + 512));
    this.projectiles = new ProjectileStore(C.projectiles);
    this.embers = new EmberStore(C.embers);
    this.hash = new SpatialHash(CONFIG.world.half, CONFIG.world.cellSize, this.enemies.pool.cap);
    this.q = new Int32Array(Math.max(C.query, this.enemies.pool.cap));
    this.q2 = new Int32Array(Math.max(C.query, this.enemies.pool.cap));
    this.lit = new Int32Array(this.enemies.pool.cap);
    this.dirRng = new Rng(deriveSeed(this.seed, 1));
    this.rng = new Rng(deriveSeed(this.seed, 2));
    this.stats = computeStats(this);
    this.hp = this.stats.hpMax;
    this.xpNext = xpForLevel(1);
    this.budget = CONFIG.director.startBudget;
  }
}

export function xpForLevel(level: number): number {
  const L = CONFIG.levels;
  return Math.round(L.base + L.growth * Math.pow(level - 1, L.exp));
}

export function computeStats(w: World): Stats {
  const s = baseStats();
  for (let i = 0; i < META.length; i++) {
    const r = w.meta[i] ?? 0;
    if (r > 0) META[i]!.apply(s, r);
  }
  for (let i = 0; i < UPGRADES.length; i++) {
    const l = w.upgradeLevels[i]!;
    if (l > 0) UPGRADES[i]!.apply(s, l);
  }
  for (let i = 0; i < EVOLUTIONS.length; i++) if (w.evolved[i]) EVOLUTIONS[i]!.apply(s);
  return s;
}

export function refreshStats(w: World): void {
  const oldMax = w.stats.hpMax;
  w.stats = computeStats(w);
  if (w.stats.hpMax > oldMax) w.hp += w.stats.hpMax - oldMax;
  if (w.hp > w.stats.hpMax) w.hp = w.stats.hpMax;
}

/** Available evolutions: both required upgrades maxed and not yet evolved. */
export function evolutionReady(w: World, k: number): boolean {
  if (w.evolved[k]) return false;
  const e = EVOLUTIONS[k]!;
  for (const id of e.requires) {
    const i = UPGRADES.findIndex((u) => u.id === id);
    if (w.upgradeLevels[i]! < UPGRADES[i]!.maxLevel) return false;
  }
  return true;
}

/** Roll a fresh set of offers (called once per level-up; allocation here is fine). */
export function rollOffers(w: World): void {
  const n = w.offers.length;
  w.offers.fill(-1);
  let k = 0;
  for (let e = 0; e < EVOLUTIONS.length && k < n; e++) if (evolutionReady(w, e)) w.offers[k++] = OFFER_EVO + e;
  const pool: number[] = [];
  const weights: number[] = [];
  for (let i = 0; i < UPGRADES.length; i++) {
    if (w.upgradeLevels[i]! < UPGRADES[i]!.maxLevel) {
      pool.push(i);
      // owned upgrades are a little more likely so builds can complete
      weights.push(UPGRADES[i]!.weight * (w.upgradeLevels[i]! > 0 ? 1.5 : 1));
    }
  }
  while (k < n && pool.length > 0) {
    let total = 0;
    for (const x of weights) total += x;
    let r = w.rng.next() * total;
    let j = 0;
    for (; j < pool.length - 1; j++) {
      r -= weights[j]!;
      if (r < 0) break;
    }
    w.offers[k++] = pool[j]!;
    pool.splice(j, 1);
    weights.splice(j, 1);
  }
  if (k === 0) w.offers[k++] = OFFER_HEAL;
  w.offersReady = true;
}

export function applyOffer(w: World, offer: number): void {
  if (offer >= OFFER_HEAL) {
    w.hp = Math.min(w.stats.hpMax, w.hp + w.stats.hpMax * CONFIG.levels.healFraction);
  } else if (offer >= OFFER_EVO) {
    const e = offer - OFFER_EVO;
    w.evolved[e] = 1;
    w.pickCounts[UPGRADES.length + e]!++;
  } else if (offer >= 0) {
    w.upgradeLevels[offer]!++;
    w.pickCounts[offer]!++;
  }
  refreshStats(w);
  w.pendingLevels--;
  w.offersReady = false;
  w.offers.fill(-1);
}
