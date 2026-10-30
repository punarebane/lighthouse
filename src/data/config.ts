/** All tuning values live here. Units: world units (wu), seconds, radians. */

export enum EnemyType {
  Swarmer = 0,
  Crab = 1,
  Eel = 2,
  Jelly = 3,
  Ship = 4,
  Spitter = 5,
  Burrower = 6,
  Boss = 7,
}
export const ENEMY_TYPE_COUNT = 8;

export interface EnemyDef {
  name: string;
  hp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  xp: number;
  /** threat-budget cost for the director */
  cost: number;
  /** seconds into the run before the director may buy this type */
  unlockAt: number;
  /** relative pick weight once unlocked */
  weight: number;
  /** spawn this many together in a clump */
  groupMin: number;
  groupMax: number;
  mass: number;
}

export const ENEMIES: EnemyDef[] = [
  { name: 'Swarmer', hp: 11, speed: 52, radius: 8, contactDamage: 3, xp: 1, cost: 1, unlockAt: 0, weight: 10, groupMin: 3, groupMax: 6, mass: 1 },
  { name: 'Crab', hp: 85, speed: 25, radius: 16, contactDamage: 11, xp: 5, cost: 6, unlockAt: 80, weight: 3, groupMin: 1, groupMax: 2, mass: 4 },
  { name: 'Eel', hp: 20, speed: 105, radius: 9, contactDamage: 5, xp: 2, cost: 2.5, unlockAt: 40, weight: 5, groupMin: 2, groupMax: 3, mass: 1 },
  { name: 'Jelly', hp: 42, speed: 33, radius: 14, contactDamage: 6, xp: 2, cost: 5, unlockAt: 140, weight: 3, groupMin: 1, groupMax: 2, mass: 2 },
  { name: 'Ship', hp: 110, speed: 36, radius: 15, contactDamage: 14, xp: 7, cost: 9, unlockAt: 250, weight: 2, groupMin: 1, groupMax: 1, mass: 5 },
  { name: 'Spitter', hp: 36, speed: 44, radius: 12, contactDamage: 5, xp: 3, cost: 5, unlockAt: 190, weight: 3, groupMin: 1, groupMax: 2, mass: 2 },
  { name: 'Burrower', hp: 48, speed: 58, radius: 12, contactDamage: 10, xp: 4, cost: 5, unlockAt: 320, weight: 3, groupMin: 1, groupMax: 3, mass: 2 },
  { name: 'Boss', hp: 1, speed: 20, radius: 56, contactDamage: 0, xp: 60, cost: 0, unlockAt: 1e9, weight: 0, groupMin: 1, groupMax: 1, mass: 1000 },
];

export interface BossDef {
  name: string;
  at: number; // seconds into the run
  hp: number;
  speed: number;
  radius: number;
  /** contact damage per second while touching the rock */
  contactDps: number;
  xp: number;
  coins: number;
}

export const BOSSES: BossDef[] = [
  { name: 'The Leviathan', at: 300, hp: 2600, speed: 16, radius: 52, contactDps: 14, xp: 80, coins: 40 },
  { name: 'The Kraken', at: 600, hp: 11000, speed: 18, radius: 60, contactDps: 35, xp: 160, coins: 80 },
  { name: 'The Drowned Maw', at: 900, hp: 20000, speed: 14, radius: 70, contactDps: 40, xp: 0, coins: 150 },
];

