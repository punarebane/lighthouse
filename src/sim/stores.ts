import { Pool } from '../core/pool';

export const EF_LIT = 1;
export const EF_BURROWED = 2;
export const EF_SHIELDED = 4;
export const EF_CHARGING = 8;
export const EF_NOXP = 16;

/** Enemies as structure-of-arrays. */
export class EnemyStore {
  readonly pool: Pool;
  readonly x: Float32Array; readonly y: Float32Array;
  readonly px: Float32Array; readonly py: Float32Array;
  /** knockback / external velocity */
  readonly vx: Float32Array; readonly vy: Float32Array;
  readonly hp: Float32Array; readonly maxHp: Float32Array;
  readonly radius: Float32Array; readonly speed: Float32Array;
  readonly stun: Float32Array;
  readonly burnT: Float32Array; readonly burnDps: Float32Array;
  readonly flash: Float32Array;
  readonly timer: Float32Array; readonly timer2: Float32Array;
  readonly dmgAcc: Float32Array; readonly dmgT: Float32Array;
  readonly age: Float32Array; readonly phase: Float32Array;
  readonly type: Uint8Array; readonly flags: Uint8Array;
  /** jelly generation, or boss variant */
  readonly gen: Uint8Array;

  constructor(cap: number) {
    this.pool = new Pool(cap);
    const f = () => new Float32Array(cap);
    this.x = f(); this.y = f(); this.px = f(); this.py = f();
    this.vx = f(); this.vy = f(); this.hp = f(); this.maxHp = f();
    this.radius = f(); this.speed = f(); this.stun = f();
    this.burnT = f(); this.burnDps = f(); this.flash = f();
    this.timer = f(); this.timer2 = f(); this.dmgAcc = f(); this.dmgT = f();
    this.age = f(); this.phase = f();
    this.type = new Uint8Array(cap); this.flags = new Uint8Array(cap); this.gen = new Uint8Array(cap);
  }
}

export const PK_HARPOON = 0;
export const PK_SPIT = 1;
export const PK_INK = 2;
export const PK_ORB = 3;

export class ProjectileStore {
  readonly pool: Pool;
  readonly x: Float32Array; readonly y: Float32Array;
  readonly px: Float32Array; readonly py: Float32Array;
  readonly vx: Float32Array; readonly vy: Float32Array;
  readonly life: Float32Array; readonly damage: Float32Array; readonly radius: Float32Array;
  readonly pierce: Int16Array;
  readonly lastHit: Int32Array;
  readonly kind: Uint8Array;
  readonly hostile: Uint8Array;
  constructor(cap: number) {
    this.pool = new Pool(cap);
    const f = () => new Float32Array(cap);
    this.x = f(); this.y = f(); this.px = f(); this.py = f(); this.vx = f(); this.vy = f();
    this.life = f(); this.damage = f(); this.radius = f();
    this.pierce = new Int16Array(cap); this.lastHit = new Int32Array(cap);
    this.kind = new Uint8Array(cap); this.hostile = new Uint8Array(cap);
  }
}

export class EmberStore {
  readonly pool: Pool;
  readonly x: Float32Array; readonly y: Float32Array;
  readonly px: Float32Array; readonly py: Float32Array;
  readonly vx: Float32Array; readonly vy: Float32Array;
  readonly value: Float32Array; readonly age: Float32Array;
  readonly lit: Uint8Array;
  constructor(cap: number) {
    this.pool = new Pool(cap);
    const f = () => new Float32Array(cap);
    this.x = f(); this.y = f(); this.px = f(); this.py = f(); this.vx = f(); this.vy = f();
    this.value = f(); this.age = f();
    this.lit = new Uint8Array(cap);
  }
}
