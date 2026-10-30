import { Pool } from '../core/pool';
import { CONFIG } from '../data/config';

/** Render-side SoA pools for sparks, damage numbers, rings and lightning arcs. */
export class Sparks {
  readonly pool: Pool;
  readonly x: Float32Array; readonly y: Float32Array;
  readonly vx: Float32Array; readonly vy: Float32Array;
  readonly life: Float32Array; readonly max: Float32Array;
  readonly size: Float32Array; readonly color: Uint32Array;
  readonly drag: Float32Array;
  constructor(cap: number) {
    this.pool = new Pool(cap);
    const f = () => new Float32Array(cap);
    this.x = f(); this.y = f(); this.vx = f(); this.vy = f();
    this.life = f(); this.max = f(); this.size = f(); this.drag = f();
    this.color = new Uint32Array(cap);
  }
  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, drag = 3): void {
    const i = this.pool.alloc();
    if (i < 0) return;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.color[i] = color; this.drag[i] = drag;
  }
  burst(x: number, y: number, n: number, speed: number, life: number, size: number, color: number): void {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6), color);
    }
  }
  update(dt: number): void {
    for (let i = 0; i < this.pool.hi; i++) {
      if (!this.pool.alive[i]) continue;
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) { this.pool.free(i); continue; }
      const d = Math.exp(-this.drag[i]! * dt);
      this.vx[i]! *= d; this.vy[i]! *= d;
      this.x[i]! += this.vx[i]! * dt;
      this.y[i]! += this.vy[i]! * dt;
    }
  }
}

export class DamageNumbers {
  readonly pool: Pool;
  readonly x: Float32Array; readonly y: Float32Array;
  readonly life: Float32Array; readonly value: Float32Array;
  readonly kind: Uint8Array;
  constructor(cap = CONFIG.capacity.damageNumbers) {
    this.pool = new Pool(cap);
    this.x = new Float32Array(cap); this.y = new Float32Array(cap);
    this.life = new Float32Array(cap); this.value = new Float32Array(cap);
    this.kind = new Uint8Array(cap);
  }
  spawn(x: number, y: number, value: number, kind: number): void {
    let i = this.pool.alloc();
    if (i < 0) {
      // recycle the oldest-looking slot
      i = (Math.random() * this.pool.cap) | 0;
    }
    this.x[i] = x + (Math.random() - 0.5) * 10;
    this.y[i] = y;
    this.life[i] = CONFIG.damageNumbers.life;
    this.value[i] = value;
    this.kind[i] = kind;
  }
  update(dt: number): void {
    const rise = CONFIG.damageNumbers.rise;
    for (let i = 0; i < this.pool.hi; i++) {
      if (!this.pool.alive[i]) continue;
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) { this.pool.free(i); continue; }
      this.y[i]! -= rise * dt;
    }
  }
}

export class Rings {
  readonly pool = new Pool(32);
  readonly x = new Float32Array(32); readonly y = new Float32Array(32);
  readonly r0 = new Float32Array(32); readonly r1 = new Float32Array(32);
  readonly life = new Float32Array(32); readonly max = new Float32Array(32);
  readonly color = new Uint32Array(32);
  spawn(x: number, y: number, r0: number, r1: number, life: number, color: number): void {
    const i = this.pool.alloc();
    if (i < 0) return;
    this.x[i] = x; this.y[i] = y; this.r0[i] = r0; this.r1[i] = r1;
    this.life[i] = life; this.max[i] = life; this.color[i] = color;
  }
  update(dt: number): void {
    for (let i = 0; i < this.pool.hi; i++) {
      if (!this.pool.alive[i]) continue;
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) this.pool.free(i);
    }
  }
}

export class Arcs {
  readonly pool = new Pool(96);
  readonly x0 = new Float32Array(96); readonly y0 = new Float32Array(96);
  readonly x1 = new Float32Array(96); readonly y1 = new Float32Array(96);
  readonly life = new Float32Array(96);
  readonly seed = new Float32Array(96);
  spawn(x0: number, y0: number, x1: number, y1: number, life: number): void {
    const i = this.pool.alloc();
    if (i < 0) return;
    this.x0[i] = x0; this.y0[i] = y0; this.x1[i] = x1; this.y1[i] = y1;
    this.life[i] = life; this.seed[i] = Math.random() * 1000;
  }
  update(dt: number): void {
    for (let i = 0; i < this.pool.hi; i++) {
      if (!this.pool.alive[i]) continue;
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) this.pool.free(i);
    }
  }
}

/** Trauma-based screen shake: offset = max * trauma^2 * noise. */
export class Shake {
  trauma = 0;
  x = 0;
  y = 0;
  private t = 0;
  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  update(dt: number, scale: number): void {
    const J = CONFIG.juice;
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - J.traumaDecay * dt);
    const s = this.trauma * this.trauma * J.shakeMax * scale;
    this.x = s * (Math.sin(this.t * 47.3) * 0.6 + Math.sin(this.t * 91.7) * 0.4);
    this.y = s * (Math.sin(this.t * 53.1 + 1.3) * 0.6 + Math.sin(this.t * 83.9 + 0.7) * 0.4);
  }
}
