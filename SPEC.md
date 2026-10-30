# PROJECT: Lighthouse

You are building a complete, shippable arcade game in this empty folder. FIRST ACTION: save this entire prompt verbatim as SPEC.md.

## Pitch
You are the last lighthouse. Things crawl out of the night sea toward your rock. You can't move. You can only aim the light. Survive 15 minutes.

## Core mechanics
- The lighthouse sits at the centre of the screen. Its beam is a cone you rotate with the mouse (aim at the cursor), the right stick, or A/D keys (with rotation speed as a stat).
- Beam focus: mouse wheel, triggers or W/S trade width against intensity. A narrow beam deals high damage per second; a wide one deals low damage but covers more. Damage applies continuously to enemies inside the cone, scaled by distance falloff.
- Darkness: everything outside the beam and a small glow radius around the rock is dark. Enemies show only as faint eyes or silhouettes. Lit enemies are fully visible.
- Enemies reaching the rock deal contact damage to the lighthouse's HP. 0 HP = game over.
- Killed enemies drop embers (XP). Embers drift to the lighthouse only while lit by the beam. Level up = pause and choose 1 of 3 upgrades.
- Upgrades (data-driven in src/data/upgrades.ts; 20 total, each with 5 levels): beam width, beam range, rotation speed, intensity, a second beam (opposite side), a rotating third beam, Flash (periodic nova that stuns everything on screen), Harpoon turret (auto-targets the nearest enemy), Chain lightning (arcs between lit enemies), Burn (lit enemies keep burning), Lantern drones (orbiting mini lights), Fog horn (knockback pulse), ember magnet, armour, regen, and more. 4 "evolutions" when two specific upgrades are both at max level.
- Enemies (8 types): swarmers, tanky crabs, fast eels, splitting jellies, shielded ships (only damaged by a narrow beam), ranged spitters, burrowers (invisible until close), and three bosses at 5, 10 and 15 minutes. Spawning is run by a director with a threat budget that ramps over time (curve in config), with scripted wave events (a ring surround, a flood from one side).
- Run ends on death or after defeating the 15-minute boss. Meta: coins earned per run buy small permanent upgrades on the main menu (8 of them).

## Tech (the learning focus)
- Vite + TypeScript (strict) + PixiJS v8. Vitest; Playwright for smoke tests.
- Data-oriented ECS-lite: enemies, projectiles, embers and damage numbers live in structure-of-arrays typed arrays (Float32Array x/y/vx/vy/hp, Uint8Array type/flags) with fixed capacity and free-list pooling. No per-frame object allocation in the hot loop; verify with the Chrome performance profiler and document the result.
- Uniform-grid spatial hash rebuilt each tick; used for the beam cone query (broad phase by grid cells overlapping the cone's bounding wedge, narrow phase by angle + distance), enemy separation (boids-style), contact checks and chain-lightning neighbour search.
- Fixed-timestep simulation at 60Hz with an accumulator; render interpolation.
- Rendering: one ParticleContainer or instanced sprite batch per enemy type, using textures generated at startup from Graphics. Darkness as a lighting pass: a render texture filled dark with the beam cone and glow radii cut out (additive light sprites), composited with a multiply blend.
- Seeded RNG for the director, so a ?seed=123 URL reproduces a run's spawns.

## Juice
Screen shake (trauma-based), hit flash, pooled damage numbers, ember sparkle, beam flicker on low HP, slow-motion on boss kill, a CRT vignette option. Synthesized SFX via a zzfx-style generator (zap, hit, level up, boss roar), with ambient waves and wind. Fully gamepad-playable.

## Milestones
Session 1
- M1 Core sim: lighthouse, beam cone, three enemy types, director, embers, levelling with 8 upgrades, death screen. Benchmark mode.
- M2 Darkness lighting pass, juice, all 8 enemies, bosses, 20 upgrades and evolutions.
Session 2
- M3 Meta upgrades, main menu, settings (volume, screen shake, colour-blind palette), pause, run summary with stats.
- M4 Balance pass using an auto-play bot (below), feel polish, and ship: itch.io zip, ITCH.md, screenshots.

## Auto-play bot (for balance)
scripts/sim.ts runs the core sim headless at high speed. The bot aims at the densest enemy cluster within range and picks upgrades by a fixed priority list. 200 seeded runs. Report the death-time distribution and the most and least picked upgrades. Target: the bot without meta upgrades survives a median of 6-9 minutes; with full meta upgrades it reaches 15 minutes in 30-60% of runs.

## Acceptance checks
- Vitest: cone intersection maths (edge cases: angle wrap at ±π, zero width, beam range boundary), spatial hash queries against brute force (randomised property test), pool reuse, director determinism.
- Performance: ?bench=5000 spawns 5,000 enemies; log the frame-time average and p95 over 10s. Target: 60fps (p95 under 16.7ms) on a mid-range laptop in Chrome. Report the numbers measured in headless Chromium in PROGRESS.md.
- Balance targets met.
- Playwright: start a run with ?seed=1&autoplay=1, wait 30s, assert the game is still running and the level is 3 or higher; zero console errors; screenshots.

## Out of scope
Mobile touch controls, online leaderboards, story.

## Working protocol
- Work autonomously. Don't stop to ask; when something is ambiguous, choose the simplest option that fits this spec and log it in DECISIONS.md.
- Start of every session: read SPEC.md, PROGRESS.md and DECISIONS.md; continue from "Next up".
- Commit after each milestone. Keep main runnable at all times.
- A milestone is done only when its acceptance checks pass.
- End of session, or when context runs long: update PROGRESS.md (done / state / known bugs / next up) and commit.
- All tuning values go in src/data/config.ts; all colours go in src/data/palette.ts.
