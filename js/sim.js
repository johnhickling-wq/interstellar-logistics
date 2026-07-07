/* sim.js — the entire simulation. No rendering, no DOM.
   Mechanics follow the Mini Metro pattern: typed nodes spawn over time,
   produce destination-typed cargo, ships shuttle along player-drawn
   corridors, and the fail state is a colony starving of its one
   essential resource. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  // -------------------------------------------------- tiny event bus
  var bus = {
    map: {},
    on: function (ev, fn) { (this.map[ev] = this.map[ev] || []).push(fn); },
    emit: function (ev, data) {
      var l = this.map[ev]; if (!l) return;
      for (var i = 0; i < l.length; i++) l[i](data);
    },
  };
  CW.bus = bus;

  // -------------------------------------------------- seeded RNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -------------------------------------------------- geometry helpers
  function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
  function pointSegDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var x = ax + t * dx, y = ay + t * dy;
    return { d: Math.sqrt(dist2(px, py, x, y)), t: t, x: x, y: y };
  }

  var nextId = 1;
  function uid() { return nextId++; }

  // ==================================================================
  // Game factory
  // ==================================================================
  CW.createGame = function () {
    var cfg = CW.config;
    var seed = (Math.random() * 0xffffffff) >>> 0;
    var rng = mulberry32(seed);
    var namePool = CW.makeNamePool(rng);

    var game = {
      seed: seed,
      sector: String.fromCharCode(65 + Math.floor(rng() * 26)) + '-' + (1 + Math.floor(rng() * 9)),
      phase: 'playing',           // playing | paused | upgrade | over
      speed: 1,                    // 1 or cfg.fastSpeed
      cheatTimeScale: 1,
      invincible: false,
      simTime: 0,
      day: 1,
      colonies: [],
      corridors: [],
      ships: [],
      nebulae: [],
      effects: [],
      inventory: {
        ships: cfg.startShips,
        relays: cfg.startRelays,
        pods: 0,
        hubs: 0,
        corridorsUnlocked: Math.min(cfg.startCorridors, CW.CORRIDOR_COLOURS.length),
      },
      score: { delivered: 0 },
      deliveryLog: [],             // sim times, for deliveries/min metric
      pendingUpgrade: null,
      hubsGranted: 0,
      flags: { lowToastShown: false, drawHintShown: false, extendHintShown: false },
      spawn: null,
      typeDist: {},                // typeId -> {colonyId: hops}
      typeCounts: {},
      prodTimer: 0,
      lastReview: 0,
    };

    // ---------------------------------------------------- colonies
    function colonyById(id) {
      for (var i = 0; i < game.colonies.length; i++) if (game.colonies[i].id === id) return game.colonies[i];
      return null;
    }
    game.colonyById = colonyById;

    function addColony(type, x, y, reserve) {
      var c = {
        id: uid(), type: type, x: x, y: y,
        name: namePool.length ? namePool.pop() : 'Outpost ' + uid(),
        reserve: reserve, starve: null, graceActive: false,
        isHub: false, queue: [], bornAt: game.simTime,
        distressToastShown: false, pulse: 0,
      };
      game.colonies.push(c);
      recountTypes();
      recomputeRouting();
      return c;
    }

    function recountTypes() {
      var counts = {};
      CW.TYPES.forEach(function (t) { counts[t.id] = 0; });
      game.colonies.forEach(function (c) { counts[c.type]++; });
      game.typeCounts = counts;
    }

    // ---------------------------------------------------- nebulae
    function pointInNebula(x, y, margin) {
      margin = margin || 0;
      for (var i = 0; i < game.nebulae.length; i++) {
        var blobs = game.nebulae[i].blobs;
        for (var j = 0; j < blobs.length; j++) {
          var b = blobs[j];
          if (dist2(x, y, b.x, b.y) < (b.r + margin) * (b.r + margin)) return true;
        }
      }
      return false;
    }
    game.pointInNebula = pointInNebula;

    // Number of distinct nebulae a straight segment passes through.
    function segCrossCost(a, b) {
      var n = 0;
      for (var i = 0; i < game.nebulae.length; i++) {
        var blobs = game.nebulae[i].blobs, hit = false;
        for (var j = 0; j < blobs.length && !hit; j++) {
          var bl = blobs[j];
          if (pointSegDist(bl.x, bl.y, a.x, a.y, b.x, b.y).d < bl.r) hit = true;
        }
        if (hit) n++;
      }
      return n;
    }
    game.segCrossCost = segCrossCost;

    function stopsCost(stopIds, loop) {
      var cost = 0, n = stopIds.length;
      var count = loop ? n : n - 1;
      for (var i = 0; i < count; i++) {
        var a = colonyById(stopIds[i]), b = colonyById(stopIds[(i + 1) % n]);
        if (a && b) cost += segCrossCost(a, b);
      }
      return cost;
    }
    game.stopsCost = stopsCost;

    function makeNebulae() {
      // The band: a meandering ionised ribbon crossing the entire
      // chart, passing 115–180 units from the origin — close enough
      // that the growing network meets it early, exactly as rivers
      // work in the reference design. Random orientation per game.
      var theta = rng() * Math.PI * 2;         // direction of closest approach
      var nx = Math.cos(theta), ny = Math.sin(theta);
      var ux = -ny, uy = nx;                    // along-band direction
      var d0 = 115 + rng() * 65;
      var ph = rng() * 10;
      var blobs = [];
      for (var s = -1050; s <= 1050; s += 78) {
        var d = d0 + Math.sin(s * 0.0035 + ph) * 80 + (rng() - 0.5) * 24;
        d = Math.max(d, 98);                    // never swallow the origin cluster
        blobs.push({
          x: nx * d + ux * s,
          y: ny * d + uy * s,
          r: 56 + rng() * 38,
        });
      }
      game.nebulae.push({ id: uid(), blobs: blobs, hue: 268 });

      // A rose-tinted patch on the far side, for later expansion pain.
      var pa = theta + Math.PI * (0.7 + rng() * 0.6);
      var pd = 380 + rng() * 170;
      var cx = Math.cos(pa) * pd, cy = Math.sin(pa) * pd * 0.7;
      var patch = [];
      for (var i = 0; i < 4; i++) {
        patch.push({ x: cx + (rng() - 0.5) * 150, y: cy + (rng() - 0.5) * 95, r: 62 + rng() * 42 });
      }
      game.nebulae.push({ id: uid(), blobs: patch, hue: 322 });
    }

    // ---------------------------------------------------- spawning
    function placeColony(minR, maxR) {
      for (var attempt = 0; attempt < 60; attempt++) {
        var a = rng() * Math.PI * 2;
        var r = minR + rng() * (maxR - minR);
        var x = Math.cos(a) * r, y = Math.sin(a) * r * 0.62;
        var ok = !pointInNebula(x, y, 30);
        for (var i = 0; i < game.colonies.length && ok; i++) {
          if (dist2(x, y, game.colonies[i].x, game.colonies[i].y) < cfg.colonyMinDist * cfg.colonyMinDist) ok = false;
        }
        if (ok) return { x: x, y: y };
      }
      return null;
    }

    function pickCommonType() {
      var w = [
        { id: 'water', w: cfg.weightWater },
        { id: 'food', w: cfg.weightFood },
        { id: 'energy', w: cfg.weightEnergy },
      ];
      var total = w.reduce(function (s, e) { return s + e.w; }, 0) || 1;
      var roll = rng() * total;
      for (var i = 0; i < w.length; i++) { roll -= w[i].w; if (roll <= 0) return w[i].id; }
      return 'water';
    }

    function trySpawnColony(forcedType) {
      var sp = game.spawn;
      var type = forcedType, isSpecial = false;

      if (!type) {
        var specialsLeft = sp.specialsRemaining.length > 0;
        if (specialsLeft && game.day >= cfg.specialStartDay && rng() < cfg.specialChance) {
          type = sp.specialsRemaining.shift();
          isSpecial = true;
        } else {
          type = pickCommonType();
        }
      } else {
        isSpecial = !CW.TYPE_BY_ID[type].common;
      }

      // Transformation event: a special may industrialise an existing
      // common colony instead of founding a new one.
      if (isSpecial && !forcedType && rng() < cfg.specialReplaceChance) {
        var eligible = game.colonies.filter(function (c) {
          return CW.TYPE_BY_ID[c.type].common && game.typeCounts[c.type] >= 2;
        });
        if (eligible.length) {
          var victim = eligible[Math.floor(rng() * eligible.length)];
          transformColony(victim, type);
          return true;
        }
      }

      var pos = placeColony(sp.radius * 0.55, sp.radius) || placeColony(sp.radius * 0.7, sp.radius + 80);
      if (!pos) { if (isSpecial) sp.specialsRemaining.unshift(type); return false; }

      var c = addColony(type, pos.x, pos.y, cfg.newColonyReserve);
      var tName = CW.TYPE_BY_ID[type].name;
      bus.emit('toast', isSpecial ? CW.toasts.specialSpawn(c, tName) : CW.toasts.colonySpawn(c, tName));
      bus.emit('sound', 'spawn');
      game.effects.push({ kind: 'spawn', x: c.x, y: c.y, t0: game.simTime });
      return true;
    }

    function transformColony(colony, newType) {
      colony.type = newType;
      colony.reserve = cfg.newColonyReserve;
      colony.starve = null;
      // Crates in its yard already bound for the new type are, happily,
      // already home.
      colony.queue = colony.queue.filter(function (crate) {
        if (crate.type === newType) { registerDelivery(colony, false); return false; }
        return true;
      });
      recountTypes();
      recomputeRouting();
      bus.emit('toast', CW.toasts.industrialise(colony, CW.TYPE_BY_ID[newType].name));
      bus.emit('sound', 'spawn');
      game.effects.push({ kind: 'transform', x: colony.x, y: colony.y, t0: game.simTime });
    }

    // ---------------------------------------------------- production
    function produceCrates() {
      var rate = Math.min(cfg.crateRateMax, cfg.crateBaseRate + cfg.crateRateGrowthPerDay * (game.day - 1));
      game.colonies.forEach(function (c) {
        var cap = c.isHub ? cfg.hubQueueCap : cfg.queueSoftCap;
        if (c.queue.length >= cap) return;            // overflow quietly ignored
        if (rng() >= rate) return;
        var type = pickDestination(c);
        if (type) c.queue.push({ type: type, born: game.simTime });
      });
    }

    function pickDestination(colony) {
      var opts = [], total = 0;
      CW.TYPES.forEach(function (t) {
        if (t.id === colony.type) return;              // the hard rule
        if (!game.typeCounts[t.id]) return;            // no impossible destinations
        var w = t.common ? 1 : cfg.specialDemandWeight;
        if (w <= 0) return;
        opts.push({ id: t.id, w: w }); total += w;
      });
      if (!opts.length) return null;
      var roll = rng() * total;
      for (var i = 0; i < opts.length; i++) { roll -= opts[i].w; if (roll <= 0) return opts[i].id; }
      return opts[opts.length - 1].id;
    }

    // ---------------------------------------------------- routing
    // Multi-source BFS per cargo type over the corridor adjacency graph.
    function recomputeRouting() {
      var adj = {};
      game.colonies.forEach(function (c) { adj[c.id] = []; });
      game.corridors.forEach(function (cor) {
        var n = cor.stops.length;
        var count = cor.loop ? n : n - 1;
        for (var i = 0; i < count; i++) {
          var a = cor.stops[i], b = cor.stops[(i + 1) % n];
          adj[a].push(b); adj[b].push(a);
        }
      });
      var dists = {};
      CW.TYPES.forEach(function (t) {
        var d = {}, queue = [];
        game.colonies.forEach(function (c) {
          if (c.type === t.id) { d[c.id] = 0; queue.push(c.id); }
        });
        var head = 0;
        while (head < queue.length) {
          var cur = queue[head++];
          var neigh = adj[cur] || [];
          for (var i = 0; i < neigh.length; i++) {
            if (d[neigh[i]] === undefined) { d[neigh[i]] = d[cur] + 1; queue.push(neigh[i]); }
          }
        }
        dists[t.id] = d;
      });
      game.typeDist = dists;
    }
    game.recomputeRouting = recomputeRouting;

    function hopsTo(typeId, colonyId) {
      var d = game.typeDist[typeId];
      var v = d ? d[colonyId] : undefined;
      return v === undefined ? Infinity : v;
    }

    // ---------------------------------------------------- corridors
    function corridorCount() { return game.corridors.length; }
    game.canStartCorridor = function () { return corridorCount() < game.inventory.corridorsUnlocked; };

    function nextFreeColourIdx() {
      var used = {};
      game.corridors.forEach(function (c) { used[c.colourIdx] = true; });
      for (var i = 0; i < CW.CORRIDOR_COLOURS.length; i++) if (!used[i]) return i;
      return 0;
    }
    game.nextFreeColourIdx = nextFreeColourIdx;

    // Shared-segment offsets so parallel corridors sit side by side.
    function computePaths() {
      var shared = {};
      function key(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
      game.corridors.forEach(function (cor) {
        var n = cor.stops.length, count = cor.loop ? n : n - 1;
        for (var i = 0; i < count; i++) {
          var k = key(cor.stops[i], cor.stops[(i + 1) % n]);
          (shared[k] = shared[k] || []).push(cor.id);
        }
      });
      var OFF = 9.5; // world units between parallel corridors
      game.corridors.forEach(function (cor) {
        var n = cor.stops.length, count = cor.loop ? n : n - 1;
        var segOffsets = [];
        for (var i = 0; i < count; i++) {
          var aId = cor.stops[i], bId = cor.stops[(i + 1) % n];
          var a = colonyById(aId), b = colonyById(bId);
          var list = shared[key(aId, bId)];
          var idx = list.indexOf(cor.id);
          var o = (idx - (list.length - 1) / 2) * OFF;
          // canonical perpendicular (from lower id to higher id)
          var from = aId < bId ? a : b, to = aId < bId ? b : a;
          var dx = to.x - from.x, dy = to.y - from.y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          segOffsets.push({ x: (-dy / len) * o, y: (dx / len) * o });
        }
        var path = [];
        for (var v = 0; v < n; v++) {
          var col = colonyById(cor.stops[v]);
          var ox = 0, oy = 0, cnt = 0;
          // average offsets of segments adjacent to this vertex
          var prev = cor.loop ? (v - 1 + count) % count : v - 1;
          var next = v;
          if (prev >= 0 && prev < count) { ox += segOffsets[prev].x; oy += segOffsets[prev].y; cnt++; }
          if (next < count) { ox += segOffsets[next].x; oy += segOffsets[next].y; cnt++; }
          if (cnt) { ox /= cnt; oy /= cnt; }
          path.push({ x: col.x + ox, y: col.y + oy });
        }
        cor.path = path;
        cor.segLens = [];
        for (var s = 0; s < count; s++) {
          var p0 = path[s], p1 = path[(s + 1) % n];
          cor.segLens.push(Math.sqrt(dist2(p0.x, p0.y, p1.x, p1.y)) || 0.001);
        }
      });
    }
    game.computePaths = computePaths;

    /* Commit an edit: `corridor` null means "create new".
       Returns true on success. Handles relay accounting, ship
       re-anchoring, deletion when under two stops. */
    game.commitCorridorEdit = function (corridor, stops, loop) {
      // strip accidental adjacent duplicates
      var clean = [];
      stops.forEach(function (id) { if (clean[clean.length - 1] !== id) clean.push(id); });
      if (loop && clean.length > 1 && clean[0] === clean[clean.length - 1]) clean.pop();
      if (clean.length < (loop ? 3 : 2)) loop = false;

      if (clean.length < 2) {
        if (corridor) game.deleteCorridor(corridor);
        return false;
      }
      var oldCost = corridor ? stopsCost(corridor.stops, corridor.loop) : 0;
      var newCost = stopsCost(clean, loop);
      var delta = newCost - oldCost;
      if (delta > game.inventory.relays) { bus.emit('toast', CW.toasts.noRelay); return false; }
      game.inventory.relays -= delta;

      if (!corridor) {
        corridor = {
          id: uid(), colourIdx: nextFreeColourIdx(),
          stops: clean, loop: loop, ships: [],
        };
        game.corridors.push(corridor);
        computePaths(); // ship placement needs the corridor's path
        if (game.inventory.ships > 0) game.assignShip(corridor, true);
        else bus.emit('toast', CW.toasts.noShips);
        if (!game.flags.extendHintShown) {
          game.flags.extendHintShown = true;
          setTimeout(function () { if (game.corridors.length === 1) bus.emit('toast', CW.toasts.hintExtend); }, 8000);
        }
      } else {
        corridor.stops = clean;
        corridor.loop = loop;
      }
      computePaths();
      reanchorShips(corridor);
      recomputeRouting();
      bus.emit('sound', 'ui');
      return true;
    };

    game.deleteCorridor = function (corridor) {
      var idx = game.corridors.indexOf(corridor);
      if (idx < 0) return;
      // refund relays
      game.inventory.relays += stopsCost(corridor.stops, corridor.loop);
      // ships return to the pool; their cargo is set down at the nearest stop
      corridor.ships.forEach(function (ship) {
        var nearest = null, best = Infinity;
        corridor.stops.forEach(function (id) {
          var c = colonyById(id);
          var d = dist2(ship.x, ship.y, c.x, c.y);
          if (d < best) { best = d; nearest = c; }
        });
        if (nearest) {
          ship.cargo.forEach(function (crate) {
            if (crate.type === nearest.type) registerDelivery(nearest, true);
            else nearest.queue.push(crate);
          });
        }
        game.inventory.pods += ship.pods;
        var si = game.ships.indexOf(ship);
        if (si >= 0) game.ships.splice(si, 1);
        game.inventory.ships++;
      });
      game.corridors.splice(idx, 1);
      computePaths();
      recomputeRouting();
    };

    function segCount(cor) { return cor.loop ? cor.stops.length : cor.stops.length - 1; }

    function reanchorShips(corridor) {
      corridor.ships.forEach(function (ship) {
        var best = { d: Infinity, seg: 0, t: 0 };
        var n = corridor.path.length, count = segCount(corridor);
        for (var i = 0; i < count; i++) {
          var p0 = corridor.path[i], p1 = corridor.path[(i + 1) % n];
          var r = pointSegDist(ship.x, ship.y, p0.x, p0.y, p1.x, p1.y);
          if (r.d < best.d) best = { d: r.d, seg: i, t: r.t };
        }
        ship.seg = best.seg;
        ship.t = best.t;
        if (ship.seg >= count) { ship.seg = 0; ship.t = 0; }
        ship.state = 'move';
        ship.dwell = 0;
      });
    }

    // ---------------------------------------------------- fleet
    game.assignShip = function (corridor, silent) {
      if (game.inventory.ships <= 0) return false;
      if (!corridor.path || corridor.path.length < 2) computePaths();
      game.inventory.ships--;
      var count = segCount(corridor);
      var frac = corridor.ships.length / (corridor.ships.length + 1);
      var seg = Math.min(count - 1, Math.floor(frac * count));
      var ship = {
        id: uid(), corridor: corridor, seg: seg, t: 0.5,
        dir: corridor.ships.length % 2 === 0 ? 1 : -1,
        pods: 0, cargo: [], state: 'move', dwell: 0,
        x: 0, y: 0, trail: [],
      };
      var p0 = corridor.path[seg], p1 = corridor.path[(seg + 1) % corridor.path.length];
      ship.x = (p0.x + p1.x) / 2; ship.y = (p0.y + p1.y) / 2;
      corridor.ships.push(ship);
      game.ships.push(ship);
      if (!silent) bus.emit('toast', CW.toasts.shipAssigned);
      bus.emit('sound', 'ui');
      return true;
    };

    game.assignPod = function (corridor) {
      if (game.inventory.pods <= 0) return false;
      if (!corridor.ships.length) { bus.emit('toast', CW.toasts.podNoShip); return false; }
      var ship = corridor.ships.reduce(function (a, b) { return b.pods < a.pods ? b : a; });
      if (ship.pods >= cfg.maxPodsPerShip) { bus.emit('toast', CW.toasts.podFull); return false; }
      ship.pods++;
      game.inventory.pods--;
      bus.emit('sound', 'ui');
      return true;
    };

    game.placeHub = function (colony) {
      if (game.inventory.hubs <= 0 || colony.isHub) return false;
      colony.isHub = true;
      game.inventory.hubs--;
      bus.emit('toast', CW.toasts.hubPlaced(colony));
      bus.emit('sound', 'delivery');
      game.effects.push({ kind: 'transform', x: colony.x, y: colony.y, t0: game.simTime });
      return true;
    };

    // ---------------------------------------------------- deliveries
    function registerDelivery(colony, refill) {
      game.score.delivered++;
      game.deliveryLog.push(game.simTime);
      if (refill !== false) {
        colony.reserve = Math.min(1, colony.reserve + cfg.deliveryRefill);
        colony.starve = null;
        colony.distressToastShown = false;
      }
      colony.pulse = 1;
      game.effects.push({ kind: 'delivery', x: colony.x, y: colony.y, t0: game.simTime });
      bus.emit('sound', 'delivery');
    }

    // ---------------------------------------------------- ships
    function shipCapacity(ship) { return cfg.shipCapacity + ship.pods * cfg.podCapacity; }

    function dockShip(ship, vertex) {
      var cor = ship.corridor;
      var n = cor.stops.length;
      var stopIdx = ((vertex % n) + n) % n;
      var colony = colonyById(cor.stops[stopIdx]);
      ship.state = 'dock';
      ship.vertex = stopIdx;
      var p = cor.path[stopIdx];
      ship.x = p.x; ship.y = p.y;

      // direction after this stop (reverse at open-line termini)
      var dir = ship.dir;
      if (!cor.loop) {
        if (stopIdx === n - 1) dir = -1;
        else if (stopIdx === 0) dir = 1;
      }
      ship.dir = dir;
      var nextColony = colonyById(cor.stops[(stopIdx + dir + n) % n]);

      var moves = 0;

      // unload: deliver matches, transfer crates that stop making progress
      for (var i = ship.cargo.length - 1; i >= 0; i--) {
        var crate = ship.cargo[i];
        if (crate.type === colony.type) {
          ship.cargo.splice(i, 1);
          registerDelivery(colony, true);
          moves++;
        } else if (n < 2 || !nextColony) {
          continue;
        } else {
          var dHere = hopsTo(crate.type, colony.id);
          var dNext = hopsTo(crate.type, nextColony.id);
          if (!(isFinite(dNext) && dNext < dHere)) {
            ship.cargo.splice(i, 1);
            colony.queue.push(crate);   // transfer; caps only gate production
            moves++;
          }
        }
      }

      // load: waiting crates that make progress via this ship's next hop
      if (nextColony) {
        var capacity = shipCapacity(ship);
        for (var q = 0; q < colony.queue.length && ship.cargo.length < capacity;) {
          var w = colony.queue[q];
          var h0 = hopsTo(w.type, colony.id);
          var h1 = hopsTo(w.type, nextColony.id);
          if (isFinite(h1) && h1 < h0) {
            colony.queue.splice(q, 1);
            ship.cargo.push(w);
            moves++;
            bus.emit('sound', 'pickup');
          } else q++;
        }
      }

      var dwell = moves > 0 ? cfg.dwellBase + cfg.dwellPerCrate * moves : 0.12;
      if (colony.isHub) dwell *= cfg.hubDwellMult;
      ship.dwell = dwell;
    }

    function departShip(ship) {
      var cor = ship.corridor;
      var n = cor.path.length;
      var v = ship.vertex;
      ship.state = 'move';
      if (ship.dir > 0) { ship.seg = cor.loop ? v % n : Math.min(v, n - 2); ship.t = 0; }
      else { ship.seg = cor.loop ? (v - 1 + n) % n : Math.max(0, v - 1); ship.t = 1; }
    }

    function updateShip(ship, dt) {
      var cor = ship.corridor;
      if (!cor || cor.path.length < 2) return;
      if (ship.state === 'dock') {
        ship.dwell -= dt;
        if (ship.dwell <= 0) departShip(ship);
        return;
      }
      var move = cfg.shipSpeed * dt;
      var guard = 0;
      while (move > 0 && guard++ < 60 && ship.state === 'move') {
        var count = segCount(cor);
        if (ship.seg >= count) { ship.seg = count - 1; ship.t = 1; }
        var L = cor.segLens[ship.seg] || 0.001;
        var remain = ship.dir > 0 ? (1 - ship.t) * L : ship.t * L;
        if (move < remain) {
          ship.t += ship.dir * move / L;
          move = 0;
        } else {
          move -= remain;
          var vertex = ship.dir > 0 ? (ship.seg + 1) % cor.path.length : ship.seg;
          dockShip(ship, vertex);
        }
      }
      if (ship.state === 'move') {
        var p0 = cor.path[ship.seg], p1 = cor.path[(ship.seg + 1) % cor.path.length];
        ship.x = p0.x + (p1.x - p0.x) * ship.t;
        ship.y = p0.y + (p1.y - p0.y) * ship.t;
      }
      // engine trail
      ship.trailTimer = (ship.trailTimer || 0) - dt;
      if (ship.trailTimer <= 0) {
        ship.trail.push({ x: ship.x, y: ship.y, t: game.simTime });
        if (ship.trail.length > 9) ship.trail.shift();
        ship.trailTimer = 0.05;
      }
    }

    // ---------------------------------------------------- reserves / failure
    function reliefInbound(colony) {
      for (var i = 0; i < game.ships.length; i++) {
        var s = game.ships[i];
        var cor = s.corridor;
        if (!cor) continue;
        var n = cor.stops.length;
        var nextIdx;
        if (s.state === 'dock') nextIdx = (s.vertex + s.dir + n) % n;
        else nextIdx = s.dir > 0 ? (s.seg + 1) % n : s.seg;
        if (cor.stops[nextIdx] !== colony.id) continue;
        for (var c = 0; c < s.cargo.length; c++) {
          if (s.cargo[c].type === colony.type) return true;
        }
      }
      return false;
    }

    function updateReserves(dt) {
      for (var i = 0; i < game.colonies.length; i++) {
        var c = game.colonies[i];
        c.pulse = Math.max(0, c.pulse - dt * 2);
        if (c.reserve > 0) {
          c.reserve = Math.max(0, c.reserve - dt / cfg.reserveDurationSec);
          if (c.reserve <= 0.3 && !game.flags.lowToastShown) {
            game.flags.lowToastShown = true;
            bus.emit('toast', CW.toasts.firstLowReserve);
          }
          c.graceActive = false;
        } else {
          if (c.starve === null) {
            c.starve = cfg.starveCountdownSec;
            if (!c.distressToastShown) {
              c.distressToastShown = true;
              bus.emit('toast', CW.toasts.distress(c, CW.TYPE_BY_ID[c.type].name));
              bus.emit('sound', 'warning');
            }
          }
          var hold = cfg.graceHold >= 1 && reliefInbound(c);
          c.graceActive = hold;
          if (!hold && !game.invincible) {
            c.starve -= dt;
            if (c.starve <= 0) { failGame(c); return; }
          }
        }
      }
    }

    function failGame(colony) {
      game.phase = 'over';
      var days = game.day;
      var delivered = game.score.delivered;
      var best = null;
      try {
        best = JSON.parse(localStorage.getItem('cw_best_v1') || 'null');
        if (!best || delivered > best.delivered) {
          best = { delivered: delivered, days: days };
          localStorage.setItem('cw_best_v1', JSON.stringify(best));
        }
      } catch (e) {}
      bus.emit('sound', 'gameover');
      bus.emit('gameover', {
        colony: colony, days: days, delivered: delivered,
        best: best || { delivered: delivered, days: days },
        resource: CW.TYPE_BY_ID[colony.type].name,
      });
    }

    // ---------------------------------------------------- weekly review
    function maybeReview() {
      var period = Math.max(1, Math.round(cfg.upgradePeriodDays));
      var completed = Math.floor((game.simTime / cfg.dayLengthSec) / period);
      if (completed > game.lastReview) {
        game.lastReview = completed;
        openReview(completed);
      }
    }

    function openReview(weekNo) {
      game.inventory.ships++;
      var pool = [];
      if (game.inventory.corridorsUnlocked < Math.min(cfg.maxCorridors, CW.CORRIDOR_COLOURS.length)) {
        pool.push({ kind: 'corridor', w: 3 });
      }
      pool.push({ kind: 'pod', w: 3 });
      pool.push({ kind: 'relay', w: 2 });
      if (game.hubsGranted < cfg.maxHubs) pool.push({ kind: 'hub', w: 2 });
      var options = [];
      while (options.length < 2 && pool.length) {
        var total = pool.reduce(function (s, e) { return s + e.w; }, 0);
        var roll = rng() * total;
        for (var i = 0; i < pool.length; i++) {
          roll -= pool[i].w;
          if (roll <= 0) { options.push(pool.splice(i, 1)[0].kind); break; }
        }
      }
      game.pendingUpgrade = { week: weekNo, options: options };
      game.phase = 'upgrade';
      bus.emit('sound', 'week');
      bus.emit('review', game.pendingUpgrade);
    }

    game.chooseUpgrade = function (kind) {
      if (!game.pendingUpgrade) return;
      if (kind === 'corridor') game.inventory.corridorsUnlocked = Math.min(game.inventory.corridorsUnlocked + 1, CW.CORRIDOR_COLOURS.length);
      else if (kind === 'pod') game.inventory.pods++;
      else if (kind === 'relay') game.inventory.relays += 2;
      else if (kind === 'hub') { game.inventory.hubs++; game.hubsGranted++; }
      game.pendingUpgrade = null;
      game.phase = 'playing';
      bus.emit('sound', 'ui');
    };

    // ---------------------------------------------------- cheats (dev panel)
    game.cheat = {
      addShip: function () { game.inventory.ships++; },
      addCorridor: function () { game.inventory.corridorsUnlocked = Math.min(game.inventory.corridorsUnlocked + 1, CW.CORRIDOR_COLOURS.length); },
      addRelay: function () { game.inventory.relays++; },
      addPod: function () { game.inventory.pods++; },
      addHub: function () { game.inventory.hubs++; },
      spawnColony: function () { trySpawnColony(pickCommonType()); },
      spawnSpecial: function () {
        var sp = game.spawn;
        if (sp.specialsRemaining.length) trySpawnColony(sp.specialsRemaining.shift());
      },
      triggerReview: function () { if (game.phase === 'playing') openReview(Math.floor(game.lastReview) + 1); },
      fillReserves: function () { game.colonies.forEach(function (c) { c.reserve = 1; c.starve = null; }); },
    };

    // ---------------------------------------------------- metrics
    game.metrics = function () {
      var waiting = 0, transit = 0, resSum = 0;
      game.colonies.forEach(function (c) { waiting += c.queue.length; resSum += c.reserve; });
      game.ships.forEach(function (s) { transit += s.cargo.length; });
      var cutoff = game.simTime - 60;
      while (game.deliveryLog.length && game.deliveryLog[0] < cutoff) game.deliveryLog.shift();
      return {
        colonies: game.colonies.length,
        avgReserve: game.colonies.length ? resSum / game.colonies.length : 1,
        waiting: waiting,
        inTransit: transit,
        perMin: game.deliveryLog.length,
        delivered: game.score.delivered,
        day: game.day,
      };
    };

    // ---------------------------------------------------- main update
    game.update = function (rawDt) {
      if (game.phase !== 'playing') return;
      var dt = Math.min(rawDt, 0.1) * (cfg.baseTimeScale || 1) * game.speed * game.cheatTimeScale;
      game.simTime += dt;
      game.day = Math.floor(game.simTime / cfg.dayLengthSec) + 1;

      // colony spawning
      var sp = game.spawn;
      if (game.simTime >= sp.next) {
        if (trySpawnColony()) {
          sp.interval = Math.min(cfg.colonySpawnIntervalMax, sp.interval + cfg.colonySpawnIntervalGrowth);
          sp.radius = Math.min(cfg.spawnRadiusMax, sp.radius + cfg.spawnRadiusGrowth);
          sp.next = game.simTime + sp.interval * (0.8 + rng() * 0.4);
        } else {
          sp.next = game.simTime + 4; // couldn't place; try again shortly
        }
      }

      // cargo production
      game.prodTimer += dt;
      while (game.prodTimer >= cfg.crateCheckInterval) {
        game.prodTimer -= cfg.crateCheckInterval;
        produceCrates();
      }

      // ships
      for (var i = 0; i < game.ships.length; i++) updateShip(game.ships[i], dt);

      // reserves & failure
      updateReserves(dt);
      if (game.phase !== 'playing') return;

      // effects pruning
      game.effects = game.effects.filter(function (e) { return game.simTime - e.t0 < 2.5; });

      // weekly review
      maybeReview();

      // gentle onboarding
      if (!game.flags.drawHintShown && game.simTime > 5 && !game.corridors.length) {
        game.flags.drawHintShown = true;
        bus.emit('toast', CW.toasts.hintDraw);
      }
    };

    // ---------------------------------------------------- initial state
    makeNebulae();
    (function initialColonies() {
      var base = rng() * Math.PI * 2;
      var types = ['water', 'food', 'energy'];
      var placed = [];
      // the starting triangle scales with the configured colony spacing
      var k = cfg.colonyMinDist / 92;
      for (var i = 0; i < 3; i++) {
        var best = null;
        for (var att = 0; att < 50 && !best; att++) {
          // first tries stay near the intended even spacing, later
          // tries roam anywhere in the starting region
          var a = att < 12
            ? base + i * (Math.PI * 2 / 3) + (rng() - 0.5) * 0.7
            : rng() * Math.PI * 2;
          var r = (112 + rng() * 62) * k;
          var x = Math.cos(a) * r, y = Math.sin(a) * r * 0.62;
          if (pointInNebula(x, y, 36)) continue;
          var clear = true;
          for (var j = 0; j < placed.length; j++) {
            if (dist2(x, y, placed[j].x, placed[j].y) < 80 * 80 * k * k) { clear = false; break; }
          }
          if (clear) best = { x: x, y: y };
        }
        if (!best) best = { x: Math.cos(base + i * 2.1) * 150 * k, y: Math.sin(base + i * 2.1) * 95 * k };
        placed.push(best);
        addColony(types[i], best.x, best.y, 1);
      }
    })();

    var specials = CW.TYPES.filter(function (t) { return !t.common; }).map(function (t) { return t.id; });
    for (var i = specials.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = specials[i]; specials[i] = specials[j]; specials[j] = t;
    }
    game.spawn = {
      next: cfg.colonySpawnInterval,
      interval: cfg.colonySpawnInterval,
      radius: cfg.spawnRadiusStart,
      specialsRemaining: specials,
    };

    recomputeRouting();
    return game;
  };
})();
