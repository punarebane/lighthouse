/** All colours live here. Two palettes: default and a colour-blind-safe one (Okabe-Ito based). */

export interface Palette {
  sea: number;
  seaLit: number;
  waveLine: number;
  rock: number;
  rockEdge: number;
  tower: number;
  towerStripe: number;
  lamp: number;
  /** multiply colour of unlit areas (the night) */
  darkness: number;
  beam: number;
  glow: number;
  enemies: number[]; // indexed by EnemyType (bosses use bosses[])
  bosses: number[];
  eyes: number;
  ember: number;
  emberCore: number;
  harpoon: number;
  spit: number;
  lightning: number;
  burn: number;
  frost: number;
  shield: number;
  flash: number;
  damageText: number;
  critText: number;
  hpBar: number;
  hpBarLow: number;
  xpBar: number;
  ui: {
    bg: string;
    panel: string;
    border: string;
    text: string;
    dim: string;
    accent: string;
    accent2: string;
    danger: string;
    good: string;
  };
}

export const PALETTE_DEFAULT: Palette = {
  sea: 0x0d2433,
  seaLit: 0x5a93a8,
  waveLine: 0x3d7a8c,
  rock: 0x3b3a40,
  rockEdge: 0x5a5860,
  tower: 0xe9e4d4,
  towerStripe: 0xb8352f,
  lamp: 0xfff2b0,
  darkness: 0x0b1424,
  beam: 0xfff0b8,
  glow: 0xffd98a,
  enemies: [0x7fd36b, 0xd9603b, 0x46c3c9, 0xc77ee0, 0x9aa3b5, 0xa8d94a, 0xb88a52, 0xff4060],
  bosses: [0x3f9a8a, 0x9c3fb5, 0xc72f4a],
  eyes: 0xff4a3d,
  ember: 0xff9a3c,
  emberCore: 0xffe9a0,
  harpoon: 0xdfe6ee,
  spit: 0xb4ff4a,
  lightning: 0x9fd8ff,
  burn: 0xff7a2a,
  frost: 0xa8e6ff,
  shield: 0x7ab8ff,
  flash: 0xffffff,
  damageText: 0xffffff,
  critText: 0xffd34d,
  hpBar: 0xe8574a,
  hpBarLow: 0xff2a2a,
  xpBar: 0xffb347,
  ui: {
    bg: '#060b14',
    panel: 'rgba(12, 22, 36, 0.92)',
    border: '#2d4a63',
    text: '#e8e4d8',
    dim: '#8a9bab',
    accent: '#ffd98a',
    accent2: '#7ab8ff',
    danger: '#e8574a',
    good: '#7fd36b',
  },
};

/** Okabe-Ito derived: distinguishable under protanopia/deuteranopia/tritanopia. */
export const PALETTE_COLORBLIND: Palette = {
  ...PALETTE_DEFAULT,
  enemies: [0x56b4e9, 0xe69f00, 0x009e73, 0xcc79a7, 0xf0e442, 0x0072b2, 0xd55e00, 0xffffff],
  bosses: [0x009e73, 0xcc79a7, 0xd55e00],
  eyes: 0xf0e442,
  ember: 0xe69f00,
  spit: 0xcc79a7,
  hpBar: 0xd55e00,
  hpBarLow: 0xd55e00,
  xpBar: 0x56b4e9,
  ui: { ...PALETTE_DEFAULT.ui, danger: '#d55e00', good: '#56b4e9' },
};

export let palette: Palette = PALETTE_DEFAULT;
export function setColorblind(on: boolean): void {
  palette = on ? PALETTE_COLORBLIND : PALETTE_DEFAULT;
}

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
