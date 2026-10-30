# Lighthouse

You are the last lighthouse. Aim the light, survive 15 minutes. Vite + TypeScript (strict) + PixiJS v8.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest: cone maths, spatial hash vs brute force, pools, director determinism
npm run e2e          # Playwright: autoplay smoke test, menus, bench (builds + previews on :4173)
npm run sim -- 200   # headless balance harness: 200 seeded bot runs without and with full meta
npm run build && npm run package   # release/lighthouse-itch.zip for itch.io
```

URL parameters: `?seed=123` (reproduce a run's spawns), `?autoplay=1` (the bot plays), `?bench=5000` (benchmark: 5,000 enemies, logs `[bench]` frame stats after 10s), `?ff=300` (debug: fast-forward 300s with the bot), `?light=0` (debug: no lighting pass).

## Layout
- `src/data/` all tuning (`config.ts`), colours (`palette.ts`), upgrades (`upgrades.ts`), meta upgrades (`meta.ts`)
- `src/core/` seeded RNG, angle maths, free-list `Pool`, uniform-grid `SpatialHash`
- `src/sim/` the headless simulation: SoA stores, director, enemies, beam/light pass, weapons, embers, bot. No Pixi imports, so it runs in Node.
- `src/render/` Pixi renderer: per-type ParticleContainers, lighting render texture, pooled fx
- `src/audio/` zzfx-style synth and ambience; `src/input/` mouse/keys/gamepad; `src/game/` DOM UI and save
- `scripts/sim.ts` balance harness, `scripts/allocProfile.mjs` Chromium allocation sampling, `scripts/screenshots.mjs`

See `SPEC.md`, `PROGRESS.md` and `DECISIONS.md`.
