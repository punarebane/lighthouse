import './style.css';
import { Application } from 'pixi.js';
import { CONFIG, BOSSES, EnemyType } from './data/config';

/** Shown once per run, the first time each enemy type appears. */
const ENEMY_TIPS: Record<number, string> = {
  [EnemyType.Eel]: 'Eels weave fast. Sweep across them.',
  [EnemyType.Crab]: 'Crabs are tough. Narrow the beam to burn them down.',
  [EnemyType.Jelly]: 'Jellies split in two when they pop.',
  [EnemyType.Spitter]: 'Spitters shoot from the dark. Your beam burns their spit out of the air.',
  [EnemyType.Ship]: 'Shielded ships! Only a NARROW beam hurts them: scroll up, W, or RT.',
  [EnemyType.Burrower]: 'Burrowers tunnel unseen until they surface near the rock.',
};
import { META, META_FULL } from './data/meta';
import { palette, setColorblind } from './data/palette';
import { createWorld, step } from './sim/sim';
import { applyOffer, makeInput, rollOffers, RunState, type World } from './sim/world';
import { botInput, botPick } from './sim/bot';
import { runCoins } from './sim/coins';
import { Ev } from './sim/events';
import { GameRenderer } from './render/renderer';
import { InputManager } from './input/input';
import { Audio } from './audio/sfx';
import { UI, applyCssPalette } from './game/ui';
import { loadSave, writeSave, type SaveData, type Settings } from './game/save';

type Mode = 'menu' | 'playing' | 'levelup' | 'paused' | 'ending' | 'summary' | 'bench';

interface DebugHook {
  mode: Mode;
  level: number;
  t: number;
  hp: number;
  kills: number;
  enemies: number;
  running: boolean;
  seed: number;
  frames: number;
  bench: null | Record<string, number>;
}

declare global {
  interface Window {
    __LH: DebugHook;
  }
}

const params = new URLSearchParams(location.search);
const urlSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const autoplay = params.get('autoplay') === '1';
const benchN = Number(params.get('bench') ?? 0) | 0;
const lightingOn = params.get('light') !== '0';
/** debug: fast-forward the run this many seconds with the bot (screenshots, boss testing) */
const fastForward = Number(params.get('ff') ?? 0);
const antialias = params.get('aa') === '1';

class Game {
  mode: Mode = 'menu';
  world: World;
  private acc = 0;
  private readonly input = makeInput();
  private endTimer = 0;
  private demo = true;
  private save: SaveData;
  private benchFrames: number[] = [];
  private benchWork: number[] = [];
  private benchT = 0;
  private lastFrame = performance.now();
  private simMs = 0;
  private drawMs = 0;
  private stepsThisFrame = 0;
  private benchSim: number[] = [];
  private benchDraw: number[] = [];
  private benchSteps = 0;

  constructor(
    private readonly app: Application,
    private readonly renderer: GameRenderer,
    private readonly inputs: InputManager,
    private readonly audio: Audio,
    private readonly ui: UI,
    save: SaveData,
  ) {
    this.save = save;
    this.world = createWorld({ seed: (Math.random() * 1e9) >>> 0, meta: META_FULL });
    window.__LH = { mode: 'menu', level: 1, t: 0, hp: 0, kills: 0, enemies: 0, running: false, seed: 0, frames: 0, bench: null };
  }

  startRun(): void {
    const seed = urlSeed ?? ((Math.random() * 1e9) >>> 0);
    this.world = createWorld({ seed, meta: this.save.meta });
    this.demo = false;
    this.acc = 0;
    this.mode = 'playing';
    this.ui.hide();
    this.ui.showHud(true);
    this.save.runs++;
    window.__LH.seed = seed;
    this.audio.play('wave', { minGap: 0 });
    if (fastForward > 0) {
      const w = this.world;
      while (w.t < fastForward && w.state === RunState.Running) {
        if (w.pendingLevels > 0) { rollOffers(w); applyOffer(w, botPick(w)); }
        botInput(w, this.input);
        step(w, this.input);
        w.events.clear();
      }
    }
  }

  startBench(n: number): void {
    this.world = createWorld({ seed: urlSeed ?? 1, bench: n });
    this.demo = false;
    this.mode = 'bench';
    this.ui.hide();
    this.ui.showHud(true);
    this.benchT = 0;
  }

