# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Crump & Wainwright — Interstellar Freight Services": a Mini Metro-style
real-time network-optimisation game. Draw hyperspace corridors between
colonies; automatic freighters shuttle typed cargo; a colony starving of
its one needed resource ends the game. Space-themed but deliberately NOT
Mini Metro-looking: stylised planets, twin-rail conduits, nebula hazards,
an engineering-drawing aesthetic, and the voice of a fictional Victorian
British firm (dry, institutional, lightly Hitchhiker's-Guide). Must work
on phones in landscape and on desktop.

## Running & testing

Zero dependencies, no build step, no test suite. Plain ES5-style JS in
IIFEs sharing one global `CW` namespace, loaded via script tags.

- Run: open `index.html` directly, or `python3 -m http.server 8000`.
- Further standalone entry points: `design.html` (Drawing Office,
  appearance studio), `patterns.html` (Pattern Book, asset-design
  specimens), `planets.html` (Planetary Works, planet generator).
- Deployed to Netlify as a plain static site (no build command).

Verification is done by driving the real game headlessly with Playwright.
In this remote environment the pre-installed Chromium version differs
from what npm's Playwright expects — always launch with:

```js
chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
```

(Confirm the exact `chromium-*` directory under `/opt/pw-browsers/`.)
Drive the game via `page.evaluate` using the debug/cheat surface, e.g.:

- `CW.debug.setTimeScale(8)` — fast-forward the sim (also `.colonyScreen(i)`, `.nubScreen(corIdx, end)` for pointer-gesture tests). The value multiplies `config.baseTimeScale` (default 0.25), so 8 ≈ 2× real time — use larger values for fast playtests.
- `CW.game.commitCorridorEdit(null, [colonyIds...], loop)` — build routes
- `CW.game.assignShip(cor)` / `assignPod(cor)` / `placeHub(colony)`
- `CW.game.cheat.*` — addShip/addRelay/addPod/addHub/spawnColony/spawnSpecial
- `CW.game.chooseUpgrade(kind)` — dismiss the weekly review (`phase` is
  'upgrade' while it waits; the sim is paused until chosen)
- `CW.game.invincible = true` — colonies cannot fail

Keep test scripts in the session scratchpad; they are not committed.

## Architecture

Script load order matters (globals, no modules):
`config → theme → copy → glyphs → audio → sim → render → input → ui → devpanel → main`.

**Two tunable layers, two hidden editor apps, two localStorage keys:**

| Layer | File | Editor | Storage key |
|---|---|---|---|
| Gameplay numbers (`CW.config`) | `js/config.js` | "Tuning Office" dev panel (backtick/F2, or 5 taps on the C&W monogram) | `cw_tuning_v1` |
| Visual numbers & colours (`CW.theme`) | `js/theme.js` | "Drawing Office" (`design.html` + `js/design.js`) | `cw_theme_v1` |

Both save diffs-vs-defaults only. The renderer re-reads `CW.theme` every
frame (`syncTheme()` in render.js), so never hard-code a colour or size
in render.js — add a key to `THEME_DEFAULTS` + `THEME_SCHEMA` instead.
`CW.applyTheme()` pushes palette into CSS variables and mutates
`CW.CORRIDOR_COLOURS[i].hex` in place. Adding a gameplay tunable means
`DEFAULTS` + `TUNING_SCHEMA` in config.js; the dev panel builds itself
from the schema.

**Simulation (`js/sim.js`)** is DOM-free and render-free; it talks to the
UI/audio only through the `CW.bus` event bus ('toast', 'review',
'gameover', 'sound'). `CW.createGame()` returns the whole game object.
Routing intelligence: `recomputeRouting()` runs a multi-source BFS per
cargo type into `typeDist[typeId][colonyId]` (hop counts); ships load a
crate only if their next stop strictly reduces its hop count, deliver on
type match, and offload crates that stop making progress. Starvation has
a grace hold (`graceHold`) while relief is due at the next stop.

**Drawing Office (`js/design.js`)** runs the REAL sim + renderer on a
scripted showcase scene (frozen spawning via `spawn.next = Infinity`,
`invincible`, reserves pinned each frame) — if you add a visual feature,
make sure the showcase scene exhibits it.

**Approved look (Pattern Book 2nd ed., owner's requisition, 2026-07-12):**
corridors are the *Aurora Conduit* (breathing bidirectional ribbon — never
add arrows, chevrons, particles or travelling pulses to a corridor);
vessels are the *Packet* with cargo orbiting as parchment consignment
chips; lettering is the *Typing Pool* (Courier for display and text).
All tunable via theme keys; the relay beacon predates the Pattern Book
and was deliberately kept.

**Design invariants** (from the concept docs — do not break):
- A colony never produces the cargo type it consumes.
- Crates match colony *types*, never specific colonies.
- One fail rule, one timer, for every colony tier.
- All routing intelligence lives in the player-drawn network, never in ships.
- When realism argues with elegance, elegance wins.

## Conventions

- All player-facing text lives in `js/copy.js` and speaks with the
  company voice (understated, bureaucratic, British). Never scatter copy
  through other files; never break voice ("Form L-1 is available from
  the second floor", not "Game over!").
- ES5 style throughout the game code: `var`, IIFEs, `'use strict'`, no
  modules, no transpilation, no dependencies. Keep it that way.
- Balance defaults in config.js were set by automated Playwright
  playtests (a simple bot survives ~16–23 days; humans should manage
  25–45+). Re-verify balance the same way after touching production
  rates, reserves, or fleet numbers.
- Phone support is landscape-only (portrait shows a rotate overlay);
  test layouts at ~812×375 as well as desktop sizes.

## Workflow

- Commit and push after each working milestone (verified feature, fix,
  or tuning pass) — do not batch a whole session into one commit.
- Refresh the build stamp — `CW.BUILD` at the top of `js/main.js` — to
  the current UTC date/time in any commit that changes game files. It
  shows on the start screen and in the title block so the owner can tell
  which revision is deployed; there is no build step, so it is manual.
- Session continuity: read `HANDOFF.md` at the start of a session for
  the current state, in-flight decisions and next steps. At the end of a
  session (when asked to wrap up), refresh HANDOFF.md, move any newly
  permanent facts into this file, and commit both.
- `main` is the production branch: Netlify deploys it and new sessions
  branch from it. Do day-to-day work on the session's designated
  `claude/*` branch; merge into `main` and push only when the owner
  asks to publish.
