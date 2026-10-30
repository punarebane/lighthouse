import { Application, Container, Graphics, RenderTexture, Sprite, Texture, TilingSprite } from 'pixi.js';
import { CONFIG, EnemyType } from '../data/config';
import { palette } from '../data/palette';
import { lerp, TAU } from '../core/math';
import { Ev } from '../sim/events';
import { EF_BURROWED, EF_CHARGING, EF_LIT, EF_SHIELDED, PK_HARPOON, PK_INK, PK_ORB } from '../sim/stores';
import { BEAM_STRIDE, dronePosition } from '../sim/beam';
import type { World } from '../sim/world';
import { createTextures, type Textures } from './textures';
import { PartPool } from './partPool';
import { Arcs, DamageNumbers, Rings, Shake, Sparks } from './fx';

/** Light map resolution relative to the screen (lights are soft, so half-res is plenty). */
const LIGHT_RES = 0.5;
const MAX_LIGHTS = 40;

export interface RenderSettings {
  shake: number; // 0..1
  crt: boolean;
  lighting: boolean;
}

function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
}

export class GameRenderer {
  readonly app: Application;
  readonly tex: Textures;
  readonly world = new Container();
  readonly over = new Container();
  private readonly sea: TilingSprite;
  private readonly enemyPools: PartPool[] = [];
  private readonly bossSprites: Sprite[] = [];
  private readonly shields: PartPool;
  private readonly eyes: PartPool;
  private readonly embers: PartPool;
  private readonly harpoons: PartPool;
  private readonly blobs: PartPool;
  private readonly sparksPP: PartPool;
  private readonly digits: PartPool;
  private readonly rock: Graphics;
  private readonly lamp: Graphics;
  private readonly arcsG = new Graphics();
  private readonly ringSprites: Sprite[] = [];
  private readonly droneSprites: Sprite[] = [];

  // lighting pass
  private readonly lightScene = new Container();
  private readonly lightBg: Sprite;
  private readonly lightLayer = new Container();
  private readonly cones: Sprite[] = [];
  /** faint additive copies of the cones above the darkness: light haze in the air */
  private readonly haze: Sprite[] = [];
  private readonly glow: Sprite;
  private readonly droneLights: Sprite[] = [];
  private readonly lights: Sprite[] = [];
  private readonly lightX = new Float32Array(MAX_LIGHTS);
  private readonly lightY = new Float32Array(MAX_LIGHTS);
  private readonly lightR = new Float32Array(MAX_LIGHTS);
  private readonly lightLife = new Float32Array(MAX_LIGHTS);
  private readonly lightMax = new Float32Array(MAX_LIGHTS);
  private readonly lightColor = new Uint32Array(MAX_LIGHTS);
  private lightNext = 0;
  private lightRT: RenderTexture;
  private readonly lightSprite: Sprite;

  private readonly vignette: Sprite;
  private readonly scan: TilingSprite;
  private readonly hurtVig: Sprite;
  private readonly screenFlash: Sprite;

  readonly sparks = new Sparks(2048);
  readonly numbers = new DamageNumbers();
  readonly rings = new Rings();
  readonly arcs = new Arcs();
  readonly shake = new Shake();
  private arcsDrawn = false;
  private hurtFlash = 0;
  private flashT = 0;
  private time = 0;
  private camScale = 1;

