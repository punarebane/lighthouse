import { CONFIG } from '../data/config';
import { approachAngle, clamp, wrapAngle } from '../core/math';
import { Ev } from './events';
import { RunState, World, xpForLevel, type SimInput } from './world';
import { updateDirector } from './director';
import { updateEnemies, respawnBench } from './enemies';
import { beamPass } from './beam';
import { updateWeapons, updateProjectiles } from './weapons';
import { updateEmbers } from './embers';

export function createWorld(opts: ConstructorParameters<typeof World>[0]): World {
  const w = new World(opts);
  for (let k = 0; k < w.bench; k++) respawnBench(w);
  return w;
}

function copyPrev(x: Float32Array, y: Float32Array, px: Float32Array, py: Float32Array, hi: number): void {
  for (let i = 0; i < hi; i++) {
    px[i] = x[i]!;
    py[i] = y[i]!;
  }
}

function savePrev(w: World): void {
  const E = w.enemies, P = w.projectiles, M = w.embers;
  copyPrev(E.x, E.y, E.px, E.py, E.pool.hi);
  copyPrev(P.x, P.y, P.px, P.py, P.pool.hi);
  copyPrev(M.x, M.y, M.px, M.py, M.pool.hi);
  w.prevBeamAngle = w.beamAngle;
  w.prevSweepAngle = w.sweepAngle;
  w.prevDronePhase = w.dronePhase;
}

function updatePlayer(w: World, input: SimInput, dt: number): void {
  const s = w.stats;
  const maxStep = s.rotSpeed * dt;
  if (input.aimMode === 0) w.beamAngle = approachAngle(w.beamAngle, input.targetAngle, maxStep);
  else w.beamAngle = wrapAngle(w.beamAngle + clamp(input.turn, -1, 1) * maxStep);
  if (input.focusTarget >= 0) {
    const step = CONFIG.beam.focusRate * dt;
    const d = input.focusTarget - w.focus;
    w.focus += Math.abs(d) <= step ? d : Math.sign(d) * step;
  } else {
    w.focus += input.focusDelta;
  }
  w.focus = clamp(w.focus, 0, 1);
  if (s.thirdBeam > 0) w.sweepAngle = wrapAngle(w.sweepAngle + s.thirdBeamSpeed * dt);
  if (s.drones > 0) w.dronePhase = wrapAngle(w.dronePhase + s.droneSpeed * dt);
  if (s.regen > 0 && w.hp > 0) w.hp = Math.min(s.hpMax, w.hp + s.regen * dt);
  if (w.hurtT > 0) w.hurtT -= dt;
}

/**
 * Advance the simulation by one fixed tick (CONFIG.sim.dt). Does nothing while a level-up
 * choice is pending or the run is over. The caller drains w.events after each frame.
 */
export function step(w: World, input: SimInput): void {
  if (w.state !== RunState.Running || w.pendingLevels > 0) return;
  const dt = CONFIG.sim.dt;
  savePrev(w);
  w.t += dt;
  w.tick++;
  if (!w.noDirector) updateDirector(w, dt);
  updatePlayer(w, input, dt);
  const E = w.enemies;
  w.hash.rebuild(E.x, E.y, E.pool.alive, E.pool.hi);
  beamPass(w, dt);
  updateWeapons(w, dt);
  updateProjectiles(w, dt);
  updateEnemies(w, dt);
  updateEmbers(w, dt);
  while (w.xp >= w.xpNext) {
    w.xp -= w.xpNext;
    w.level++;
    w.xpNext = xpForLevel(w.level);
    w.pendingLevels++;
    w.events.push(Ev.LevelUp, 0, 0, w.level);
  }
  if (E.pool.count > w.peakEnemies) w.peakEnemies = E.pool.count;
}
