import { Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';

/**
 * All textures are generated at startup: creature sprites from Graphics (drawn white/grey
 * so per-type palette tints apply, and hit-flash is just tint = white), soft light shapes
 * from canvas gradients. Creatures face +x.
 */
export interface Textures {
  enemies: Texture[]; // indexed by EnemyType (Boss unused)
  bosses: Texture[];
  /** pixel radius each enemy texture was drawn for (sprite scale = radius / drawnRadius) */
  enemyDrawR: number[];
  bossDrawR: number;
  eyes: Texture;
  shield: Texture;
  ember: Texture;
  dot: Texture;
  harpoon: Texture;
  blob: Texture;
  ring: Texture;
  digits: Texture[];
  digitW: number;
  digitH: number;
  cone: Texture;
  coneHalfAngle: number;
  coneLength: number;
  radial: Texture;
  vignette: Texture;
  scanlines: Texture;
  sea: Texture;
}

const W = 0xffffff, G1 = 0xd0d0d0, G2 = 0x8a8a8a, DK = 0x202020;

function gen(r: Renderer, g: Graphics, half: number, res = 2): Texture {
  const t = r.generateTexture({ target: g, resolution: res, antialias: true, frame: new Rectangle(-half, -half, half * 2, half * 2) });
  g.destroy();
  return t;
}

function swarmer(): Graphics {
  const g = new Graphics();
  for (let k = 0; k < 3; k++) {
    const a = 2.1 + k * 0.5;
    g.moveTo(0, 0).lineTo(Math.cos(a) * 15, Math.sin(a) * 15).moveTo(0, 0).lineTo(Math.cos(-a) * 15, Math.sin(-a) * 15);
  }
  g.stroke({ width: 2, color: G2 });
  g.ellipse(0, 0, 11, 9).fill(W);
  g.ellipse(-3, 0, 6, 5).fill(G1);
  g.circle(5, -3.5, 2).fill(DK).circle(5, 3.5, 2).fill(DK);
  return g;
}

function crab(): Graphics {
  const g = new Graphics();
  for (let k = 0; k < 3; k++) {
    const y = -10 + k * 10;
    g.moveTo(-4, y * 0.6).lineTo(-14, y * 1.7).moveTo(-4, -y * 0.6).lineTo(-14, -y * 1.7);
  }
  g.stroke({ width: 3, color: G2 });
  // claws
  g.moveTo(8, -12).lineTo(20, -18).stroke({ width: 4, color: G1 });
  g.moveTo(8, 12).lineTo(20, 18).stroke({ width: 4, color: G1 });
  g.circle(22, -19, 6).fill(W).circle(22, 19, 6).fill(W);
  g.ellipse(0, 0, 15, 18).fill(W);
  g.ellipse(-2, 0, 9, 12).fill(G1);
  g.circle(10, -5, 2.4).fill(DK).circle(10, 5, 2.4).fill(DK);
  return g;
}

function eel(): Graphics {
  const g = new Graphics();
  g.poly([16, 0, 8, -6, -6, -5, -18, -2, -24, 0, -18, 2, -6, 5, 8, 6]).fill(W);
  g.poly([-4, -5, 2, -10, 6, -5]).fill(G1);
  g.poly([-4, 5, 2, 10, 6, 5]).fill(G1);
  g.circle(10, -2.5, 1.8).fill(DK).circle(10, 2.5, 1.8).fill(DK);
  return g;
}

function jelly(): Graphics {
  const g = new Graphics();
  for (let k = -2; k <= 2; k++) {
    g.moveTo(-4, k * 4).bezierCurveTo(-12, k * 4 + 4, -16, k * 4 - 4, -22, k * 5);
  }
  g.stroke({ width: 2, color: G1 });
  g.arc(0, 0, 14, -Math.PI / 2, Math.PI / 2).closePath().fill({ color: W, alpha: 0.95 });
  g.ellipse(4, 0, 6, 9).fill({ color: G1, alpha: 0.9 });
  g.circle(9, -4, 1.8).fill(DK).circle(9, 4, 1.8).fill(DK);
  return g;
}

function ship(): Graphics {
  const g = new Graphics();
  g.poly([20, 0, 8, -10, -16, -10, -18, 0, -16, 10, 8, 10]).fill(W);
  g.rect(-10, -5, 12, 10).fill(G2);
  g.moveTo(-2, 0).lineTo(-2, -14).stroke({ width: 2, color: G1 });
  g.poly([-2, -14, 8, -9, -2, -6]).fill(G1);
  g.circle(14, 0, 2).fill(DK);
  return g;
}

function spitter(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 12).fill(W);
  g.rect(6, -4, 12, 8).fill(G1);
  g.circle(18, 0, 4).fill(G2);
  g.circle(-4, 0, 6).fill(G1);
  g.circle(4, -6, 2).fill(DK).circle(4, 6, 2).fill(DK);
  return g;
}

