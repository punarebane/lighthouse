import { CONFIG, EnemyType } from '../data/config';
import { UPGRADES } from '../data/upgrades';
import { TAU, wrapAngle } from '../core/math';
import { EF_BURROWED } from './stores';
import { beamRange, mainHalfWidth } from './beam';
import { isShielded } from './enemies';
import { OFFER_EVO, OFFER_HEAL, type SimInput, type World } from './world';

/** Fixed upgrade priority list for the auto-play bot (first match among the offers wins). */
export const BOT_PRIORITY: string[] = [
  'intensity', 'harpoon', 'second', 'range', 'width', 'burn', 'chain', 'drones', 'third',
  'lens', 'flash', 'foghorn', 'armour', 'hp', 'regen', 'rotation', 'glow', 'oil', 'magnet', 'frost',
];
let PRIORITY_RANK = rankFor(BOT_PRIORITY);
function rankFor(list: string[]): number[] {
  return UPGRADES.map((u) => {
    const r = list.indexOf(u.id);
    return r < 0 ? 99 : r;
  });
}
/** Swap the bot's upgrade priority list (balance experiments). */
export function setBotPriority(list: string[]): void {
  PRIORITY_RANK = rankFor(list);
}

const BINS = 72;
const hist = new Float32Array(BINS);
const shieldHist = new Float32Array(BINS);

/**
 * Aim at the densest (threat-weighted) cluster within range: an angular histogram of
 * enemies, smoothed by the beam's width, with closer enemies weighted up. Narrows the
 * beam when shielded targets (ships, Maw) are in the chosen window.
 */
export function botInput(w: World, out: SimInput): void {
  const E = w.enemies;
  hist.fill(0);
  shieldHist.fill(0);
  const range = beamRange(w) * 1.05;
  const urgent = CONFIG.lighthouse.rockRadius + 140;
  const r2 = range * range;
  for (let i = 0; i < E.pool.hi; i++) {
    if (!E.pool.alive[i] || (E.flags[i]! & EF_BURROWED)) continue;
    const x = E.x[i]!, y = E.y[i]!;
    const d2 = x * x + y * y;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2);
    let wgt = 1 + 3 * (1 - d / range);
    if (d < urgent) wgt *= 3;
    const type = E.type[i]!;
    if (type === EnemyType.Boss) wgt *= 6;
    else if (type === EnemyType.Crab || type === EnemyType.Ship) wgt *= 2;
    const a = Math.atan2(y, x);
    const b = ((Math.floor(((a + Math.PI) / TAU) * BINS) % BINS) + BINS) % BINS;
    hist[b]! += wgt;
    if (isShielded(w, i)) shieldHist[b]! += wgt;
  }
  // smoothing window = current beam half-width in bins
  const half = Math.max(1, Math.round((mainHalfWidth(w, w.focus) / TAU) * BINS));
  const cur = ((Math.floor(((w.beamAngle + Math.PI) / TAU) * BINS) % BINS) + BINS) % BINS;
  const secondFrac = w.stats.secondBeam;
  let best = -1, bestV = 0, bestShield = 0;
  for (let b = 0; b < BINS; b++) {
    let v = 0, sv = 0;
    for (let o = -half; o <= half; o++) {
      const k = (b + o + BINS) % BINS;
      v += hist[k]!;
      sv += shieldHist[k]!;
      if (secondFrac > 0) v += hist[(k + BINS / 2) % BINS]! * secondFrac;
    }
    // hysteresis: prefer staying near the current direction
    const dist = Math.abs(((b - cur + BINS + BINS / 2) % BINS) - BINS / 2);
    v *= 1 + 0.25 * Math.max(0, 1 - dist / 6);
    if (v > bestV) { bestV = v; best = b; bestShield = sv; }
  }
  out.aimMode = 0;
  out.turn = 0;
  out.focusDelta = 0;
  if (best < 0) {
    out.targetAngle = w.beamAngle;
    out.focusTarget = 0.5;
    return;
  }
  out.targetAngle = wrapAngle(((best + 0.5) / BINS) * TAU - Math.PI);
  out.focusTarget = bestShield > bestV * 0.25 ? 0.85 : 0.5;
}

/** Choose among the current offers using the fixed priority list (evolutions first). */
export function botPick(w: World): number {
  let bestOffer = w.offers[0]!;
  let bestRank = 1e9;
  for (let k = 0; k < w.offers.length; k++) {
    const o = w.offers[k]!;
    if (o < 0) continue;
    let rank: number;
    if (o >= OFFER_HEAL) rank = 1000;
    else if (o >= OFFER_EVO) rank = -1;
    else rank = PRIORITY_RANK[o]!;
    if (rank < bestRank) { bestRank = rank; bestOffer = o; }
  }
  return bestOffer;
}