  constructor(app: Application) {
    this.app = app;
    const tex = (this.tex = createTextures(app.renderer));

    this.sea = new TilingSprite({ texture: tex.sea, width: 2600, height: 2600 });
    this.sea.anchor.set(0.5);
    this.sea.tileScale.set(2.2);
    this.world.addChild(this.sea);

    this.embers = new PartPool(tex.ember, 'add');
    this.world.addChild(this.embers.pc);
    for (let t = 0; t < 7; t++) {
      const p = new PartPool(tex.enemies[t]!);
      this.enemyPools.push(p);
      this.world.addChild(p.pc);
    }
    for (let k = 0; k < 4; k++) {
      const s = new Sprite(tex.bosses[0]!);
      s.anchor.set(0.5);
      s.visible = false;
      this.bossSprites.push(s);
      this.world.addChild(s);
    }
    this.shields = new PartPool(tex.shield);
    this.world.addChild(this.shields.pc);

    this.rock = this.buildRock();
    this.world.addChild(this.rock);
    for (let k = 0; k < 8; k++) {
      const d = new Sprite(tex.dot);
      d.anchor.set(0.5);
      d.visible = false;
      this.droneSprites.push(d);
      this.world.addChild(d);
    }

    // lighting: dark fill + additive lights, multiplied over the world
    this.lightBg = new Sprite(Texture.WHITE);
    this.lightScene.addChild(this.lightBg, this.lightLayer);
    this.glow = this.lightSprite_(tex.radial);
    for (let k = 0; k < 3; k++) {
      const c = new Sprite(tex.cone);
      c.anchor.set(0, 0.5);
      c.blendMode = 'add';
      this.cones.push(c);
      this.lightLayer.addChild(c);
    }
    for (let k = 0; k < 8; k++) this.droneLights.push(this.lightSprite_(tex.radial));
    for (let k = 0; k < MAX_LIGHTS; k++) this.lights.push(this.lightSprite_(tex.radial));
    this.lightRT = RenderTexture.create({ width: 16, height: 16 });
    this.lightSprite = new Sprite(this.lightRT);
    this.lightSprite.blendMode = 'multiply';

    // above the darkness: things that glow or must stay readable
    this.harpoons = new PartPool(tex.harpoon);
    this.blobs = new PartPool(tex.blob, 'add');
    this.eyes = new PartPool(tex.eyes, 'add');
    this.sparksPP = new PartPool(tex.dot, 'add');
    this.digits = new PartPool(tex.digits[0]!);
    this.lamp = new Graphics();
    this.lamp.circle(0, 0, 8).fill(0xffffff);
    this.lamp.moveTo(0, 0).lineTo(12, 0).stroke({ width: 5, color: 0xffffff });
    for (let k = 0; k < 3; k++) {
      const c = new Sprite(tex.cone);
      c.anchor.set(0, 0.5);
      c.blendMode = 'add';
      c.visible = false;
      this.haze.push(c);
      this.over.addChild(c);
    }
    this.over.addChild(this.eyes.pc, this.harpoons.pc, this.blobs.pc, this.sparksPP.pc, this.arcsG, this.lamp);
    for (let k = 0; k < 32; k++) {
      const r = new Sprite(tex.ring);
      r.anchor.set(0.5);
      r.visible = false;
      r.blendMode = 'add';
      this.ringSprites.push(r);
      this.over.addChild(r);
    }
    this.over.addChild(this.digits.pc);

    this.vignette = new Sprite(tex.vignette);
    this.scan = new TilingSprite({ texture: tex.scanlines, width: 16, height: 16 });
    this.hurtVig = new Sprite(tex.vignette);
    this.hurtVig.tint = 0xff0000;
    this.hurtVig.alpha = 0;
    this.screenFlash = new Sprite(Texture.WHITE);
    this.screenFlash.alpha = 0;
    this.screenFlash.blendMode = 'add';

    app.stage.addChild(this.world, this.lightSprite, this.over, this.hurtVig, this.screenFlash, this.vignette, this.scan);
    this.resize();
  }

  private lightSprite_(t: Texture): Sprite {
    const s = new Sprite(t);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.visible = false;
    this.lightLayer.addChild(s);
    return s;
  }

  private buildRock(): Graphics {
    const g = new Graphics();
    const p = palette;
    const pts: number[] = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      const r = 40 + Math.sin(k * 2.7) * 5 + Math.cos(k * 1.3) * 4;
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.poly(pts).fill(p.rockEdge);
    g.circle(0, 0, 33).fill(p.rock);
    g.circle(0, 0, 22).fill(p.tower);
    g.circle(0, 0, 22).stroke({ width: 4, color: p.towerStripe });
    g.circle(0, 0, 14).fill(p.towerStripe);
    g.circle(0, 0, 10).fill(p.tower);
    return g;
  }

