import { Particle, ParticleContainer, type Texture } from 'pixi.js';

/**
 * A ParticleContainer whose Particle objects are reused frame to frame: begin(), add()...,
 * end() rewrites the first n particles and truncates the child list. Particles are only
 * created when the high-water mark grows, so steady-state frames allocate nothing.
 */
export class PartPool {
  readonly pc: ParticleContainer;
  private readonly parts: Particle[] = [];
  private readonly tex: Texture;
  private n = 0;

  constructor(tex: Texture, blend?: 'add' | 'normal') {
    this.tex = tex;
    this.pc = new ParticleContainer({
      texture: tex,
      dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true },
    });
    if (blend) this.pc.blendMode = blend;
  }

  begin(): void {
    this.n = 0;
  }

  add(x: number, y: number, rot: number, sx: number, sy: number, tint: number, alpha: number, tex?: Texture): void {
    let p = this.parts[this.n];
    if (!p) {
      p = new Particle({ texture: this.tex, anchorX: 0.5, anchorY: 0.5 });
      this.parts.push(p);
    }
    p.x = x;
    p.y = y;
    p.rotation = rot;
    p.scaleX = sx;
    p.scaleY = sy;
    // write the packed ABGR colour directly (the tint/alpha setters go through Color parsing)
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    p.color = ((tint & 0xff) << 16) + (tint & 0xff00) + ((tint >> 16) & 0xff) + (((a * 255) | 0) << 24);
    p.texture = tex ?? this.tex;
    const ch = this.pc.particleChildren;
    if (ch[this.n] !== p) ch[this.n] = p;
    this.n++;
  }

  end(): void {
    const ch = this.pc.particleChildren;
    if (ch.length !== this.n) ch.length = this.n;
  }

  get count(): number {
    return this.n;
  }
}
