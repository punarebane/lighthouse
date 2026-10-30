import type { Stats } from '../sim/stats';

/** Permanent upgrades bought with coins on the main menu. */
export interface MetaDef {
  id: string;
  name: string;
  desc: (rank: number) => string;
  maxRank: number;
  /** cost of buying rank r (1-based) */
  cost: (rank: number) => number;
  apply: (s: Stats, rank: number) => void;
}

const cost = (base: number) => (r: number) => Math.round(base * (1 + (r - 1) * 0.8));

export const META: MetaDef[] = [
  { id: 'm_hp', name: 'Stone Foundation', maxRank: 5, cost: cost(30),
    desc: (r) => `+${r * 10} max HP`, apply: (s, r) => { s.hpMax += r * 10; } },
  { id: 'm_dmg', name: 'Polished Mirror', maxRank: 5, cost: cost(40),
    desc: (r) => `+${r * 5}% beam damage`, apply: (s, r) => { s.beamDpsMult += r * 0.05; } },
  { id: 'm_xp', name: "Keeper's Logbook", maxRank: 5, cost: cost(35),
    desc: (r) => `+${r * 6}% ember value`, apply: (s, r) => { s.xpMult += r * 0.06; } },
  { id: 'm_rot', name: 'Greased Bearings', maxRank: 5, cost: cost(20),
    desc: (r) => `+${r * 8}% beam turn speed`, apply: (s, r) => { s.rotSpeed *= 1 + r * 0.08; } },
  { id: 'm_regen', name: 'Herbal Tea', maxRank: 5, cost: cost(35),
    desc: (r) => `+${(r * 0.2).toFixed(1)} HP/s regeneration`, apply: (s, r) => { s.regen += r * 0.2; } },
  { id: 'm_coin', name: 'Salvage Rights', maxRank: 5, cost: cost(25),
    desc: (r) => `+${r * 10}% coins per run`, apply: (s, r) => { s.coinMult += r * 0.1; } },
  { id: 'm_range', name: 'Taller Tower', maxRank: 5, cost: cost(30),
    desc: (r) => `+${r * 5}% beam range`, apply: (s, r) => { s.beamRangeMult += r * 0.05; } },
  { id: 'm_armour', name: 'Mortar & Pitch', maxRank: 5, cost: cost(40),
    desc: (r) => `${r * 4}% less damage taken`, apply: (s, r) => { s.armour = 1 - (1 - s.armour) * (1 - r * 0.04); } },
];

export const META_FULL: number[] = META.map((m) => m.maxRank);
export const META_NONE: number[] = META.map(() => 0);
