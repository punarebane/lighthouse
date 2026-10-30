import { META } from '../data/meta';

export interface Settings {
  master: number;
  sfx: number;
  ambience: number;
  shake: number;
  colorblind: boolean;
  crt: boolean;
}

export interface SaveData {
  version: 1;
  coins: number;
  meta: number[];
  settings: Settings;
  best: { time: number; level: number; kills: number; wins: number };
  runs: number;
}

const KEY = 'lighthouse.save.v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
    coins: 0,
    meta: META.map(() => 0),
    settings: { master: 0.8, sfx: 0.8, ambience: 0.6, shake: 1, colorblind: false, crt: false },
    best: { time: 0, level: 0, kills: 0, wins: 0 },
    runs: 0,
  };
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...d,
      ...s,
      meta: META.map((_, i) => Math.max(0, Math.min(META[i]!.maxRank, Number(s.meta?.[i] ?? 0) || 0))),
      settings: { ...d.settings, ...(s.settings ?? {}) },
      best: { ...d.best, ...(s.best ?? {}) },
    };
  } catch {
    return d;
  }
}

export function writeSave(s: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable (private mode etc.): progress lasts for this session only
  }
}
