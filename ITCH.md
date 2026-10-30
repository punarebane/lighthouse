# Lighthouse: itch.io upload kit

## Files
- **Game upload:** `release/lighthouse-itch.zip` (`npm run build && npm run package`), about 195 KB, with `index.html` at the root
- **Cover image:** `release/itch/cover-630x500.png` (2x version: `cover-1260x1000.png`; itch accepts either, same 315:250 ratio) (`node scripts/cover.mjs`)
- **Screenshots:** `screenshots/gameplay-early.png`, `gameplay-leviathan.png`, `gameplay-kraken.png`, `gameplay-late.png`, `colorblind-crt.png`, `menu.png`, `levelup.png` (`node scripts/screenshots.mjs`)

## Project settings (Dashboard → Create new project)
| Field | Value |
|---|---|
| Title | Lighthouse |
| Project URL | `lighthouse` (or `last-lighthouse` if taken) |
| Short description / tagline | You are the last lighthouse. Aim the light and hold back the night sea until dawn. |
| Classification | Games |
| Kind of project | **HTML** |
| Release status | Released (or "Prototype" while you're still playtesting) |
| Pricing | No payments, or "Donate" with a suggested amount |
| Uploads | `lighthouse-itch.zip`, tick **This file will be played in the browser** |
| Embed options | Viewport **1280 × 720**, tick **Click to launch in fullscreen** off, tick **Fullscreen button** on; leave **Mobile friendly** off (no touch controls); **Automatically start on page load** off |
| Frame options | Tick **SharedArrayBuffer support** off (not needed); scrollbars off |
| Genre | Action |
| Tags (up to 10) | `bullet-hell`, `roguelite`, `survival`, `arcade`, `top-down`, `dark`, `atmospheric`, `upgrades`, `gamepad`, `singleplayer` |
| App store links / community | Comments on |
| Visibility | **Draft** first, check the embed, then Public |

Under "Metadata": Inputs = Keyboard, Mouse, Xbox controller, Playstation controller. Accessibility = Color-blind friendly, Configurable controls is *not* accurate (keys are fixed), so leave that unticked. Average session = "About a half-hour". Languages = English.

## Description (paste into the page body)

**You are the last lighthouse.**

Things crawl out of the night sea toward your rock. You can't move. You can only aim the light.

Sweep your beam across the dark water and burn back what's coming. Narrow the beam to burn hard, widen it to cover more. Outside the light there is only the night, and the eyes in it.

**Survive fifteen minutes. Then face what rises at dawn.**

- **One beam, two choices.** Aim with the mouse or a stick, and trade width for intensity with the wheel or triggers.
- **Eight kinds of horror.** Swarmers, armoured crabs, darting eels, jellies that split, spitters that shoot from the dark, burrowers you can't see coming, and ships behind shields that only a focused beam breaks quickly.
- **Three bosses** at 5, 10 and 15 minutes.
- **Embers only come home in the light.** Everything you kill drops embers, but they only drift back to the rock while your beam is on them.
- **20 upgrades, 5 levels each:** a rear lamp, a sweeping third beam, harpoon turrets, chain lightning, burning light, lantern drones, fog horns, a flash nova and more. Max out the right pair to unlock one of **4 evolutions**.
- **Keeper's upgrades.** Every run earns coins for 8 permanent upgrades.
- Colour-blind palette, screen-shake slider, optional CRT vignette, full gamepad support.
- No downloads: the whole game, art and sound, is generated in your browser (about 200 KB).

**Controls**

| | Mouse & keyboard | Gamepad |
|---|---|---|
| Aim | Mouse, or A / D | Right stick (left stick turns) |
| Focus the beam | Mouse wheel, or W / S | RT narrows, LT widens |
| Pause | Esc or P | Start |
| Pick an upgrade | Click, or 1 / 2 / 3 | D-pad + A |

Sound starts after your first click or key press. Best played in fullscreen.

*Made with TypeScript and PixiJS.*
