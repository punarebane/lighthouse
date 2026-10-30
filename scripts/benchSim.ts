// Headless timing of the sim alone in bench mode (no rendering).
import { createWorld, step } from '../src/sim/sim';
import { makeInput, rollOffers, applyOffer } from '../src/sim/world';
import { botInput, botPick } from '../src/sim/bot';
import { CONFIG } from '../src/data/config';

const n = Number(process.argv[2] ?? 5000);
const w = createWorld({ seed: 1, bench: n });
const inp = makeInput();
const times: number[] = [];
for (let k = 0; k < 60 * 12; k++) {
  if (w.pendingLevels > 0) { rollOffers(w); applyOffer(w, botPick(w)); }
  const t0 = performance.now();
  botInput(w, inp);
  step(w, inp);
  w.events.clear();
  if (k >= 120) times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`sim tick with ${w.enemies.pool.count} enemies: avg ${avg.toFixed(3)}ms p95 ${times[Math.floor(times.length * 0.95)]!.toFixed(3)}ms (dt budget ${(CONFIG.sim.dt * 1000).toFixed(1)}ms)`);