  resize(): void {
    const W = this.app.screen.width, H = this.app.screen.height;
    this.camScale = Math.min(W, H) / 2 / CONFIG.world.viewRadius;
    const lw = Math.max(16, Math.ceil(W * LIGHT_RES)), lh = Math.max(16, Math.ceil(H * LIGHT_RES));
    this.lightRT.resize(lw, lh);
    this.lightBg.width = lw;
    this.lightBg.height = lh;
    this.lightSprite.width = W;
    this.lightSprite.height = H;
    this.vignette.width = W; this.vignette.height = H;
    this.hurtVig.width = W; this.hurtVig.height = H;
    this.scan.width = W; this.scan.height = H;
    this.screenFlash.width = W; this.screenFlash.height = H;
  }

  addLight(x: number, y: number, r: number, life: number, color: number): void {
    const i = this.lightNext;
    this.lightNext = (i + 1) % MAX_LIGHTS;
    this.lightX[i] = x; this.lightY[i] = y; this.lightR[i] = r;
    this.lightLife[i] = life; this.lightMax[i] = life; this.lightColor[i] = color;
  }

  /** React to a sim event with visual effects. */
  onEvent(w: World, type: Ev, x: number, y: number, a: number, b: number): void {
    const p = palette;
    switch (type) {
      case Ev.Hit:
        if (a >= 1) this.numbers.spawn(x, y, a, b);
        else if (b === 2) this.sparks.burst(x, y, 4, 120, 0.25, 6, p.shield);
        break;
      case Ev.Kill: {
        const t = a as EnemyType;
        const col = t === EnemyType.Boss ? p.bosses[0]! : p.enemies[t]!;
        this.sparks.burst(x, y, 6 + Math.min(20, b), 90 + b * 4, 0.45, 9, col);
        this.addLight(x, y, 40 + b * 2, 0.25, col);
        break;
      }
      case Ev.Hurt:
        this.hurtFlash = Math.min(1, this.hurtFlash + 0.25 + a * 0.03);
        this.shake.add(CONFIG.juice.hurtTrauma * Math.min(1.5, 0.4 + a / 12));
        break;
      case Ev.Flash:
        this.flashT = 0.35;
        this.rings.spawn(0, 0, 30, 900, 0.6, a ? p.burn : p.flash);
        this.shake.add(0.25);
        break;
      case Ev.Foghorn:
        this.rings.spawn(0, 0, 40, a, 0.5, p.waveLine);
        this.rings.spawn(0, 0, 20, a * 0.7, 0.4, p.waveLine);
        this.shake.add(0.2);
        break;
      case Ev.Chain:
        this.arcs.spawn(x, y, a, b, CONFIG.weapons.chainVisual);
        this.addLight(a, b, 50, 0.15, p.lightning);
        break;
      case Ev.Split:
        this.sparks.burst(x, y, 8, 70, 0.4, 7, p.enemies[EnemyType.Jelly]!);
        break;
      case Ev.Surface:
        this.sparks.burst(x, y, 14, 110, 0.6, 7, p.enemies[EnemyType.Burrower]!);
        this.rings.spawn(x, y, 6, 40, 0.4, p.enemies[EnemyType.Burrower]!);
        break;
      case Ev.EmberPick:
        if (Math.random() < 0.5) this.sparks.spawn(x, y, (Math.random() - 0.5) * 60, -30 - Math.random() * 40, 0.4, 5, p.emberCore, 2);
        break;
      case Ev.BossSpawn:
        this.shake.add(CONFIG.juice.bossTrauma);
        this.rings.spawn(x, y, 40, 300, 1.2, p.bosses[a | 0]!);
        break;
      case Ev.BossKill:
        this.shake.add(1);
        this.sparks.burst(x, y, 80, 300, 1.2, 14, p.bosses[a | 0]!);
        this.sparks.burst(x, y, 40, 200, 1.4, 10, p.ember);
        this.rings.spawn(x, y, 40, 500, 1.2, p.flash);
        this.addLight(x, y, 400, 1.2, p.flash);
        break;
      case Ev.BossAttack:
        this.rings.spawn(x, y, 60, 140, 0.5, p.eyes);
        this.shake.add(0.15);
        break;
      case Ev.Explosion:
        this.sparks.burst(x, y, 10, 160, 0.35, 8, p.burn);
        this.addLight(x, y, a * 1.6, 0.2, p.burn);
        break;
      case Ev.Wave:
        this.shake.add(0.3);
        break;
      case Ev.Death:
        this.shake.add(1);
        this.sparks.burst(0, 0, 60, 260, 1.5, 12, p.lamp);
        break;
    }
  }

