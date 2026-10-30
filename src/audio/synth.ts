/**
 * A zzfx-style procedural sound generator: one oscillator with an ADSR-ish envelope,
 * frequency slide, pitch jump, frequency noise, bit-crush and tremolo, rendered to a
 * Float32Array once at startup. Not zzfx's code, but the same parameter idea.
 */
export interface SynthParams {
  vol?: number;
  freq: number;
  attack?: number;
  sustain?: number;
  release?: number;
  /** 0 sine, 1 triangle, 2 saw, 3 square, 4 noise */
  shape?: number;
  /** Hz per second */
  slide?: number;
  deltaSlide?: number;
  pitchJump?: number;
  pitchJumpTime?: number;
  /** random frequency jitter 0..1 */
  noise?: number;
  /** hold every n samples */
  bitCrush?: number;
  tremolo?: number;
  tremoloFreq?: number;
  sustainVol?: number;
}

export const SAMPLE_RATE = 44100;

export function synth(p: SynthParams, rand: () => number = Math.random): Float32Array {
  const sr = SAMPLE_RATE;
  const attack = p.attack ?? 0.01, sustain = p.sustain ?? 0.1, release = p.release ?? 0.1;
  const len = Math.max(1, Math.floor((attack + sustain + release) * sr));
  const out = new Float32Array(len);
  const shape = p.shape ?? 0;
  const vol = p.vol ?? 0.5;
  let f = p.freq;
  let slide = p.slide ?? 0;
  const dSlide = p.deltaSlide ?? 0;
  let jumped = false;
  let phase = 0;
  let held = 0;
  let noiseVal = 0;
  let lastCycle = -1;
  const crush = Math.max(1, p.bitCrush ?? 1);
  const sv = p.sustainVol ?? 1;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let env: number;
    if (t < attack) env = t / attack;
    else if (t < attack + sustain) env = 1 - (1 - sv) * ((t - attack) / sustain);
    else env = sv * Math.pow(1 - (t - attack - sustain) / release, 2);
    f += slide / sr;
    slide += dSlide / sr;
    if (!jumped && p.pitchJump && t >= (p.pitchJumpTime ?? 0)) {
      f += p.pitchJump;
      jumped = true;
    }
    const fr = Math.max(1, f * (1 + (p.noise ?? 0) * (rand() * 2 - 1)));
    phase += fr / sr;
    const ph = phase % 1;
    let s: number;
    switch (shape) {
      case 1: s = 1 - 4 * Math.abs(ph - 0.5); break;
      case 2: s = 2 * ph - 1; break;
      case 3: s = ph < 0.5 ? 1 : -1; break;
      case 4: {
        const cyc = Math.floor(phase * 8);
        if (cyc !== lastCycle) { noiseVal = rand() * 2 - 1; lastCycle = cyc; }
        s = noiseVal;
        break;
      }
      default: s = Math.sin(ph * Math.PI * 2);
    }
    if (p.tremolo) s *= 1 - p.tremolo * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (p.tremoloFreq ?? 8)));
    if (i % crush === 0) held = s;
    out[i] = held * env * vol;
  }
  return out;
}

/** Seamless looping noise bed with slow swells (sea waves) or gusts (wind). */
export function ambientBed(seconds: number, kind: 'waves' | 'wind', rand: () => number = Math.random): Float32Array {
  const sr = SAMPLE_RATE;
  const n = Math.floor(seconds * sr);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;
  for (let i = 0; i < n; i++) {
    const white = rand() * 2 - 1;
    let v: number;
    if (kind === 'waves') {
      brown = (brown + 0.02 * white) / 1.02;
      v = brown * 3.5;
    } else {
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0527;
      v = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }
    const t = i / n;
    const env = kind === 'waves'
      ? 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI * 3), 2)
      : 0.4 + 0.3 * Math.sin(t * Math.PI * 2 * 2) + 0.3 * Math.pow(Math.sin(t * Math.PI * 2 * 5 + 1), 2);
    out[i] = v * env;
  }
  // crossfade the ends so the loop is seamless
  const fade = Math.floor(sr * 0.5);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    const a = out[i]!, b = out[n - fade + i]!;
    out[i] = a * k + b * (1 - k);
  }
  return out.subarray(0, n - fade);
}
