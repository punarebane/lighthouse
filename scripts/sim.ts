/**
 * Headless balance harness. Runs the real sim with the auto-play bot for N seeded runs,
 * without and with full meta upgrades, across worker threads.
 *
 *   npx tsx scripts/sim.ts [runs=200] [--json out.json]
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { writeFileSync } from 'node:fs';
import { createWorld, step } from '../src/sim/sim';
import { makeInput, rollOffers, applyOffer, RunState } from '../src/sim/world';
import { botInput, botPick } from '../src/sim/bot';
import { META_FULL, META_NONE } from '../src/data/meta';
import { UPGRADES, EVOLUTIONS } from '../src/data/upgrades';
import { CONFIG, ENEMIES } from '../src/data/config';

interface RunResult {
  seed: number;
  t: number;
  won: boolean;
  level: number;
  kills: number;
  bosses: number;
  picks: number[];
  taken: number[];
}

function runOne(seed: number, full: boolean): RunResult {
  const w = createWorld({ seed, meta: full ? META_FULL : META_NONE });
  const inp = makeInput();
  const limit = CONFIG.sim.runLength + 240;
  while (w.state === RunState.Running && w.t < limit) {
    if (w.pendingLevels > 0) {
      rollOffers(w);
      applyOffer(w, botPick(w));
      continue;
    }
    botInput(w, inp);
    step(w, inp);
    w.events.clear();
  }
  return {
    seed, t: w.t, won: w.state === RunState.Won, level: w.level, kills: w.kills, bosses: w.bossesKilled,
    picks: Array.from(w.pickCounts), taken: Array.from(w.damageTakenBy),
  };
}

if (!isMainThread) {
  const { seeds, full } = workerData as { seeds: number[]; full: boolean };
  const out = seeds.map((s) => runOne(s, full));
  parentPort!.postMessage(out);
} else {
  const args = process.argv.slice(2);
  const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
  const jsonIdx = args.indexOf('--json');
  const only = args.includes('--none') ? [false] : args.includes('--full') ? [true] : [false, true];
  const threads = Math.max(1, cpus().length);

  const runBatch = (full: boolean): Promise<RunResult[]> => {
    const seeds = Array.from({ length: runs }, (_, i) => i + 1);
    const chunks: number[][] = Array.from({ length: threads }, () => []);
    seeds.forEach((s, i) => chunks[i % threads]!.push(s));
    return Promise.all(chunks.filter((c) => c.length).map((c) => new Promise<RunResult[]>((res, rej) => {
      const wk = new Worker(new URL('./simWorker.mjs', import.meta.url), { workerData: { seeds: c, full } });
      wk.on('message', res);
      wk.on('error', rej);
    }))).then((r) => r.flat().sort((a, b) => a.seed - b.seed));
  };

  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const report = (label: string, rs: RunResult[]): Record<string, unknown> => {
    const times = rs.map((r) => (r.won ? CONFIG.sim.runLength : r.t)).sort((a, b) => a - b);
    const q = (p: number) => times[Math.min(times.length - 1, Math.floor(p * times.length))]!;
    const wins = rs.filter((r) => r.won).length;
    const reached15 = rs.filter((r) => r.won || r.t >= CONFIG.sim.runLength).length;
    const hist = new Array(17).fill(0);
    for (const r of rs) hist[r.won ? 16 : Math.min(15, Math.floor(r.t / 60))]++;
    const nPick = UPGRADES.length + EVOLUTIONS.length;
    const picks = new Array(nPick).fill(0);
    for (const r of rs) r.picks.forEach((v, i) => (picks[i] += v));
    const names = [...UPGRADES.map((u) => u.name), ...EVOLUTIONS.map((e) => e.name + ' (evo)')];
    const order = picks.map((v, i) => [names[i]!, v] as const).sort((a, b) => b[1] - a[1]);
    const taken = new Array(9).fill(0);
    for (const r of rs) r.taken.forEach((v, i) => (taken[i] += v));
    const takenNames = [...ENEMIES.map((e) => e.name), 'Projectiles'];
    console.log(`\n=== ${label}: ${rs.length} runs ===`);
    console.log(`survival median ${fmt(q(0.5))}  p10 ${fmt(q(0.1))}  p25 ${fmt(q(0.25))}  p75 ${fmt(q(0.75))}  p90 ${fmt(q(0.9))}`);
    console.log(`won (killed the 15:00 boss): ${wins} (${((wins / rs.length) * 100).toFixed(1)}%)   reached 15:00: ${reached15} (${((reached15 / rs.length) * 100).toFixed(1)}%)`);
    console.log('deaths by minute:');
    hist.forEach((c, m) => { if (c) console.log(`  ${m === 16 ? 'won ' : `${String(m).padStart(2)}m `} ${'#'.repeat(Math.ceil((c / rs.length) * 60))} ${c}`); });
    console.log(`mean level ${(rs.reduce((a, r) => a + r.level, 0) / rs.length).toFixed(1)}, mean bosses killed ${(rs.reduce((a, r) => a + r.bosses, 0) / rs.length).toFixed(2)}`);
    console.log('most picked: ' + order.slice(0, 5).map(([n, v]) => `${n} ${v}`).join(', '));
    console.log('least picked: ' + order.slice(-5).map(([n, v]) => `${n} ${v}`).join(', '));
    console.log('damage taken from: ' + taken.map((v, i) => [takenNames[i], v] as const).sort((a, b) => b[1] - a[1]).filter((x) => x[1] > 0).map(([n, v]) => `${n} ${Math.round(v / rs.length)}`).join(', ') + ' (per run)');
    return { label, runs: rs.length, median: q(0.5), p10: q(0.1), p25: q(0.25), p75: q(0.75), p90: q(0.9), wins, reached15, hist, picks: Object.fromEntries(order), takenPerRun: Object.fromEntries(taken.map((v, i) => [takenNames[i], Math.round(v / rs.length)])) };
  };

  const t0 = Date.now();
  const out: Record<string, unknown>[] = [];
  for (const full of only) {
    const rs = await runBatch(full);
    out.push(report(full ? 'Bot WITH full meta upgrades' : 'Bot WITHOUT meta upgrades', rs));
  }
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s on ${threads} threads)`);
  if (jsonIdx >= 0 && args[jsonIdx + 1]) writeFileSync(args[jsonIdx + 1]!, JSON.stringify(out, null, 2));
}
