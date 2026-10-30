// Quick single headless bot run with a per-minute trace: npx tsx scripts/quick.ts [seed] [full]
import { createWorld, step } from '../src/sim/sim';
import { makeInput, rollOffers, applyOffer, RunState } from '../src/sim/world';
import { botInput, botPick } from '../src/sim/bot';
import { META_FULL } from '../src/data/meta';
const seed = Number(process.argv[2] ?? 1);
const w = createWorld({ seed, meta: process.argv[3] === 'full' ? META_FULL : undefined });
const inp = makeInput();
const marks = new Set([600, 1200, 1800]);
while (w.state === RunState.Running && w.t < 1000) {
  if (w.pendingLevels > 0) { rollOffers(w); applyOffer(w, botPick(w)); continue; }
  botInput(w, inp); step(w, inp); w.events.clear();
  if (w.tick % 3600 === 0 || marks.has(w.tick)) console.log(`t=${w.t.toFixed(0)} hp=${w.hp.toFixed(0)}/${w.stats.hpMax} lvl=${w.level} enemies=${w.enemies.pool.count} kills=${w.kills}`);
}
console.log('end', RunState[w.state], w.t.toFixed(1), 'lvl', w.level, 'bosses', w.bossesKilled);