function burrower(): Graphics {
  const g = new Graphics();
  g.ellipse(-2, 0, 14, 11).fill(W);
  g.poly([10, -7, 22, 0, 10, 7]).fill(G2);
  g.moveTo(13, -4).lineTo(18, 0).lineTo(13, 4).stroke({ width: 1.5, color: DK });
  for (let k = -1; k <= 1; k += 2) g.ellipse(2, k * 10, 5, 3).fill(G1);
  g.circle(6, -4, 1.8).fill(DK).circle(6, 4, 1.8).fill(DK);
  return g;
}

function leviathan(): Graphics {
  const g = new Graphics();
  g.poly([60, 0, 40, -30, 0, -40, -40, -30, -64, 0, -40, 30, 0, 40, 40, 30]).fill(W);
  for (let k = -2; k <= 2; k++) g.poly([k * 14 - 6, -8, k * 14, -36, k * 14 + 6, -8]).fill(G1);
  g.poly([40, -10, 62, 0, 40, 10]).fill(G2);
  for (let k = 0; k < 5; k++) g.poly([44 + k * 3, -8 + k, 46 + k * 3, -3, 48 + k * 3, -8 + k]).fill(W);
  g.circle(30, -18, 5).fill(DK).circle(30, 18, 5).fill(DK);
  return g;
}

function kraken(): Graphics {
  const g = new Graphics();
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * 0.55 + (k / 7) * Math.PI * 0.9;
    g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20)
      .bezierCurveTo(Math.cos(a - 0.4) * 50, Math.sin(a - 0.4) * 50, Math.cos(a + 0.3) * 58, Math.sin(a + 0.3) * 58, Math.cos(a) * 68, Math.sin(a) * 68);
  }
  g.stroke({ width: 7, color: G1 });
  g.ellipse(6, 0, 40, 34).fill(W);
  g.ellipse(-4, 0, 22, 18).fill(G1);
  g.circle(26, -14, 6).fill(DK).circle(26, 14, 6).fill(DK);
  return g;
}

