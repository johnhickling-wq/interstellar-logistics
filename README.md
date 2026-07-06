# Crump & Wainwright — Interstellar Freight Services

*Connecting frontier worlds since 1896.*

A minimalist, real-time network-optimisation game in the Mini Metro idiom,
operated on behalf of Crump & Wainwright, an old engineering firm that simply
never stopped growing. You are the duty officer of an Interstellar Logistics
Command terminal: draw hyperspace corridors between colonies, and keep every
colony supplied with the one thing it cannot produce.

No build step, no dependencies. Plain HTML/CSS/JS + Canvas.

## Running it

Open `index.html` directly in a browser, or serve the folder:

```
python3 -m http.server 8000
# or: npx serve
```

Works on desktop browsers and on phones **in landscape** (portrait shows a
polite request to rotate). Add to home screen for a fullscreen experience.

## How to play

- **Drag between two colonies** to open a hyperspace corridor. A vessel is
  assigned automatically if one is in reserve.
- **Drag a corridor's loose end** (the little tick past the last stop) to
  extend the route, drag back along it to retract, or drop it onto the far
  end to close a loop.
- **Drag mid-route onto a colony** to call there. Drag mid-route to empty
  space to break a loop.
- **Long-press a stop** (or Alt-drag on desktop) to reroute it elsewhere or,
  released in empty space, withdraw service from it.
- Tap an inventory chip (vessel / pod / hub), then tap a corridor or colony,
  to assign it.
- Corridors cannot cross ionised nebulae without a **Beacon Relay**; relays
  are consumed automatically when a crossing is drawn and refunded when it
  is removed.

Each colony displays the glyph of the one cargo it cannot produce; the ring
around it is its reserve. Crates carry the glyph of the colony type they are
bound for — deliver them to *any* colony of that type. When a reserve runs
dry a distress countdown begins; if no delivery arrives in time, the colony
fails, and Head Office will circulate a memo about you.

Each week the Board grants one vessel plus a choice of requisition: a new
corridor, a cargo pod, beacon relays, or an orbital logistics hub.

- **Space** — pause · **Esc** — cancel a drag or assignment
- **⏩ button** — fast-forward · **speaker** — sound on/off

## The Tuning Office (hidden developer panel)

Every gameplay number can be adjusted live:

