import { ambientBed, SAMPLE_RATE, synth, type SynthParams } from './synth';

const DEFS: Record<string, SynthParams> = {
  zap: { freq: 880, shape: 2, attack: 0.001, sustain: 0.02, release: 0.06, slide: -6000, vol: 0.18, bitCrush: 2 },
  hit: { freq: 300, shape: 4, attack: 0.001, sustain: 0.01, release: 0.06, slide: -1500, vol: 0.22 },
  kill: { freq: 520, shape: 1, attack: 0.001, sustain: 0.02, release: 0.12, slide: -2400, vol: 0.25, noise: 0.05 },
  hurt: { freq: 140, shape: 3, attack: 0.002, sustain: 0.06, release: 0.2, slide: -260, vol: 0.32, bitCrush: 6, noise: 0.2 },
  levelup: { freq: 440, shape: 1, attack: 0.01, sustain: 0.18, release: 0.3, pitchJump: 220, pitchJumpTime: 0.08, tremolo: 0.5, tremoloFreq: 16, vol: 0.32, sustainVol: 0.8 },
  levelup2: { freq: 660, shape: 0, attack: 0.01, sustain: 0.15, release: 0.35, pitchJump: 330, pitchJumpTime: 0.1, vol: 0.25 },
  roar: { freq: 70, shape: 2, attack: 0.15, sustain: 0.9, release: 0.8, slide: -20, noise: 0.35, tremolo: 0.6, tremoloFreq: 11, vol: 0.55, bitCrush: 3 },
  flash: { freq: 1800, shape: 4, attack: 0.001, sustain: 0.05, release: 0.4, slide: -3000, vol: 0.3 },
  foghorn: { freq: 92, shape: 1, attack: 0.08, sustain: 0.6, release: 0.5, vol: 0.55, tremolo: 0.15, tremoloFreq: 5, sustainVol: 0.9 },
  harpoon: { freq: 900, shape: 4, attack: 0.002, sustain: 0.03, release: 0.1, slide: -5000, vol: 0.18 },
  chain: { freq: 2400, shape: 4, attack: 0.001, sustain: 0.08, release: 0.1, bitCrush: 8, noise: 0.6, vol: 0.2 },
  ember: { freq: 1200, shape: 0, attack: 0.001, sustain: 0.01, release: 0.06, slide: 3000, vol: 0.08 },
  spit: { freq: 380, shape: 1, attack: 0.005, sustain: 0.03, release: 0.08, slide: 1200, vol: 0.14 },
  surface: { freq: 120, shape: 4, attack: 0.01, sustain: 0.1, release: 0.25, slide: -100, vol: 0.3 },
  split: { freq: 600, shape: 0, attack: 0.002, sustain: 0.03, release: 0.12, pitchJump: -300, pitchJumpTime: 0.03, vol: 0.18 },
  explode: { freq: 90, shape: 4, attack: 0.002, sustain: 0.06, release: 0.3, slide: -60, vol: 0.35 },
  bossdie: { freq: 180, shape: 2, attack: 0.01, sustain: 0.6, release: 1.4, slide: -90, noise: 0.4, vol: 0.5, bitCrush: 4 },
  death: { freq: 330, shape: 1, attack: 0.01, sustain: 0.5, release: 1.2, slide: -200, vol: 0.4, tremolo: 0.4, tremoloFreq: 6 },
  victory: { freq: 523, shape: 1, attack: 0.02, sustain: 0.5, release: 0.8, pitchJump: 261, pitchJumpTime: 0.25, vol: 0.35 },
  click: { freq: 1000, shape: 0, attack: 0.001, sustain: 0.01, release: 0.03, vol: 0.12 },
  wave: { freq: 200, shape: 4, attack: 0.3, sustain: 0.6, release: 0.8, slide: -60, vol: 0.3 },
};

export type SfxName = keyof typeof DEFS;

/** Lazily-started Web Audio graph: master -> (sfx, ambience). Created on first user gesture. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly lastPlayed = new Map<string, number>();
  private volumes = { master: 0.8, sfx: 0.8, ambience: 0.6 };

  get started(): boolean {
    return this.ctx !== null;
  }

  /** Call from a user gesture. */
  start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.master.connect(ctx.destination);
    this.applyVolumes();
    for (const [k, def] of Object.entries(DEFS)) this.buffers.set(k, this.toBuffer(synth(def)));
    this.startAmbience();
  }

  private toBuffer(data: Float32Array): AudioBuffer {
    const b = this.ctx!.createBuffer(1, data.length, SAMPLE_RATE);
    b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    return b;
  }

  private startAmbience(): void {
    const ctx = this.ctx!;
    const waves = ctx.createBufferSource();
    waves.buffer = this.toBuffer(ambientBed(9, 'waves'));
    waves.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const wg = ctx.createGain();
    wg.gain.value = 0.9;
    waves.connect(lp).connect(wg).connect(this.amb);
    waves.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.toBuffer(ambientBed(11, 'wind'));
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(bp.frequency);
    lfo.start();
    const windG = ctx.createGain();
    windG.gain.value = 0.35;
    wind.connect(bp).connect(windG).connect(this.amb);
    wind.start();
  }

  setVolumes(v: { master: number; sfx: number; ambience: number }): void {
    this.volumes = { ...v };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfx.gain.value = this.volumes.sfx;
    this.amb.gain.value = this.volumes.ambience * 0.5;
  }

  /** Play a sound; rate-limited per name so swarms don't clip. */
  play(name: SfxName, opts?: { pitch?: number; vol?: number; minGap?: number }): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = opts?.minGap ?? 0.045;
    if (now - (this.lastPlayed.get(name) ?? -1) < gap) return;
    this.lastPlayed.set(name, now);
    const buf = this.buffers.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts?.pitch ?? 1;
    if (opts?.vol !== undefined && opts.vol !== 1) {
      const g = ctx.createGain();
      g.gain.value = opts.vol;
      src.connect(g).connect(this.sfx);
    } else {
      src.connect(this.sfx);
    }
    src.start();
  }
}
