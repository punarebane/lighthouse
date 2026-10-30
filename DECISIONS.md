# Decisions

Ambiguities in SPEC.md and the simplest choice made for each.

## Controls and beam
- **Rotation speed applies to every aim device.** Mouse and right stick set a *target* angle; the beam turns toward it at `rotSpeed` (rad/s). A/D and the left stick turn at that rate directly. This makes the rotation-speed upgrade matter for mouse players too.
- **Focus** is a single 0..1 value (0 = wide, 1 = narrow). Half-width and a DPS multiplier are both lerped from it (`CONFIG.beam`). Wheel steps 0.1 per notch; W/S and the triggers change it continuously.
- **"Narrow beam" for shielded ships** means focus >= `CONFIG.beam.shieldFocus` (0.72), not an absolute angle, so the Wide Lens upgrade doesn't lock players out of hurting ships. The HUD focus knob turns blue and ship shields fade when the beam is narrow enough.
- Shields block **all** non-beam damage (harpoons bounce, chain lightning skips them, burn is not applied). The rear beam counts as narrow if the main beam is (it shares the focus); the sweeping third beam has a fixed medium focus and never pierces shields.
- **Damage falloff**: `1 - falloff * (d/range)^2`, so the beam still does 45% at the tip.

## Enemies
- Non-boss enemies that reach the rock deal their contact damage once and die (no ember). Bosses stop at the rock and deal contact damage per second.
- Burrowers are invisible *and* untargetable until they surface within `burrowRevealRadius`.
- The 8th enemy type is "Boss", with three variants (Leviathan 5:00, Kraken 10:00, Drowned Maw 15:00). Earlier bosses that are not killed stay on the field.
- Jellies split into 2 smaller jellies, up to generation 2.
- Spitters stop at `spitterHoldRange` and shoot slow projectiles at the rock; the fog horn clears enemy projectiles in its radius.

## Director
- The director rolls every random number from its own seeded stream and always rolls, even when a spawn is refused (enemy cap), so **the spawn sequence is a pure function of the seed** regardless of play. Boss-time "lulls" are fixed time windows, not "while a boss is alive", for the same reason. A Vitest test checks this.
- Enemy HP scales with time via `CONFIG.director.hpCurve`.
- Hard cap of `maxEnemies` (900) live enemies outside bench mode.

- The threat budget drops to 0 at 15:00: dawn is a duel with the Drowned Maw rather than a wall of fodder.

## Balance
- Balance targets are judged by `scripts/sim.ts` (200 seeds each). "Reaches 15 minutes" is counted as survived to 15:00 (50.5% with full meta); killing the final boss (the win condition) is reported separately (40%).
- The bot aims at the threat-weighted densest angular bin within range (smoothed by the beam width, with hysteresis), narrows the beam when shielded targets dominate the window, and picks upgrades from a fixed priority list (evolutions first).

## Progression
- Offers: evolutions that are ready always appear first; otherwise weighted random from non-maxed upgrades (owned ones x1.5 weight). If everything is maxed the card is "Patch the walls" (heal 30%).
- Evolutions (4): Twin Suns (Rear Lamp + Brighter Wick), Thunder Lanterns (Lantern Drones + Chain Lightning), Wildfire (Burning Light + Flash), Storm Ballista (Harpoon Turret + Long Throw).
- 20 upgrades: the 15 named in the spec plus Thick Walls (max HP), Hearth Glow (glow radius + damage), Fresnel Lens (centre-line bonus), Whale Oil (ember value), Cold Light (slow lit enemies).
- Embers also drift home when inside the rock's glow radius (they are "lit" by it) and within the Ember Magnet radius. Embers expire after 90s.
- Meta upgrades: 8, five ranks each, bought with coins on the main menu. Coins = time/8 + kills/25 + boss bounties, times the coin multiplier.

## Tech
- Light textures (cone, radial glow, vignette, sea) are drawn with canvas 2D gradients at startup because Graphics has no cheap soft radial falloff; creature textures are generated from Graphics as the spec asks.
- The cone light sprite is a 45 degree wedge texture whose y-scale sets the half-width (`tan(hw)/tan(45deg)`). This distorts the arc end slightly into an ellipse; it's invisible in play.
- The light map renders at half the screen resolution (lights are soft) and is composited with `multiply`. A faint additive copy of each cone is drawn above the darkness as "haze".
- Eyes, embers, projectiles, sparks and damage numbers render *above* the darkness so they read in the dark; creature bodies render below it.
- Bosses use 3 plain Sprites (never more than a few alive); every other enemy type has its own ParticleContainer.
- Damage numbers use a digit atlas in one ParticleContainer (no Text objects). Continuous damage is accumulated per enemy and emitted every 0.3s.
- Particles: `PartPool` reuses Particle objects and writes the packed colour directly (the `tint` setter parses colours every call).
- `maxStepsPerFrame` is 8 so the sim keeps real time down to ~8 fps (headless SwiftShader runs slowly).
- UI (menus, HUD) is DOM over the canvas; colours come from `palette.ts` via CSS variables.
- Audio is a small zzfx-style synth written for this project (`src/audio/synth.ts`); the AudioContext starts on the first user gesture, so autoplay/headless runs are silent and error-free.
- Playwright is pinned to 1.63.0 to match the Chromium build preinstalled in the dev container.
- No git remote was available for the project, so the repo is local and shipped as a zip in project files.