function maw(): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 66).fill(W);
  g.circle(0, 0, 52).fill(G1);
  g.circle(10, 0, 34).fill(DK);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const cx = 10 + Math.cos(a) * 34, cy = Math.sin(a) * 34;
    g.poly([cx + Math.cos(a + 0.2) * 2, cy + Math.sin(a + 0.2) * 2, 10 + Math.cos(a) * 18, Math.sin(a) * 18, cx + Math.cos(a - 0.2) * 2, cy + Math.sin(a - 0.2) * 2]).fill(W);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    g.circle(Math.cos(a) * 58, Math.sin(a) * 58, 4).fill(DK);
  }
  return g;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function createTextures(r: Renderer): Textures {
  const enemyDrawR = [10, 18, 12, 14, 16, 13, 13, 1];
  const enemies = [swarmer(), crab(), eel(), jelly(), ship(), spitter(), burrower()].map((g, i) => gen(r, g, (enemyDrawR[i]! + 12)));
  enemies.push(Texture.WHITE);
  const bosses = [leviathan(), kraken(), maw()].map((g) => gen(r, g, 72));

  const eyesG = new Graphics();
  eyesG.circle(0, -4, 2.2).fill(W).circle(0, 4, 2.2).fill(W);
  const eyes = gen(r, eyesG, 8, 3);

  const shieldG = new Graphics();
  shieldG.circle(0, 0, 30).stroke({ width: 3, color: W, alpha: 0.9 });
  shieldG.circle(0, 0, 26).stroke({ width: 2, color: W, alpha: 0.35 });
  const shield = gen(r, shieldG, 32);

  const harpoonG = new Graphics();
  harpoonG.moveTo(-14, 0).lineTo(8, 0).stroke({ width: 2.5, color: W });
  harpoonG.poly([14, 0, 6, -4, 6, 4]).fill(W);
  harpoonG.moveTo(-14, 0).lineTo(-18, -3).moveTo(-14, 0).lineTo(-18, 3).stroke({ width: 1.5, color: W });
  const harpoon = gen(r, harpoonG, 18);

  const ringG = new Graphics();
  ringG.circle(0, 0, 60).stroke({ width: 4, color: W });
  const ring = gen(r, ringG, 64);

  // soft dot (sparks / embers / blobs)
  const [dc, dx] = canvas(32, 32);
  const dg = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
  dg.addColorStop(0, 'rgba(255,255,255,1)');
  dg.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  dg.addColorStop(1, 'rgba(255,255,255,0)');
  dx.fillStyle = dg;
  dx.fillRect(0, 0, 32, 32);
  const dot = Texture.from(dc);

  const [ec, ex] = canvas(32, 32);
  const eg = ex.createRadialGradient(16, 16, 0, 16, 16, 16);
  eg.addColorStop(0, 'rgba(255,255,255,1)');
  eg.addColorStop(0.2, 'rgba(255,240,200,1)');
  eg.addColorStop(0.5, 'rgba(255,200,120,0.45)');
  eg.addColorStop(1, 'rgba(255,160,60,0)');
  ex.fillStyle = eg;
  ex.fillRect(0, 0, 32, 32);
  const ember = Texture.from(ec);

  const blobG = new Graphics();
  blobG.circle(0, 0, 8).fill(W).circle(-2, -2, 3).fill({ color: W, alpha: 0.6 });
  const blob = gen(r, blobG, 10);

  // digits atlas for pooled damage numbers
  const dw = 20, dh = 28;
  const [gc, gx] = canvas(dw * 10, dh);
  gx.font = 'bold 24px "Trebuchet MS", sans-serif';
  gx.textAlign = 'center';
  gx.textBaseline = 'middle';
  gx.lineWidth = 4;
  gx.strokeStyle = 'rgba(0,0,0,0.85)';
  gx.fillStyle = '#fff';
  for (let d = 0; d < 10; d++) {
    gx.strokeText(String(d), d * dw + dw / 2, dh / 2 + 1);
    gx.fillText(String(d), d * dw + dw / 2, dh / 2 + 1);
  }
  const digitBase = Texture.from(gc);
  const digits: Texture[] = [];
  for (let d = 0; d < 10; d++) digits.push(new Texture({ source: digitBase.source, frame: new Rectangle(d * dw, 0, dw, dh) }));

  // light cone: apex at (0, H/2), pointing +x, half-angle 45deg, radial falloff, soft edges
  const L = 512, H = 1024;
  const [cc, cx] = canvas(L, H);
  const coneHalfAngle = Math.PI / 4;
  cx.filter = 'blur(10px)';
  const cg = cx.createRadialGradient(0, H / 2, 0, 0, H / 2, L - 24);
  cg.addColorStop(0, 'rgba(255,255,255,1)');
  cg.addColorStop(0.55, 'rgba(255,255,255,0.92)');
  cg.addColorStop(0.85, 'rgba(255,255,255,0.55)');
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = cg;
  cx.beginPath();
  cx.moveTo(0, H / 2);
  cx.arc(0, H / 2, L - 24, -coneHalfAngle + 0.03, coneHalfAngle - 0.03);
  cx.closePath();
  cx.fill();
  const cone = Texture.from(cc);

  const [rc, rx] = canvas(256, 256);
  const rg = rx.createRadialGradient(128, 128, 0, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  rg.addColorStop(0.8, 'rgba(255,255,255,0.25)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  rx.fillStyle = rg;
  rx.fillRect(0, 0, 256, 256);
  const radial = Texture.from(rc);

  const [vc, vx] = canvas(512, 512);
  const vg = vx.createRadialGradient(256, 256, 120, 256, 256, 362);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.7, 'rgba(0,0,0,0.35)');
  vg.addColorStop(1, 'rgba(0,0,0,0.9)');
  vx.fillStyle = vg;
  vx.fillRect(0, 0, 512, 512);
  const vignette = Texture.from(vc);

  const [sc, sx] = canvas(4, 4);
  sx.fillStyle = 'rgba(0,0,0,0.28)';
  sx.fillRect(0, 0, 4, 2);
  const scanlines = Texture.from(sc);

  const sea = seaTexture();

  return {
    enemies, bosses, enemyDrawR, bossDrawR: 64, eyes, shield, ember, dot, harpoon, blob, ring,
    digits, digitW: dw, digitH: dh, cone, coneHalfAngle, coneLength: L - 24, radial, vignette, scanlines, sea,
  };
}

/** Tileable sea texture: layered sine ripples + speckle, drawn in greys (tinted later). */
function seaTexture(): Texture {
  const S = 256;
  const [c, x] = canvas(S, S);
  const img = x.createImageData(S, S);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const u = (px / S) * Math.PI * 2, v = (py / S) * Math.PI * 2;
      let h = Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * 0.5 + Math.sin(v * 5 + u * 2) * 0.3 + Math.sin(u * 7 - v * 4) * 0.2;
      h = h * 0.5 + 0.5;
      const crest = h > 0.82 ? (h - 0.82) * 3 : 0;
      const val = 150 + h * 60 + crest * 140 + (rnd() - 0.5) * 14;
      const o = (py * S + px) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.min(255, val);
      img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return Texture.from(c);
}