  toMenu(): void {
    this.world = createWorld({ seed: (Math.random() * 1e9) >>> 0, meta: META_FULL });
    this.demo = true;
    this.mode = 'menu';
    this.ui.showHud(false);
    this.ui.showMenu();
  }

  pause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.ui.showPause();
  }

  resume(): void {
    this.mode = 'playing';
    this.ui.hide();
    this.inputs.clearNav();
  }

  abandon(): void {
    this.world.state = RunState.Dead;
    this.finishRun();
  }

  pick(offer: number): void {
    if (this.mode !== 'levelup') return;
    applyOffer(this.world, offer);
    this.audio.play('click', { minGap: 0 });
    if (this.world.pendingLevels > 0) {
      rollOffers(this.world);
      this.ui.showLevelUp(this.world);
    } else {
      this.mode = 'playing';
      this.ui.hide();
    }
  }

  buyMeta(i: number): void {
    const r = this.save.meta[i] ?? 0;
    const m = META[i]!;
    if (r >= m.maxRank) return;
    const cost = m.cost(r + 1);
    if (this.save.coins < cost) return;
    this.save.coins -= cost;
    this.save.meta[i] = r + 1;
    writeSave(this.save);
    this.audio.play('levelup', { minGap: 0 });
  }

  settingsChanged(s: Settings): void {
    this.save.settings = s;
    setColorblind(s.colorblind);
    applyCssPalette();
    this.audio.setVolumes(s);
    writeSave(this.save);
  }

  private finishRun(): void {
    const w = this.world;
    const coins = runCoins(w);
    const s = this.save;
    s.coins += coins;
    const isBest = w.t > s.best.time;
    if (isBest) s.best.time = w.t;
    s.best.level = Math.max(s.best.level, w.level);
    s.best.kills = Math.max(s.best.kills, w.kills);
    if (w.state === RunState.Won) s.best.wins++;
    writeSave(s);
    this.mode = 'summary';
    this.ui.showSummary(w, coins, isBest);
  }

  private handleEvents(): void {
    const w = this.world;
    const q = w.events;
    const sound = !this.demo;
    for (let k = 0; k < q.n; k++) {
      const type = q.type[k]! as Ev;
      const x = q.x[k]!, y = q.y[k]!, a = q.a[k]!, b = q.b[k]!;
      this.renderer.onEvent(w, type, x, y, a, b);
      if (!sound) continue;
      switch (type) {
        case Ev.Hit: if (b === 1) this.audio.play('hit', { pitch: 0.9 + Math.random() * 0.3 }); else this.audio.play('zap', { pitch: 0.8 + Math.random() * 0.5, vol: 0.5, minGap: 0.07 }); break;
        case Ev.Kill: this.audio.play('kill', { pitch: 1.4 - Math.min(0.8, b / 40) + Math.random() * 0.2 }); break;
        case Ev.Hurt: this.audio.play('hurt'); break;
        case Ev.LevelUp: this.audio.play('levelup', { minGap: 0.2 }); this.audio.play('levelup2', { minGap: 0.2 }); break;
        case Ev.Flash: this.audio.play('flash'); break;
        case Ev.Foghorn: this.audio.play('foghorn'); break;
        case Ev.Harpoon: this.audio.play('harpoon'); break;
        case Ev.Chain: this.audio.play('chain', { minGap: 0.1 }); break;
        case Ev.EmberPick: this.audio.play('ember', { pitch: 0.8 + Math.random() * 0.8, minGap: 0.035 }); break;
        case Ev.Spit: this.audio.play('spit'); break;
        case Ev.Surface: this.audio.play('surface'); break;
        case Ev.Split: this.audio.play('split'); break;
        case Ev.Explosion: this.audio.play('explode', { minGap: 0.08 }); break;
        case Ev.BossSpawn:
          this.audio.play('roar', { minGap: 0 });
          this.ui.banner(`${BOSSES[a | 0]!.name} rises`, 3);
          break;
        case Ev.BossAttack: this.audio.play('roar', { pitch: 1.6, vol: 0.4, minGap: 0.5 }); break;
        case Ev.BossKill: this.audio.play('bossdie', { minGap: 0 }); this.ui.banner(`${BOSSES[a | 0]!.name} falls`, 3); break;
        case Ev.Death: this.audio.play('death', { minGap: 0 }); break;
        case Ev.Victory: this.audio.play('victory', { minGap: 0 }); break;
        case Ev.FirstSeen: {
          const tip = ENEMY_TIPS[a | 0];
          if (tip) {
            this.ui.banner(tip, 5);
            if ((a | 0) === EnemyType.Ship) this.ui.flashFocus();
          }
          break;
        }
        case Ev.ProjectileBurned: this.audio.play('zap', { pitch: 1.6, minGap: 0.06 }); break;
        case Ev.Wave: this.audio.play('wave'); this.ui.banner(a === 0 ? 'They surround the rock' : 'A tide of them', 2.2); break;
      }
    }
    q.clear();
  }

  frame(): void {
    const now = performance.now();
    const frameMs = now - this.lastFrame;
    this.lastFrame = now;
    const realDt = Math.min(this.app.ticker.deltaMS / 1000, 0.25);
    this.inputs.poll();

    // menu / ui navigation
    for (let a = this.inputs.takeNav(); a; a = this.inputs.takeNav()) {
      if (this.mode === 'playing' && a === 'pause') { this.pause(); continue; }
      this.ui.handleNav(a);
    }

    const w = this.world;
    const C = CONFIG.sim;
    const running = this.mode === 'playing' || this.mode === 'menu' || this.mode === 'bench' || this.mode === 'ending';
    if (running) {
      let scale = 1;
      if (w.slowmo > 0) {
        w.slowmo -= realDt;
        scale = CONFIG.juice.bossKillSlowmo;
      }
      if (this.mode === 'ending') scale = 0.35;
      this.acc += realDt * scale;
      let steps = 0;
      const simStart = performance.now();
      const cx = this.app.screen.width / 2, cy = this.app.screen.height / 2;
      while (this.acc >= C.dt && steps < C.maxStepsPerFrame) {
        if (w.pendingLevels > 0) {
          if (this.demo || autoplay || this.mode === 'bench') {
            while (w.pendingLevels > 0) { rollOffers(w); applyOffer(w, botPick(w)); }
          } else if (this.mode === 'playing') {
            rollOffers(w);
            this.mode = 'levelup';
            this.ui.showLevelUp(w);
            this.acc = 0;
            break;
          }
        }
        if (this.demo || autoplay || this.mode === 'bench') botInput(w, this.input);
        else this.inputs.fill(this.input, cx, cy, steps === 0);
        step(w, this.input);
        this.acc -= C.dt;
        steps++;
      }
      if (steps >= C.maxStepsPerFrame) this.acc = 0;
      this.simMs = performance.now() - simStart;
      this.stepsThisFrame = steps;
    }
    const alpha = running ? Math.min(1, this.acc / C.dt) : 1;

    this.handleEvents();

    // end of run
    if (w.state !== RunState.Running) {
      if (this.demo) {
        this.world = createWorld({ seed: (Math.random() * 1e9) >>> 0, meta: META_FULL });
      } else if (this.mode === 'playing') {
        this.mode = 'ending';
        this.endTimer = 2.2;
      } else if (this.mode === 'ending') {
        this.endTimer -= realDt;
        if (this.endTimer <= 0) this.finishRun();
      }
    }

    const st = this.save.settings;
    const drawStart = performance.now();
    this.renderer.draw(this.world, alpha, realDt, { shake: st.shake, crt: st.crt, lighting: lightingOn });
    this.drawMs = performance.now() - drawStart;
    if (!this.demo) this.ui.updateHud(this.world);

    const hook = window.__LH;
    hook.mode = this.mode;
    hook.level = this.world.level;
    hook.t = this.world.t;
    hook.hp = this.world.hp;
    hook.kills = this.world.kills;
    hook.enemies = this.world.enemies.pool.count;
    hook.running = this.world.state === RunState.Running && (this.mode === 'playing' || this.mode === 'levelup' || this.mode === 'bench');
    hook.frames++;

    if (this.mode === 'bench') this.benchSample(frameMs, performance.now() - now, realDt);
  }

  private benchSample(frameMs: number, workMs: number, dt: number): void {
    const B = CONFIG.bench;
    this.benchT += dt;
    if (this.benchT < B.warmup) {
      this.ui.benchText(`bench: warming up (${this.world.enemies.pool.count} enemies)`);
      return;
    }
    if (window.__LH.bench) return;
    this.benchFrames.push(frameMs);
    this.benchWork.push(workMs);
    if (this.stepsThisFrame > 0) this.benchSim.push(this.simMs / this.stepsThisFrame);
    this.benchDraw.push(this.drawMs);
    this.benchSteps += this.stepsThisFrame;
    const elapsed = this.benchT - B.warmup;
    this.ui.benchText(`bench: ${this.world.enemies.pool.count} enemies · ${elapsed.toFixed(1)}s / ${B.duration}s · ${(1000 / frameMs).toFixed(0)} fps`);
    if (elapsed >= B.duration) {
      const stats = (a: number[]) => {
        const s = [...a].sort((x, y) => x - y);
        const avg = a.reduce((p, c) => p + c, 0) / a.length;
        return { avg, p95: s[Math.floor(s.length * 0.95)] ?? 0 };
      };
      const f = stats(this.benchFrames), wk = stats(this.benchWork);
      const res = {
        enemies: this.world.enemies.pool.count, frames: this.benchFrames.length,
        avgFrameMs: +f.avg.toFixed(2), p95FrameMs: +f.p95.toFixed(2),
        avgWorkMs: +wk.avg.toFixed(2), p95WorkMs: +wk.p95.toFixed(2), fps: +(1000 / f.avg).toFixed(1),
        avgSimTickMs: +stats(this.benchSim).avg.toFixed(2), p95SimTickMs: +stats(this.benchSim).p95.toFixed(2),
        avgDrawMs: +stats(this.benchDraw).avg.toFixed(2), p95DrawMs: +stats(this.benchDraw).p95.toFixed(2),
        stepsPerFrame: +(this.benchSteps / this.benchFrames.length).toFixed(2),
      };
      window.__LH.bench = res;
      console.log('[bench]', JSON.stringify(res));
      this.ui.benchText(`bench done: ${res.enemies} enemies · avg ${res.avgFrameMs}ms · p95 ${res.p95FrameMs}ms · work avg ${res.avgWorkMs}ms p95 ${res.p95WorkMs}ms`);
    }
  }
}

