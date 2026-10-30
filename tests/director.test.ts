import { describe, expect, it } from 'vitest';
import { World, makeInput, rollOffers, applyOffer, RunState } from '../src/sim/world';
import { updateDirector } from '../src/sim/director';
import { createWorld, step } from '../src/sim/sim';
import { botInput, botPick } from '../src/sim/bot';
import { CONFIG } from '../src/data/config';

function spawnLog(seed: number, seconds: number): number[] {
  const w = new World({ seed });
  w.spawnLog = [];
  const dt = CONFIG.sim.dt;
  for (let t = 0; t < seconds * 60; t++) {
    w.t += dt;
    updateDirector(w, dt);
  }
  return w.spawnLog;
}

describe('director', () => {
  it('produces the same spawn sequence for the same seed', () => {
    const a = spawnLog(123, 600);
    const b = spawnLog(123, 600);
    expect(a.length).toBeGreaterThan(400);
    expect(a).toEqual(b);
  });

  it('produces different spawns for different seeds', () => {
    expect(spawnLog(1, 120)).not.toEqual(spawnLog(2, 120));
  });

  it('spawn sequence does not depend on how the player plays', () => {
    // one run with the bot, one where the player never moves; same seed, compare first 90s of spawn rolls
    const run = (useBot: boolean) => {
      const w = createWorld({ seed: 77 });
      w.spawnLog = [];
      const inp = makeInput();
      while (w.t < 90 && w.state === RunState.Running) {
        if (w.pendingLevels > 0) { rollOffers(w); applyOffer(w, botPick(w)); }
        if (useBot) botInput(w, inp);
        step(w, inp);
        w.events.clear();
      }
      return w.spawnLog.filter((_, i) => w.spawnLog![i - (i % 4)]! < 90 * 60);
    };
    const a = run(true), b = run(false);
    const n = Math.min(a.length, b.length);
    expect(n).toBeGreaterThan(100);
    expect(a.slice(0, n)).toEqual(b.slice(0, n));
  });

  it('a whole bot run is deterministic', () => {
    const run = () => {
      const w = createWorld({ seed: 9 });
      const inp = makeInput();
      while (w.t < 120 && w.state === RunState.Running) {
        if (w.pendingLevels > 0) { rollOffers(w); applyOffer(w, botPick(w)); }
        botInput(w, inp);
        step(w, inp);
        w.events.clear();
      }
      return [w.t, w.kills, w.level, w.hp, w.xp, Array.from(w.upgradeLevels).join(',')];
    };
    expect(run()).toEqual(run());
  });
});
