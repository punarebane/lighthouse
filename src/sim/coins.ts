import { BOSSES, CONFIG } from '../data/config';
import type { World } from './world';

/** Coins earned by a finished run. */
export function runCoins(w: World): number {
  const M = CONFIG.meta;
  let c = w.t * M.coinsPerSecond + w.kills * M.coinsPerKill;
  for (let b = 0; b < w.bossesKilled && b < BOSSES.length; b++) c += BOSSES[b]!.coins;
  return Math.floor(c * w.stats.coinMult);
}