  draw(w: World, alpha: number, dt: number, settings: RenderSettings): void {
    const p = palette;
    const C = CONFIG;
    this.time += dt;
    const W = this.app.screen.width, H = this.app.screen.height;
    this.shake.update(dt, settings.shake);
    const cx = W / 2 + this.shake.x, cy = H / 2 + this.shake.y;
    const sc = this.camScale;
    this.world.position.set(cx, cy);
    this.world.scale.set(sc);
    this.over.position.set(cx, cy);
    this.over.scale.set(sc);

    this.sea.tint = p.seaLit;
    this.sea.tilePosition.set(this.time * 6, this.time * 3);

    const E = w.enemies;
    const ia = alpha, ib = 1 - alpha;
    const fadeT = C.enemyAI.spawnFade;

    // ---- enemies ----
    for (let t = 0; t < 7; t++) this.enemyPools[t]!.begin();
    this.eyes.begin();
    this.shields.begin();
    let bossN = 0;
    for (let i = 0; i < E.pool.hi; i++) {
      if (!E.pool.alive[i]) continue;
      const f = E.flags[i]!;
      if (f & EF_BURROWED) continue;
      const x = E.px[i]! * ib + E.x[i]! * ia;
      const y = E.py[i]! * ib + E.y[i]! * ia;
      const dx = E.x[i]! - E.px[i]!, dy = E.y[i]! - E.py[i]!;
      const rot = dx * dx + dy * dy > 0.0004 ? Math.atan2(dy, dx) : Math.atan2(-y, -x);
      const type = E.type[i]!;
      const r = E.radius[i]!;
      const fade = Math.min(1, E.age[i]! / fadeT);
      let tint: number;
      if (type === EnemyType.Boss) {
        const v = E.gen[i]!;
        tint = p.bosses[v]!;
        if (f & EF_CHARGING) tint = mixColor(tint, p.eyes, 0.5 + 0.5 * Math.sin(this.time * 30));
        if (E.flash[i]! > 0) tint = mixColor(tint, 0xffffff, 0.6);
        if (bossN < this.bossSprites.length) {
          const s = this.bossSprites[bossN++]!;
          s.visible = true;
          s.texture = this.tex.bosses[v]!;
          s.position.set(x, y);
          s.rotation = rot + (v === 2 ? Math.sin(this.time * 2) * 0.1 : 0);
          const k = r / this.tex.bossDrawR;
          s.scale.set(k * (1 + Math.sin(this.time * 3) * 0.03), k);
          s.tint = tint;
          s.alpha = fade;
        }
        if (f & EF_SHIELDED) this.shields.add(x, y, this.time, (r * 1.3) / 30, (r * 1.3) / 30, p.shield, 0.8);
        if (!(f & EF_LIT)) {
          const hx = x + Math.cos(rot) * r * 0.45, hy = y + Math.sin(rot) * r * 0.45;
          this.eyes.add(hx, hy, rot, 2.6, 3.2, p.eyes, 0.85 * fade);
        }
        continue;
      }
      if (E.flash[i]! > 0) tint = 0xffffff;
      else if (E.burnT[i]! > 0) tint = mixColor(p.enemies[type]!, p.burn, 0.35 + 0.15 * Math.sin(this.time * 20 + i));
      else if (E.stun[i]! > 0) tint = mixColor(p.enemies[type]!, p.frost, 0.5);
      else tint = p.enemies[type]!;
      const k = r / this.tex.enemyDrawR[type]!;
      let sx = k, sy = k;
      if (type === EnemyType.Jelly) sx *= 1 + Math.sin(this.time * 6 + E.phase[i]!) * 0.12;
      if (type === EnemyType.Eel) sy *= 1 + Math.sin(this.time * 12 + E.phase[i]!) * 0.15;
      this.enemyPools[type]!.add(x, y, rot, sx, sy, tint, fade);
      if (type === EnemyType.Ship) {
        const narrow = w.focus >= C.beam.shieldFocus;
        this.shields.add(x, y, this.time * 0.7 + i, (r * 1.45) / 30, (r * 1.45) / 30, p.shield, narrow ? 0.35 : 0.85);
      }
      if (!(f & EF_LIT)) {
        const hx = x + Math.cos(rot) * r * 0.45, hy = y + Math.sin(rot) * r * 0.45;
        const es = 0.55 + r / 22;
        const blink = Math.sin(this.time * 0.9 + E.phase[i]! * 7) > 0.97 ? 0.1 : 1;
        this.eyes.add(hx, hy, rot, es, es, p.eyes, 0.55 * fade * blink);
      }
    }
    for (let k = bossN; k < this.bossSprites.length; k++) this.bossSprites[k]!.visible = false;
    for (let t = 0; t < 7; t++) this.enemyPools[t]!.end();
    this.eyes.end();
    this.shields.end();

    // ---- embers ----
    const M = w.embers;
    this.embers.begin();
    for (let i = 0; i < M.pool.hi; i++) {
      if (!M.pool.alive[i]) continue;
      const x = M.px[i]! * ib + M.x[i]! * ia, y = M.py[i]! * ib + M.y[i]! * ia;
      const v = M.value[i]!;
      const s = (0.35 + Math.min(1.2, Math.sqrt(v) * 0.18)) * (1 + 0.25 * Math.sin(this.time * 9 + i * 1.7));
      const lit = M.lit[i]!;
      const life = Math.min(1, (C.embers.lifetime - M.age[i]!) / 4);
      this.embers.add(x, y, 0, s, s, lit ? p.emberCore : p.ember, (lit ? 1 : 0.7) * life);
      // ember sparkle
      if (lit && Math.random() < 0.04) this.sparks.spawn(x, y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.3, 3, p.emberCore, 1);
    }
    this.embers.end();

    // ---- projectiles ----
    const P = w.projectiles;
    this.harpoons.begin();
    this.blobs.begin();
    for (let i = 0; i < P.pool.hi; i++) {
      if (!P.pool.alive[i]) continue;
      const x = P.px[i]! * ib + P.x[i]! * ia, y = P.py[i]! * ib + P.y[i]! * ia;
      const kind = P.kind[i]!;
      if (kind === PK_HARPOON) {
        this.harpoons.add(x, y, Math.atan2(P.vy[i]!, P.vx[i]!), 1.1, 1.1, p.harpoon, 1);
      } else {
        const col = kind === PK_INK ? p.bosses[1]! : kind === PK_ORB ? p.eyes : p.spit;
        const s = P.radius[i]! / 8 * (1 + 0.15 * Math.sin(this.time * 20 + i));
        this.blobs.add(x, y, 0, s, s, col, 1);
      }
    }
    this.harpoons.end();
    this.blobs.end();

    // ---- drones ----
    const st = w.stats;
    const dPhase = lerp(w.prevDronePhase, w.dronePhase, alpha);
    const tmp = this.tmpPt;
    for (let k = 0; k < this.droneSprites.length; k++) {
      const s = this.droneSprites[k]!;
      const on = k < st.drones;
      s.visible = on;
      this.droneLights[k]!.visible = on && settings.lighting;
      if (!on) continue;
      dronePosition(w, k, dPhase, tmp);
      s.position.set(tmp.x, tmp.y);
      s.scale.set(0.6);
      s.tint = p.lamp;
      const l = this.droneLights[k]!;
      l.position.set(tmp.x, tmp.y);
      l.scale.set((st.droneLight * 2.6) / 256);
      l.tint = p.glow;
    }

    // ---- lamp ----
    const beamA = this.lerpAngle(w.prevBeamAngle, w.beamAngle, alpha);
    this.lamp.rotation = beamA;

    // ---- fx ----
    this.sparks.update(dt);
    this.numbers.update(dt);
    this.rings.update(dt);
    this.arcs.update(dt);
    this.sparksPP.begin();
    const S = this.sparks;
    for (let i = 0; i < S.pool.hi; i++) {
      if (!S.pool.alive[i]) continue;
      const k = S.life[i]! / S.max[i]!;
      const s = (S.size[i]! / 16) * (0.4 + 0.6 * k);
      this.sparksPP.add(S.x[i]!, S.y[i]!, 0, s, s, S.color[i]!, k);
    }
    this.sparksPP.end();

    this.digits.begin();
    const N = this.numbers;
    const dw = this.tex.digitW * 0.62;
    for (let i = 0; i < N.pool.hi; i++) {
      if (!N.pool.alive[i]) continue;
      let v = Math.round(N.value[i]!);
      if (v <= 0) continue;
      const big = N.kind[i] === 1;
      const life = N.life[i]! / C.damageNumbers.life;
      const s = (big ? 1.5 : 1.05) * (life > 0.85 ? 1 + (life - 0.85) * 3 : 1);
      let nd = 1;
      for (let t = v; t >= 10; t = (t / 10) | 0) nd++;
      const x0 = N.x[i]! + ((nd - 1) * dw * s) / 2;
      const col = big ? p.critText : p.damageText;
      const a = Math.min(1, life * 2.5);
      for (let d = 0; d < nd; d++) {
        const digit = v % 10;
        v = (v / 10) | 0;
        this.digits.add(x0 - d * dw * s, N.y[i]!, 0, s, s, col, a, this.tex.digits[digit]);
      }
    }
    this.digits.end();

    const R = this.rings;
    for (let k = 0; k < this.ringSprites.length; k++) {
      const s = this.ringSprites[k]!;
      if (k >= R.pool.hi || !R.pool.alive[k]) { s.visible = false; continue; }
      const t = 1 - R.life[k]! / R.max[k]!;
      const r = lerp(R.r0[k]!, R.r1[k]!, 1 - (1 - t) * (1 - t));
      s.visible = true;
      s.position.set(R.x[k]!, R.y[k]!);
      s.scale.set(r / 60);
      s.tint = R.color[k]!;
      s.alpha = 1 - t;
    }

    const A = this.arcs;
    if (A.pool.count > 0 || this.arcsDrawn) this.arcsG.clear();
    this.arcsDrawn = A.pool.count > 0;
    for (let i = 0; i < A.pool.hi; i++) {
      if (!A.pool.alive[i]) continue;
      const x0 = A.x0[i]!, y0 = A.y0[i]!, x1 = A.x1[i]!, y1 = A.y1[i]!;
      const segs = 6;
      const nx = -(y1 - y0), ny = x1 - x0;
      const len = Math.sqrt(nx * nx + ny * ny) || 1;
      this.arcsG.moveTo(x0, y0);
      for (let k = 1; k < segs; k++) {
        const t = k / segs;
        const j = Math.sin(A.seed[i]! + k * 12.9898 + this.time * 40) * 12;
        this.arcsG.lineTo(lerp(x0, x1, t) + (nx / len) * j, lerp(y0, y1, t) + (ny / len) * j);
      }
      this.arcsG.lineTo(x1, y1);
    }
    if (A.pool.count > 0) {
      this.arcsG.stroke({ width: 5, color: p.lightning, alpha: 0.35 });
      this.arcsG.stroke({ width: 2, color: 0xffffff, alpha: 0.95 });
    }

    // ---- overlays ----
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    const lowHp = w.hp / st.hpMax;
    const danger = lowHp < 0.3 && w.hp > 0 ? (0.3 - lowHp) * (0.6 + 0.4 * Math.sin(this.time * 6)) : 0;
    this.hurtVig.alpha = Math.min(0.9, this.hurtFlash + danger);
    this.hurtVig.visible = this.hurtVig.alpha > 0.01;
    this.flashT = Math.max(0, this.flashT - dt);
    this.screenFlash.alpha = this.flashT * 1.2;
    this.screenFlash.visible = this.flashT > 0;
    this.lamp.tint = palette.lamp;
    this.vignette.visible = settings.crt;
    this.scan.visible = settings.crt;

    // ---- lighting pass ----
    this.lightSprite.visible = settings.lighting;
    if (!settings.lighting) for (const hz of this.haze) hz.visible = false;
    if (settings.lighting) this.renderLights(w, alpha, dt, beamA, lowHp);
  }

