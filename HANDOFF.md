# HANDOFF

Session-to-session state note. Refresh at the end of each working
session; delete sections that stop being true. Permanent facts belong in
CLAUDE.md, not here.

## Where we are (2026-07-07)

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

## Key decisions this session

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

## Known loose ends / natural next steps

- The owner is play-testing on real devices; expect a tuning pass on
  `CW.config` (Tuning Office → Copy JSON → bake into config.js DEFAULTS)
  and a finish designed in the Drawing Office (Carbon Copy → bake into
  theme.js THEME_DEFAULTS) once settled.
- Branch shape: `main` is the stable production branch, created
  2026-07-07 from this session's final state. The owner is flipping two
  one-time settings: GitHub default branch → `main` (so new sessions
  branch from current code) and Netlify production branch → `main` (so
  deploys track it). Until both are flipped, treat `main` as the source
  of truth anyway.
- Nice-to-haves discussed but not built: `_redirects` entry for a clean
  `/design` URL.
