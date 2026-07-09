# HANDOFF

Session-to-session state note. Refresh at the end of each working
session; delete sections that stop being true. Permanent facts belong in
CLAUDE.md, not here.

## Where we are (2026-07-07, session 2 wrap-up)

The game is feature-complete and deployed via Netlify (static, no build):

- Full Mini Metro-style loop: corridor drawing/editing grammar (mouse +
  touch), typed cargo with multi-source BFS routing, starvation fail
  state, weekly reviews, score/best, sound, phone landscape support.
- Distinct visual identity: stylised planets, container freighters with
  pod barges, twin-rail conduits, functional nebula hazards with relay
  beacons, engineering-drawing chart aesthetic.
- Balance defaults were set by automated Playwright playtests (bot
  survives ~16–23 days; target 25–45+ for humans). Not yet validated by
  real human play.
- Two hidden editor apps work end-to-end: the Tuning Office (gameplay,
  in-game panel) and the Drawing Office (`design.html`, appearance).
  Themes file to localStorage and restyle the game on next load. Three
  house styles ship: Blueprint, Gaslight, Signal Room.

## Key decisions (carried forward)

- All visual constants moved out of render.js into `CW.theme`
  (js/theme.js); renderer re-reads the theme every frame. Never
  hard-code visuals in render.js again — add theme keys.
- Balance retuned generously after playtests showed day-9 deaths with
  the original numbers (reserves 115→220s, production roughly halved,
  ships 72→92 speed). Rationale: gentle first two weeks, pressure from
  week 3.
- The Drawing Office uses the real sim + renderer on a scripted showcase
  scene rather than mock objects, so previews can never drift from the
  actual game.
- Project continuity system established: CLAUDE.md (permanent facts, read
  automatically) + HANDOFF.md (session state) + commit-per-milestone +
  `main` as the production branch.

## Session 2026-07-09: the Planetary Works, in the game proper

- `planets.html` + `js/planetgen.js` (procedural planet generator with
  five mergeable style finishes) shipped and were merged to `main`
  earlier in the session at the owner's request.
- The game now draws every colony as a generated world (owner-approved
  recipe: Realistic/Magical/Survey Ink in equal thirds, axis variation
  100%). Integration lives in render.js (`ensureWorld`/`drawPlanet`);
  recipe + toggle are theme keys under the "Generated Worlds" drawer.
  Spawn variety guard: no archetype repeats within the last three
  spawnings. Commons never have rings; designated colonies always do,
  including when `transformColony` industrialises one in place.
- Second round of preview feedback: the consignment ring sits further
  out (cargoRingIn 24) and every colony now wears an identical freight
  band — two faint lines, waiting crates adrift and evenly spaced
  between them, the outer line doubling as the reserve/distress gauge
  (ringGap is retired from the schema, kept in defaults for saved-theme
  compat). Colony glyphs are thinner (glyphLine 1.9).
- Owner preview feedback, all addressed: worlds vary in stature
  (`worldSizeVar`), the heavy small-radius outline is gone, shimmer is
  boosted (`worldShimmer`), worlds are typecast to the cargo they lack
  (`TYPE_WORLDS` in render.js), and hull cargo rides a six-berth
  consignment ring around each vessel (`cargoRing*` theme keys; pod
  barges keep their deck containers).
- Naming overlap to resolve someday: `patterns.html` is "The Pattern
  Book" and the planets app's style-mixer drawer is also headed "THE
  PATTERN BOOK — house finishes". Owner aware; rename offer open.

## Infra state

- `main` exists on GitHub as the production branch, created from this
  session's final commit. GitHub default branch and Netlify production
  branch were being switched to `main` at end of session (owner action,
  in the GitHub + Netlify web UIs). If a new session sees the default
  branch is still a `claude/*` branch, the switch may not have completed
  — confirm with the owner.
- Day-to-day work happens on the session's `claude/*` branch; merge into
  `main` only when the owner asks to publish. Merging `main` triggers the
  Netlify redeploy.

## Known loose ends / natural next steps

- Real-device play-testing is the main open thread. Expect a tuning pass
  on `CW.config` (Tuning Office → Copy JSON → bake into config.js
  DEFAULTS) and/or a finish designed in the Drawing Office (Carbon Copy →
  bake into theme.js THEME_DEFAULTS) once the owner settles on values.
  Re-verify balance with the Playwright bot after any config change.
- Nice-to-haves discussed but not built: `_redirects` entry for a clean
  `/design` URL (instead of `/design.html`).
- No PR has been opened; work has gone straight to branches. Owner has
  not requested PRs.
