import type { Stats } from '../sim/stats';

/**
 * Data-driven upgrades. Each has 5 levels; `apply(stats, level)` adds the effect of
 * having the upgrade at `level` (1..5) on top of base stats. Values per level are in `v`.
 */
export interface UpgradeDef {
  id: string;
  name: string;
  /** short description at a given level (1-based) */
  desc: (level: number) => string;
  maxLevel: number;
  apply: (s: Stats, level: number) => void;
  /** relative weight in offers */
  weight: number;
  icon: string;
}

export interface EvolutionDef {
  id: string;
  name: string;
  desc: string;
  requires: [string, string];
  apply: (s: Stats) => void;
  icon: string;
}

const at = (arr: number[], level: number): number => arr[Math.min(level, arr.length) - 1] ?? 0;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

const V = {
  width: [0.15, 0.3, 0.45, 0.6, 0.8],
  range: [0.12, 0.24, 0.36, 0.48, 0.62],
  rot: [0.25, 0.5, 0.75, 1.0, 1.3],
  intensity: [0.2, 0.4, 0.6, 0.85, 1.1],
  second: [0.35, 0.45, 0.55, 0.65, 0.8],
  third: [0.3, 0.38, 0.46, 0.55, 0.65],
  thirdSpeed: [0.9, 1.0, 1.1, 1.25, 1.4],
  flashCd: [12, 11, 10, 9, 7.5],
  flashStun: [1.0, 1.3, 1.6, 1.9, 2.3],
  flashDmg: [10, 16, 24, 32, 45],
  harpoonCd: [1.5, 1.35, 1.2, 1.05, 0.9],
  harpoonDmg: [28, 36, 46, 58, 72],
  harpoonCount: [1, 1, 2, 2, 3],
  harpoonPierce: [1, 2, 2, 3, 3],
  chainCd: [2.0, 1.8, 1.6, 1.4, 1.1],
  chainDmg: [16, 22, 28, 36, 46],
  chainJumps: [3, 4, 5, 6, 8],
  burnDps: [5, 8, 11, 15, 20],
  burnTime: [2, 2.5, 3, 3.5, 4],
  drones: [1, 2, 2, 3, 4],
  droneDps: [14, 18, 24, 30, 38],
  droneLight: [48, 52, 56, 62, 68],
  fogCd: [7, 6.5, 6, 5.5, 4.5],
  fogRadius: [200, 230, 260, 290, 330],
  fogForce: [260, 300, 340, 380, 440],
  fogDmg: [8, 12, 16, 22, 30],
  magnet: [70, 110, 150, 200, 260],
  emberSpeed: [0.2, 0.4, 0.6, 0.8, 1.0],
  armour: [0.1, 0.18, 0.26, 0.33, 0.4],
  regen: [0.4, 0.8, 1.2, 1.7, 2.3],
  hp: [20, 40, 60, 85, 110],
  glowR: [20, 40, 60, 80, 105],
  glowDps: [6, 10, 15, 20, 26],
  lens: [0.25, 0.5, 0.75, 1.0, 1.35],
  oil: [0.12, 0.24, 0.36, 0.5, 0.65],
  frost: [0.12, 0.2, 0.28, 0.35, 0.42],
};