async function boot(): Promise<void> {
  const save = loadSave();
  setColorblind(save.settings.colorblind);
  applyCssPalette();
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: palette.darkness,
    antialias,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
  });
  document.getElementById('game')!.appendChild(app.canvas);
  const renderer = new GameRenderer(app);
  app.renderer.on('resize', () => renderer.resize());
  const inputs = new InputManager(app.canvas);
  const audio = new Audio();
  audio.setVolumes(save.settings);
  inputs.onGesture = () => audio.start();

  let game: Game | null = null;
  const ui = new UI({
    start: () => game!.startRun(),
    resume: () => game!.resume(),
    abandon: () => game!.abandon(),
    toMenu: () => game!.toMenu(),
    pick: (o) => game!.pick(o),
    buyMeta: (i) => game!.buyMeta(i),
    settingsChanged: (s) => game!.settingsChanged(s),
    click: () => audio.play('click'),
  }, save);
  game = new Game(app, renderer, inputs, audio, ui, save);

  if (benchN > 0) game.startBench(benchN);
  else if (autoplay) game.startRun();
  else {
    ui.showHud(false);
    ui.showMenu();
  }
  document.getElementById('loading')?.remove();
  if (params.get('prof') === '1') {
    // debug: time the CPU side of frame() vs the renderer's submit
    const orig = app.render.bind(app);
    const acc = { frame: 0, render: 0, n: 0 };
    app.render = () => { const t = performance.now(); orig(); acc.render += performance.now() - t; };
    const g = game;
    const of = g.frame.bind(g);
    g.frame = () => { const t = performance.now(); of(); acc.frame += performance.now() - t; acc.n++; };
    (window as unknown as { __prof: typeof acc }).__prof = acc;
  }
  app.ticker.add(() => game!.frame());
  window.addEventListener('blur', () => game!.pause());
}

void boot();