  private readonly tmpPt = { x: 0, y: 0 };

  private lerpAngle(a: number, b: number, t: number): number {
    let d = b - a;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    return a + d * t;
  }

  private renderLights(w: World, alpha: number, dt: number, beamA: number, hpFrac: number): void {
    const p = palette;
    const st = w.stats;
    const flash = this.flashT > 0 ? Math.min(1, this.flashT * 3) : 0;
    this.lightBg.tint = flash > 0 ? mixColor(p.darkness, 0xffffff, flash * 0.85) : p.darkness;
    const W = this.app.screen.width, H = this.app.screen.height;
    this.lightLayer.position.set((W / 2 + this.shake.x) * LIGHT_RES, (H / 2 + this.shake.y) * LIGHT_RES);
    this.lightLayer.scale.set(this.camScale * LIGHT_RES);

    // low-HP flicker
    let flicker = 1;
    if (hpFrac < 0.35 && w.hp > 0) {
      const n = Math.sin(this.time * 37) * Math.sin(this.time * 13.7 + 1) * Math.sin(this.time * 5.3);
      flicker = 1 - CONFIG.beam.lowHpFlicker * (0.5 + 0.5 * n) * ((0.35 - hpFrac) / 0.35 + 0.4);
    }

    const sweepA = this.lerpAngle(w.prevSweepAngle, w.sweepAngle, alpha);
    const tanBase = Math.tan(this.tex.coneHalfAngle);
    for (let k = 0; k < this.cones.length; k++) {
      const c = this.cones[k]!;
      const hz = this.haze[k]!;
      if (k >= w.beamCount) { c.visible = false; hz.visible = false; continue; }
      const o = k * BEAM_STRIDE;
      const half = Math.max(0.01, w.beams[o + 1]!);
      const range = w.beams[o + 2]!;
      const frac = w.beams[o + 3]!;
      const ang = k === 0 ? beamA : k === 1 && st.secondBeam > 0 ? beamA + Math.PI : sweepA;
      c.visible = true;
      c.rotation = ang;
      const sx = range / this.tex.coneLength;
      c.scale.set(sx, sx * (Math.tan(half) / tanBase));
      c.tint = p.beam;
      c.alpha = (0.55 + 0.45 * Math.min(1, frac)) * (0.85 + 0.15 * w.focus) * flicker;
      hz.visible = true;
      hz.rotation = c.rotation;
      hz.scale.copyFrom(c.scale);
      hz.tint = p.beam;
      hz.alpha = c.alpha * (0.07 + 0.08 * w.focus);
    }
    this.glow.visible = true;
    this.glow.position.set(0, 0);
    this.glow.scale.set((st.glowRadius * 2.5) / 256);
    this.glow.tint = p.glow;
    this.glow.alpha = flicker;

    for (let k = 0; k < MAX_LIGHTS; k++) {
      const s = this.lights[k]!;
      if (this.lightLife[k]! <= 0) { s.visible = false; continue; }
      this.lightLife[k]! -= dt;
      const t = Math.max(0, this.lightLife[k]! / this.lightMax[k]!);
      s.visible = true;
      s.position.set(this.lightX[k]!, this.lightY[k]!);
      s.scale.set((this.lightR[k]! * 2) / 256);
      s.tint = this.lightColor[k]!;
      s.alpha = t;
    }
    this.app.renderer.render({ container: this.lightScene, target: this.lightRT, clear: true });
  }
}

