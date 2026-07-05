/* Crump & Wainwright — Interstellar Freight Services
   config.js — every gameplay number lives here, and the hidden
   Tuning Office (dev panel) edits these values live. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  // ---------------------------------------------------------------
  // Cargo / colony types
  // ---------------------------------------------------------------
  CW.TYPES = [
    { id: 'water',     name: 'Water',     common: true,  weightKey: 'weightWater'  },
    { id: 'food',      name: 'Food',      common: true,  weightKey: 'weightFood'   },
    { id: 'energy',    name: 'Energy',    common: true,  weightKey: 'weightEnergy' },
    { id: 'minerals',  name: 'Minerals',  common: false },
    { id: 'machinery', name: 'Machinery', common: false },
    { id: 'medicine',  name: 'Medicine',  common: false },
    { id: 'knowledge', name: 'Knowledge', common: false },
    { id: 'culture',   name: 'Culture',   common: false },
    { id: 'biology',   name: 'Biology',   common: false },
    { id: 'luxuries',  name: 'Luxuries',  common: false },
  ];
  CW.TYPE_BY_ID = {};
  CW.TYPES.forEach(function (t) { CW.TYPE_BY_ID[t.id] = t; });

  // Corridor livery. Named after paints in the company stores.
  CW.CORRIDOR_COLOURS = [
    { name: 'Brass',          hex: '#c9a227' },
    { name: 'Verdigris',      hex: '#3fa88e' },
    { name: 'Signal Red',     hex: '#c25450' },
    { name: 'Wedgwood Blue',  hex: '#6f9bd8' },
    { name: 'Plum',           hex: '#a273b8' },
    { name: 'Furnace Orange', hex: '#cf7b3e' },
    { name: 'Cabbage',        hex: '#8fae5c' },
    { name: 'Porcelain',      hex: '#d8d2e0' },
  ];

  // ---------------------------------------------------------------
  // Tunables — defaults. The dev panel edits a live copy (CW.config).
  // ---------------------------------------------------------------
  CW.DEFAULTS = {
    // Time & pace
    dayLengthSec: 20,          // real seconds per in-game day
    fastSpeed: 2.5,            // fast-forward multiplier

    // Colony spawning
    colonySpawnInterval: 22,   // seconds between new colonies (start)
    colonySpawnIntervalGrowth: 0.8, // seconds added per spawn
    colonySpawnIntervalMax: 42,
    colonyMinDist: 92,         // world units between colonies
    spawnRadiusStart: 250,
    spawnRadiusGrowth: 14,     // radius added per spawn
    spawnRadiusMax: 900,
    weightWater: 4,
    weightFood: 2,
    weightEnergy: 1,
    specialStartDay: 4,        // first day a special colony may appear
    specialChance: 0.22,       // chance a given spawn is special
    specialReplaceChance: 0.5, // chance a special TRANSFORMS an existing common colony

    // Cargo production
    crateCheckInterval: 2.5,   // seconds between production checks
    crateBaseRate: 0.07,       // probability per colony per check (day 1)
    crateRateGrowthPerDay: 0.007,
    crateRateMax: 0.26,
    specialDemandWeight: 1.0,  // destination weighting for special types
    queueSoftCap: 8,           // produced crates beyond this are ignored
    hubQueueCap: 16,

    // Reserves & failure
    reserveDurationSec: 115,   // full reserve -> empty, undelivered
    deliveryRefill: 0.3,       // reserve fraction restored per delivery
    newColonyReserve: 0.85,
    starveCountdownSec: 45,    // distress countdown once reserve is empty
    graceHold: 1,              // 1 = countdown holds while relief ship is due next stop

    // Fleet
    shipSpeed: 72,             // world units / second
    shipCapacity: 6,
    podCapacity: 6,
    maxPodsPerShip: 3,
    dwellBase: 0.5,            // docking time, seconds
    dwellPerCrate: 0.1,        // extra per crate moved
    hubDwellMult: 0.6,

    // Starting inventory & upgrades
    startShips: 3,
    startCorridors: 3,
    startRelays: 2,
    maxCorridors: 7,
    upgradePeriodDays: 7,      // weekly review
    maxHubs: 5,
  };

  // Dev panel schema: group -> [key, label, min, max, step]
  CW.TUNING_SCHEMA = [
    { group: 'Time & Pace', items: [
      ['dayLengthSec', 'Day length (s)', 8, 40, 1],
      ['fastSpeed', 'Fast-forward ×', 1.5, 5, 0.5],
    ]},
    { group: 'Colony Spawning', items: [
      ['colonySpawnInterval', 'Spawn interval (s)', 8, 60, 1],
      ['colonySpawnIntervalGrowth', 'Interval growth /spawn', 0, 3, 0.1],
      ['colonySpawnIntervalMax', 'Interval max (s)', 20, 90, 1],
      ['colonyMinDist', 'Min colony spacing', 50, 160, 2],
      ['spawnRadiusStart', 'Frontier radius (start)', 150, 500, 10],
      ['spawnRadiusGrowth', 'Frontier growth /spawn', 0, 40, 1],
      ['weightWater', 'Water weight', 0, 8, 1],
      ['weightFood', 'Food weight', 0, 8, 1],
      ['weightEnergy', 'Energy weight', 0, 8, 1],
      ['specialStartDay', 'Specials from day', 1, 14, 1],
      ['specialChance', 'Special spawn chance', 0, 1, 0.02],
      ['specialReplaceChance', 'Industrialise chance', 0, 1, 0.05],
    ]},
    { group: 'Cargo Production', items: [
      ['crateCheckInterval', 'Production tick (s)', 0.5, 6, 0.25],
      ['crateBaseRate', 'Base rate (day 1)', 0, 0.3, 0.005],
      ['crateRateGrowthPerDay', 'Rate growth /day', 0, 0.03, 0.001],
      ['crateRateMax', 'Rate ceiling', 0.05, 0.5, 0.01],
      ['specialDemandWeight', 'Special demand ×', 0, 3, 0.1],
      ['queueSoftCap', 'Colony yard cap', 4, 20, 1],
      ['hubQueueCap', 'Hub yard cap', 8, 30, 1],
    ]},
    { group: 'Reserves & Failure', items: [
      ['reserveDurationSec', 'Reserve duration (s)', 40, 300, 5],
      ['deliveryRefill', 'Refill per delivery', 0.05, 1, 0.05],
      ['newColonyReserve', 'New colony reserve', 0.3, 1, 0.05],
      ['starveCountdownSec', 'Distress countdown (s)', 10, 90, 1],
      ['graceHold', 'Hold timer if relief due (0/1)', 0, 1, 1],
    ]},
    { group: 'Fleet', items: [
      ['shipSpeed', 'Vessel speed', 30, 160, 2],
      ['shipCapacity', 'Vessel capacity', 2, 12, 1],
      ['podCapacity', 'Pod capacity', 2, 12, 1],
      ['maxPodsPerShip', 'Max pods / vessel', 0, 6, 1],
      ['dwellBase', 'Docking time (s)', 0, 2, 0.05],
      ['dwellPerCrate', 'Docking per crate (s)', 0, 0.5, 0.02],
      ['hubDwellMult', 'Hub docking ×', 0.2, 1, 0.05],
    ]},
    { group: 'Inventory & Upgrades', items: [
      ['startShips', 'Starting vessels', 1, 8, 1],
      ['startCorridors', 'Starting corridors', 1, 7, 1],
      ['startRelays', 'Starting relays', 0, 6, 1],
      ['maxCorridors', 'Corridor ceiling', 3, 8, 1],
      ['upgradePeriodDays', 'Review period (days)', 3, 14, 1],
      ['maxHubs', 'Hub ceiling', 0, 8, 1],
    ]},
  ];

  var STORE_KEY = 'cw_tuning_v1';

  CW.loadConfig = function () {
    var cfg = {};
    Object.keys(CW.DEFAULTS).forEach(function (k) { cfg[k] = CW.DEFAULTS[k]; });
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.keys(saved).forEach(function (k) {
          if (k in cfg && typeof saved[k] === 'number' && isFinite(saved[k])) cfg[k] = saved[k];
        });
      }
    } catch (e) { /* corrupted overrides are quietly ignored */ }
    return cfg;
  };

  CW.saveConfig = function (cfg) {
    var diff = {};
    Object.keys(CW.DEFAULTS).forEach(function (k) {
      if (cfg[k] !== CW.DEFAULTS[k]) diff[k] = cfg[k];
    });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(diff)); } catch (e) {}
  };

  CW.resetConfig = function (cfg) {
    Object.keys(CW.DEFAULTS).forEach(function (k) { cfg[k] = CW.DEFAULTS[k]; });
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  };

  CW.config = CW.loadConfig();
})();