export const UPGRADES: UpgradeDef[] = [
  { id: 'width', name: 'Wide Lens', icon: '◁', weight: 10, maxLevel: 5,
    desc: (l) => `Beam is ${pct(at(V.width, l))} wider.`,
    apply: (s, l) => { s.beamWidthMult += at(V.width, l); } },
  { id: 'range', name: 'Long Throw', icon: '⟶', weight: 10, maxLevel: 5,
    desc: (l) => `Beam reaches ${pct(at(V.range, l))} further.`,
    apply: (s, l) => { s.beamRangeMult += at(V.range, l); } },
  { id: 'rotation', name: 'Oiled Gears', icon: '↻', weight: 8, maxLevel: 5,
    desc: (l) => `Beam turns ${pct(at(V.rot, l))} faster.`,
    apply: (s, l) => { s.rotSpeed *= 1 + at(V.rot, l); } },
  { id: 'intensity', name: 'Brighter Wick', icon: '✹', weight: 10, maxLevel: 5,
    desc: (l) => `Beam damage +${pct(at(V.intensity, l))}.`,
    apply: (s, l) => { s.beamDpsMult += at(V.intensity, l); } },
  { id: 'second', name: 'Rear Lamp', icon: '⇄', weight: 7, maxLevel: 5,
    desc: (l) => `A second beam points the opposite way at ${pct(at(V.second, l))} strength.`,
    apply: (s, l) => { s.secondBeam = at(V.second, l); } },
  { id: 'third', name: 'Sweeping Lamp', icon: '✲', weight: 7, maxLevel: 5,
    desc: (l) => `A third beam sweeps around on its own at ${pct(at(V.third, l))} strength.`,
    apply: (s, l) => { s.thirdBeam = at(V.third, l); s.thirdBeamSpeed = at(V.thirdSpeed, l); } },
  { id: 'flash', name: 'Flash', icon: '✦', weight: 7, maxLevel: 5,
    desc: (l) => `Every ${at(V.flashCd, l)}s a nova stuns everything for ${at(V.flashStun, l)}s and deals ${at(V.flashDmg, l)}.`,
    apply: (s, l) => { s.flashCd = at(V.flashCd, l); s.flashStun = at(V.flashStun, l); s.flashDamage = at(V.flashDmg, l); } },
  { id: 'harpoon', name: 'Harpoon Turret', icon: '➹', weight: 8, maxLevel: 5,
    desc: (l) => `Fires ${at(V.harpoonCount, l)} harpoon(s) at the nearest enemy every ${at(V.harpoonCd, l)}s for ${at(V.harpoonDmg, l)}, piercing ${at(V.harpoonPierce, l)}.`,
    apply: (s, l) => { s.harpoonCd = at(V.harpoonCd, l); s.harpoonDamage = at(V.harpoonDmg, l); s.harpoonCount = at(V.harpoonCount, l); s.harpoonPierce = at(V.harpoonPierce, l); } },
  { id: 'chain', name: 'Chain Lightning', icon: 'ϟ', weight: 7, maxLevel: 5,
    desc: (l) => `Every ${at(V.chainCd, l)}s lightning arcs between ${at(V.chainJumps, l)} lit enemies for ${at(V.chainDmg, l)}.`,
    apply: (s, l) => { s.chainCd = at(V.chainCd, l); s.chainDamage = at(V.chainDmg, l); s.chainJumps = at(V.chainJumps, l); s.chainRange = 150; } },
  { id: 'burn', name: 'Burning Light', icon: '♨', weight: 7, maxLevel: 5,
    desc: (l) => `Lit enemies burn for ${at(V.burnDps, l)}/s, lasting ${at(V.burnTime, l)}s after leaving the beam.`,
    apply: (s, l) => { s.burnDps = at(V.burnDps, l); s.burnTime = at(V.burnTime, l); } },
  { id: 'drones', name: 'Lantern Drones', icon: '◎', weight: 7, maxLevel: 5,
    desc: (l) => `${at(V.drones, l)} lantern drone(s) orbit the rock, lighting and burning for ${at(V.droneDps, l)}/s.`,
    apply: (s, l) => { s.drones = at(V.drones, l); s.droneDps = at(V.droneDps, l); s.droneLight = at(V.droneLight, l); s.droneRadius = 170; s.droneSpeed = 1.3; } },
  { id: 'foghorn', name: 'Fog Horn', icon: '◉', weight: 7, maxLevel: 5,
    desc: (l) => `Every ${at(V.fogCd, l)}s a blast knocks back everything within ${at(V.fogRadius, l)} and deals ${at(V.fogDmg, l)}.`,
    apply: (s, l) => { s.foghornCd = at(V.fogCd, l); s.foghornRadius = at(V.fogRadius, l); s.foghornForce = at(V.fogForce, l); s.foghornDamage = at(V.fogDmg, l); } },
  { id: 'magnet', name: 'Ember Magnet', icon: '⊛', weight: 6, maxLevel: 5,
    desc: (l) => `Embers within ${at(V.magnet, l)} drift in even unlit; embers move ${pct(at(V.emberSpeed, l))} faster.`,
    apply: (s, l) => { s.magnetRadius = at(V.magnet, l); s.emberSpeedMult += at(V.emberSpeed, l); } },
  { id: 'armour', name: 'Granite Plating', icon: '⛨', weight: 6, maxLevel: 5,
    desc: (l) => `Take ${pct(at(V.armour, l))} less damage.`,
    apply: (s, l) => { s.armour = 1 - (1 - s.armour) * (1 - at(V.armour, l)); } },
  { id: 'regen', name: "Keeper's Mending", icon: '✚', weight: 6, maxLevel: 5,
    desc: (l) => `Regenerate ${at(V.regen, l)} HP per second.`,
    apply: (s, l) => { s.regen += at(V.regen, l); } },
  { id: 'hp', name: 'Thick Walls', icon: '▲', weight: 6, maxLevel: 5,
    desc: (l) => `+${at(V.hp, l)} max HP.`,
    apply: (s, l) => { s.hpMax += at(V.hp, l); } },
  { id: 'glow', name: 'Hearth Glow', icon: '☼', weight: 6, maxLevel: 5,
    desc: (l) => `Glow around the rock +${at(V.glowR, l)} radius and scorches for ${at(V.glowDps, l)}/s.`,
    apply: (s, l) => { s.glowRadius += at(V.glowR, l); s.glowDps = at(V.glowDps, l); } },
  { id: 'lens', name: 'Fresnel Lens', icon: '◈', weight: 6, maxLevel: 5,
    desc: (l) => `Up to +${pct(at(V.lens, l))} damage on the beam's centre line.`,
    apply: (s, l) => { s.lensBonus = at(V.lens, l); } },
  { id: 'oil', name: 'Whale Oil', icon: '♦', weight: 6, maxLevel: 5,
    desc: (l) => `Embers are worth ${pct(at(V.oil, l))} more.`,
    apply: (s, l) => { s.xpMult += at(V.oil, l); } },
  { id: 'frost', name: 'Cold Light', icon: '❄', weight: 6, maxLevel: 5,
    desc: (l) => `Lit enemies are slowed by ${pct(at(V.frost, l))}.`,
    apply: (s, l) => { s.frost = at(V.frost, l); } },
];

