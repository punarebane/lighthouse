# Progress

## Done
All four milestones (M1–M4) are implemented and their acceptance checks pass, except the 60fps frame-time target, which cannot be measured meaningfully in this container (see Performance).

- **M1** core sim: lighthouse, beam cone with focus, director with threat budget + seeded RNG, embers, levelling, death screen, `?bench=N`.
- **M2** darkness lighting pass (render texture + multiply), juice (trauma shake, hit flash, pooled damage numbers, ember sparkle, low-HP flicker, boss-kill slow-mo, CRT vignette, synthesised SFX + sea/wind ambience), all 8 enemy types, 3 bosses, 20 upgrades + 4 evolutions, gamepad.
- **M3** main menu with attract-mode bot game behind it, keeper's upgrades shop (8 meta upgrades x 5 ranks, coins), settings (master/effects/ambience volume, screen shake, colour-blind palette, CRT), pause, run summary (time, level, kills by type, damage by source, build, coins).
- **M4** `scripts/sim.ts` bot harness + balance pass, `ITCH.md`, screenshots, `release/lighthouse-itch.zip` (`npm run package`).

## Acceptance checks (last run 2026-10-30)
- **Vitest** `npm test`: 21 tests pass — cone maths (wrap at ±π, zero width, range boundary, edge inclusivity), spatial hash circle + cone queries vs brute force (randomised, 40 trials x 50–60 queries), pool reuse/churn, director determinism (same seed → same spawn log, independent of play; whole bot run reproducible).
- **Playwright** `npm run e2e`: 3 tests pass — `?seed=1&autoplay=1` still running after 30s at level ≥ 3 with zero console errors; menu → shop → settings → manual run → level-up card → pause → summary with zero console errors; bench reports stats. Screenshots in `screenshots/`.
- **Balance** `npm run sim -- 200` (full output in `reports/balance.txt`, JSON in `reports/balance.json`):

| | median survival | p10 / p25 / p75 / p90 | reached 15:00 | killed final boss |
|---|---|---|---|---|
| bot, no meta (target median 6–9 min) | **8:48** | 5:34 / 5:36 / 10:40 / 12:29 | 0.5% | 0.5% |
| bot, full meta (target 30–60% reach 15:00) | 15:00 | 12:58 / 13:46 / 15:00 / 15:00 | **52.5%** | 44.5% |

  (Re-run after playtest fixes on 2026-10-30.) No-meta deaths cluster at the Leviathan (5:00) and the Kraken (10:00). Most picked: Brighter Wick, Harpoon Turret, Long Throw, Rear Lamp, Wide Lens. Least picked: Whale Oil, Ember Magnet, Cold Light, Hearth Glow (the bot's fixed priority list puts these last), and the Thunder Lanterns / Wildfire evolutions (rarely completed). Damage taken comes almost entirely from shielded ships and bosses; the bot's aim makes fodder harmless, so humans will find minutes 0–5 harder than the bot does.

## Performance
`?bench=5000` in headless Chromium 1243 (SwiftShader software GL, 4-core container), 10s after 1.5s warm-up:

| viewport | enemies | avg frame | p95 frame | sim tick avg / p95 | draw (CPU) avg / p95 | fps |
|---|---|---|---|---|---|---|
| 1280x720 | 5000 | 210 ms | 361 ms | 5.65 / 10.3 ms | 6.9 / 16.1 ms | 4.8 |
| 320x180 | 5000 | 35.7 ms | 61.4 ms | 4.3 / 8.7 ms | 4.4 / 9.9 ms | 28 |
| 1280x720 | 1000 | 140 ms | 252 ms | 1.07 / 2.1 ms | 2.4 / 5.9 ms | 7.2 |

Frame time scales with viewport area, not enemy count: it is bound by SwiftShader's software rasterisation, so these numbers say nothing about a real GPU. The CPU side (one 60Hz sim tick + building the draw) is ~9–12 ms at 5,000 enemies here, which fits a 16.7 ms frame on average but not at p95 in this container. Headless node (`npx tsx scripts/benchSim.ts 5000`): 2.8 ms per sim tick. **Not yet verified on a real mid-range laptop with a GPU** — run `?bench=5000` in desktop Chrome to check the 60fps target.

Optimisations made: separation scans capped at 24 neighbour candidates (sim tick 5.3 → 2.8 ms in node), typed-array `subarray` views removed from the tick, particle colours written packed and only when changed.

### Allocation (Chrome sampling heap profiler, `scripts/allocProfile.mjs`)
- Normal play (`?seed=1&autoplay=1`, 15s): **~1.1 KB allocated per frame in total**, mostly Pixi's ticker/renderer internals. All `src/sim` + `src/core` files together: ~15 KB over 751 ticks (~20 B/tick). Reports: `reports/alloc-autoplay.txt`.
- Bench 5,000 (`reports/alloc-bench.txt`): ~15 KB/frame, mostly inside `PartPool.add` / Pixi Particle setters and V8 HeapNumber boxing of doubles; sim files ~70 KB over 303 ticks.
- The sim creates no objects, arrays or closures per tick (all state in fixed typed arrays, scratch query buffers on the World, free-list pools). What the sampler still attributes to sim files is V8 boxing doubles passed to non-inlined functions (e.g. `damageEnemy(w, i, amount)`), plus offer rolling on level-up (by design, not per frame).

## State
- Repo is local (no remote was configured for the project); shipped as zips in project files.
- `main` is runnable: `npm install && npm run dev`.

## Known bugs / rough edges
- Wide beams use a y-scaled wedge texture, so the arc end of a very wide beam is slightly elliptical.
- Sound is silent until the first key/mouse/gamepad press (browser autoplay policy).
- Damage numbers overlap in dense fights (by design they are pooled to 256).
- On narrow portrait windows the menu title can overflow (mobile is out of scope).
- The bot ignores Ember Magnet / Cold Light / Hearth Glow, so their balance is untested by the harness.

## Playtest 1 (Sander, died before 5:00 to "unstoppable things")
- The beam now burns enemy projectiles (`projectileBurnTime`), the narrow-beam threshold for shields dropped 0.72 → 0.65, deflected beams throw blue sparks, and each enemy type shows a one-line tip the first time it appears (the ship tip also pulses the focus meter). Late-game threat/HP raised to keep the bot targets.

## Next up
- Measure `?bench=5000` on a real mid-range laptop with a GPU and record it here.
- Human playtests of minutes 0–5 (the bot finds them trivial) and of Ships (the main damage source).
- Optional: smarter bot that values defensive picks, to get balance data on the unpicked upgrades.
