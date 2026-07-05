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

## Architecture

| File | Responsibility |
|---|---|
| `js/config.js` | every tunable, defaults, persistence of overrides |
| `js/copy.js`   | the company voice: names, memos, manifest quips |
| `js/glyphs.js` | the ten cargo glyphs as canvas vector paths |
| `js/sim.js`    | the entire simulation — colonies, crates, corridors, ships, routing (multi-source BFS per cargo type), starvation, spawning, weekly reviews |
| `js/render.js` | canvas renderer: survey grid, hatched nebula hazards, stylised planets, twin-rail conduits, container freighters, reserve rings, distress telegraphing |
| `js/input.js`  | pointer gestures for corridor editing (mouse + touch) |
| `js/ui.js`     | HUD, memoranda, Ship's Manifest, toasts, tooltip |
| `js/devpanel.js` | the Tuning Office |
| `js/main.js`   | assembly and the main loop |

Design rules honoured throughout, per the concept documents: a colony never
produces the cargo type it consumes; crates match colony *types*, never
specific colonies; one fail rule with one timer for every colony tier; all
routing intelligence lives in the network the player draws, never in the
ships; and whenever realism argues with elegance, elegance wins.