export const EVOLUTIONS: EvolutionDef[] = [
  { id: 'twinSuns', name: 'Twin Suns', icon: '☯', requires: ['second', 'intensity'],
    desc: 'The rear beam burns at full strength and both beams deal +40% damage.',
    apply: (s) => { s.twinSuns = true; s.secondBeam = 1; s.beamDpsMult *= 1.4; } },
  { id: 'thunderLanterns', name: 'Thunder Lanterns', icon: '⚡', requires: ['drones', 'chain'],
    desc: 'Drones throw chain lightning, and lightning jumps twice as far.',
    apply: (s) => { s.thunderLanterns = true; s.chainRange *= 2; s.chainJumps += 4; } },
  { id: 'wildfire', name: 'Wildfire', icon: '🔥', requires: ['burn', 'flash'],
    desc: 'Flash sets everything on screen ablaze; burning doubles in strength.',
    apply: (s) => { s.wildfire = true; s.burnDps *= 2; s.flashCd *= 0.75; } },
  { id: 'ballista', name: 'Storm Ballista', icon: '⇶', requires: ['harpoon', 'range'],
    desc: 'Harpoons pierce everything, fire three times as many, and explode.',
    apply: (s) => { s.ballista = true; s.harpoonCount *= 3; s.harpoonPierce = 999; } },
];

export const UPGRADE_INDEX: Record<string, number> = Object.fromEntries(UPGRADES.map((u, i) => [u.id, i]));