export const CONFIG = {
  sim: {
    dt: 1 / 60,
    /** max sim steps per render frame before we drop time (spiral-of-death guard) */
    maxStepsPerFrame: 8,
    runLength: 900,
  },
  world: {
    /** spatial hash covers [-half, half]^2 */
    half: 1088,
    cellSize: 64,
    spawnRadius: 820,
    /** camera fits a circle of this radius into the shorter screen half-dimension */
    viewRadius: 560,
    /** positions are clamped to this box */
    bound: 1080,
  },
  capacity: {
    enemies: 6000,
    projectiles: 1024,
    embers: 3000,
    damageNumbers: 256,
    events: 2048,
    query: 8192,
  },
  lighthouse: {
    hp: 100,
    rockRadius: 34,
    glowRadius: 92,
    /** rad/s */
    rotSpeed: 3.2,
    /** after taking contact damage */
    invulnTime: 0.0,
  },
  beam: {
    /** focus 0 = wide, 1 = narrow */
    focusStart: 0.45,
    /** focus units per second when held (keys/triggers) */
    focusRate: 1.4,
    /** focus step per mouse wheel notch */
    focusWheelStep: 0.1,
    halfWidthWide: 0.62,
    halfWidthNarrow: 0.11,
    dpsMultWide: 0.5,
    dpsMultNarrow: 2.0,
    baseDps: 32,
    range: 380,
    falloff: 0.55,
    /** shielded ships take beam damage only when focus >= this */
    shieldFocus: 0.65,
    /** seconds an enemy projectile survives inside the main/rear beam */
    projectileBurnTime: 0.12,
    /** fraction of the main beam's dps the second beam has per level */
    lowHpFlicker: 0.3,
  },
  embers: {
    /** wu/s^2 toward the rock while lit */
    accel: 900,
    maxSpeed: 520,
    drag: 2.5,
    pickupRadius: 40,
    /** auto-collect embers within this radius even if unlit (they sit in the rock's glow) */
    lifetime: 90,
  },
  levels: {
    /** xp needed for level n -> n+1 = base + growth * (n-1)^exp */
    base: 3,
    growth: 3.4,
    exp: 1.38,
    offerCount: 3,
    /** fallback card when everything is maxed */
    healFraction: 0.3,
  },
  director: {
    /** [seconds, threat points per second]; drops to 0 at 15:00 so dawn is a duel with the Maw */
    threatCurve: [
      [0, 1.6], [60, 3.4], [180, 7.5], [300, 11], [420, 17.5], [600, 27], [780, 46], [899, 58], [900, 0],
    ] as Array<[number, number]>,
    /** budget multiplier while a boss is alive */
    bossBudgetScale: 0.45,
    /** budget the director starts with, so the first group shows up immediately */
    startBudget: 6,
    /** hp multiplier ramps over time: [seconds, mult] */
    hpCurve: [[0, 1], [300, 1.6], [600, 3.1], [780, 4.4], [900, 5.8]] as Array<[number, number]>,
    maxEnemies: 900,
    events: [
      { at: 125, kind: 'ring', type: EnemyType.Swarmer, count: 36 },
      { at: 245, kind: 'flood', type: EnemyType.Eel, count: 40 },
      { at: 420, kind: 'ring', type: EnemyType.Eel, count: 44 },
      { at: 520, kind: 'flood', type: EnemyType.Swarmer, count: 90 },
      { at: 700, kind: 'ring', type: EnemyType.Jelly, count: 24 },
      { at: 820, kind: 'flood', type: EnemyType.Crab, count: 30 },
    ] as Array<{ at: number; kind: 'ring' | 'flood'; type: EnemyType; count: number }>,
    floodArc: 0.9,
  },
  enemyAI: {
    separationRadius: 22,
    separationForce: 260,
    eelWeaveAmp: 0.8,
    eelWeaveFreq: 3.2,
    jellySplitCount: 2,
    jellyMaxGen: 2,
    jellyGenHpScale: 0.45,
    jellyGenRadiusScale: 0.72,
    spitterHoldRange: 340,
    spitterFireCd: 2.6,
    spitDamage: 5,
    spitSpeed: 150,
    burrowRevealRadius: 210,
    burrowSpeedMult: 1.35,
    burstDelay: 0.35,
    /** knockback velocity decays at this rate */
    knockDrag: 4,
    /** fade-in duration after spawn */
    spawnFade: 0.6,
  },
  boss: {
    leviathanChargeCd: 7,
    leviathanChargeSpeed: 80,
    leviathanChargeTime: 1.2,
    krakenOrbitRadius: 400,
    krakenSummonCd: 5,
    krakenSummonCount: 6,
    krakenInkCd: 2.2,
    mawRingCd: 4.5,
    mawRingCount: 14,
    mawSummonCd: 7,
    mawShieldCycle: 10,
    mawShieldTime: 4,
    knockbackResist: 0.92,
  },
  weapons: {
    harpoonSpeed: 620,
    harpoonRadius: 6,
    harpoonLife: 1.6,
    chainVisual: 0.18,
    foghornProjectileClear: true,
  },
  damageNumbers: {
    /** accumulate continuous damage on an enemy and emit a number this often */
    interval: 0.3,
    life: 0.8,
    rise: 40,
  },
  meta: {
    coinsPerSecond: 1 / 8,
    coinsPerKill: 1 / 25,
  },
  juice: {
    traumaDecay: 1.4,
    shakeMax: 14,
    hurtTrauma: 0.35,
    bossTrauma: 0.9,
    hitFlashTime: 0.08,
    bossKillSlowmo: 0.25,
    bossKillSlowmoTime: 1.6,
  },
  bench: {
    warmup: 1.5,
    duration: 10,
  },
};

export type Config = typeof CONFIG;
