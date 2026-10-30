import { CONFIG } from '../data/config';

export enum Ev {
  Hit,
  Kill,
  Hurt,
  LevelUp,
  Flash,
  Foghorn,
  Harpoon,
  Chain,
  Split,
  Surface,
  EmberPick,
  Spit,
  BossSpawn,
  BossKill,
  Explosion,
  Victory,
  Death,
  Wave,
  BossAttack,
  /** first time an enemy type appears this run (a = type) */
  FirstSeen,
  /** an enemy projectile burned away by the beam */
  ProjectileBurned,
  /** a ship's shield broke */
  ShieldBreak,
}

/** Fixed-size SoA event ring the sim writes and render/audio drain each frame. */
export class EventQueue {
  readonly type: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly a: Float32Array;
  readonly b: Float32Array;
  n = 0;
  constructor(cap = CONFIG.capacity.events) {
    this.type = new Uint8Array(cap);
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.a = new Float32Array(cap);
    this.b = new Float32Array(cap);
  }
  push(type: Ev, x: number, y: number, a = 0, b = 0): void {
    const i = this.n;
    if (i >= this.type.length) return;
    this.type[i] = type;
    this.x[i] = x;
    this.y[i] = y;
    this.a[i] = a;
    this.b[i] = b;
    this.n = i + 1;
  }
  clear(): void {
    this.n = 0;
  }
}