- **Keyboard:** press **`** (backtick) or **F2**
- **Touch:** tap the **C&W monogram** (top-left) five times quickly

The panel provides:

- a live operations ledger (colonies, average reserve, crates waiting/in
  transit, deliveries per minute);
- direct intervention: time scale 0–8×, "colonies may not fail" inspection
  mode, and buttons to grant vessels/corridors/relays/pods/hubs, spawn
  colonies or specials, force the weekly review, and refill reserves;
- sliders for every tunable — spawn pacing, production rates, reserve and
  countdown durations, fleet speeds and capacities, starting inventory and
  upgrade cadence;
- **Save to this browser** (persists via localStorage), **Reset to
  factory**, and **Copy JSON** to export the current overrides.

Suggested first knobs when tuning for "fun and addictive":

| Feeling | Try |
|---|---|
| Too gentle | ↑ `crateRateGrowthPerDay`, ↓ `reserveDurationSec`, ↓ `colonySpawnIntervalMax` |
| Too brutal early | ↑ `newColonyReserve`, ↑ `colonySpawnInterval`, ↓ `crateBaseRate` |
| Deaths feel unfair | ↑ `starveCountdownSec`, keep `graceHold` = 1 |
| Ships feel sluggish | ↑ `shipSpeed`, ↓ `dwellBase` |
| Specials too easy | ↑ `specialDemandWeight`, ↑ `specialChance` |

Numbers all live in `js/config.js` (`CW.DEFAULTS`), including the panel's
slider ranges (`CW.TUNING_SCHEMA`).

## The Drawing Office (appearance studio)

Open **`design.html`** — a separate companion app for designing the look
and feel of the game without touching gameplay. It runs the *real*
simulation and the *real* renderer on a small scripted showcase network
(routes in several liveries, a nebula crossing with its relay beacon, an
orbital hub, pod barges, busy cargo yards, and one permanently — and
harmlessly — distressed colony) so every visual state stays on screen
while you work.

Every visual number and colour is editable live, in eight drawers:

- **Palette** — inks, parchment, brass, distress red, starlight, lettering;
- **Corridor livery** and **planet tints** (all eight of each);
- **Background & survey chart** — stars, vignette, grid rings and radials;
- **Nebulae** — glow, wisps, hatching, sparks, hue shift, saturation;
- **Planets** — radii, shading, halo, glyphs, reserve rings;
- **Hyperspace conduits** — width, glow, rail hollow, energy pulses, relays;
- **Vessels** — hull dimensions, trim, exhaust, engine trail, containers.

Preview controls: a zoom glass, drag to pan, motion pause, a distress-demo
toggle, and **New Survey** for a freshly generated sheet.

- **File with the Board** saves the finish to this browser (localStorage);
  the game reads it on next load. **Factory Finish** discards everything.
- **House styles** — *Blueprint* (cyanotype), *Gaslight* (warm sepia) and
  *Signal Room* (phosphor terminal) ship as starting points.
- **Carbon copies** — export/import the finish as JSON to carry it
  between machines.

The theme system lives in `js/theme.js` (`CW.THEME_DEFAULTS`,
`CW.THEME_SCHEMA`, `CW.THEME_PRESETS`); the renderer re-reads the theme
every frame, so changes land instantly.

## The Planetary Works (procedural planet generator)

Open **`planets.html`** — a standalone companion app that casts batches
of procedural worlds: nine archetypes (verdant, pelagic, dust, glacial,
foundry, gas colossus, barren, miasmic, anomalous), sizes varying ±50%,
distinct palettes, rings, up to four orbiting moons, drifting cloud
layers, polar caps, great storms, craters, glowing lava veins and
night-side city lights. Every world is pure data from a seed — the same
seed always casts the same worlds.

Five **house finishes** can be applied, or *merged by weight* like
paint: **Realistic**, **Cartoon**, **Magical**, **Survey Ink** (the
game's own engraved-chart idiom) and **Pixel Age**. Styles are
parameter sets, not code paths — outline, posterisation, cel shading,
saturation, hatching, iridescence, sparkle, glow and pixelation all
blend linearly, so "two ladles of Cartoon to one of Magical" is a
perfectly respectable order. The pattern book ships pure finishes plus
a few named blends.

- **Gallery** — a batch of worlds side by side; click one for the
  inspection bench (spinning close-up, survey card, witty field notes).
- **Forge** — batch size, seed casting, per-world re-forging;
  **COPY SPEC** exports a world + style mix as JSON.
- Shareable/testable via query string:
  `planets.html?seed=frome&count=12&mix=cartoon:60,magical:40&still=1`.

The engine lives in `js/planetgen.js` (`CW.PlanetGen`): `generate(seed)`
returns a serialisable spec; `render(ctx, spec, x, y, r, styleMix, t)`
paints it anywhere. It touches no DOM and no game state, so it can be
lifted into the game renderer whole when the time comes.

## Architecture

| File | Responsibility |
|---|---|
| `js/config.js` | every gameplay tunable, defaults, persistence of overrides |
| `js/theme.js`  | every visual tunable and colour, house styles, persistence |
| `js/copy.js`   | the company voice: names, memos, manifest quips |
| `js/glyphs.js` | the ten cargo glyphs as canvas vector paths |
| `js/sim.js`    | the entire simulation — colonies, crates, corridors, ships, routing (multi-source BFS per cargo type), starvation, spawning, weekly reviews |
| `js/render.js` | canvas renderer: survey grid, hatched nebula hazards, stylised planets, twin-rail conduits, container freighters, reserve rings, distress telegraphing |
| `js/input.js`  | pointer gestures for corridor editing (mouse + touch) |
| `js/ui.js`     | HUD, memoranda, Ship's Manifest, toasts, tooltip |
| `js/devpanel.js` | the Tuning Office |
| `js/main.js`   | assembly and the main loop |
| `design.html` + `js/design.js` | the Drawing Office appearance studio |
| `js/planetgen.js` | procedural planet engine: seeded specs, style mixing, painter |
| `planets.html` + `js/planetworks.js` | the Planetary Works generator app |

Design rules honoured throughout, per the concept documents: a colony never
produces the cargo type it consumes; crates match colony *types*, never
specific colonies; one fail rule with one timer for every colony tier; all
routing intelligence lives in the network the player draws, never in the
ships; and whenever realism argues with elegance, elegance wins.
