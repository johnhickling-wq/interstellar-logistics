/* design.js — The Drawing Office. A standalone appearance studio:
   it runs the REAL simulation and the REAL renderer on a small scripted
   showcase network, and edits CW.theme live. Nothing in here touches
   gameplay; the game only reads the finish you file with the Board. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = {
    game: null,
    distressId: null,
    distressOn: true,
    busy: [],
    targets: {},
    baseScale: 1,
    motion: true,
  };

  // ------------------------------------------------------------ toast
  var toastTimer = null;
  function toast(msg) {
    var el = $('do-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ------------------------------------------------------------ scene
  function stuffQueue(g, c, n) {
    var types = [];
    g.colonies.forEach(function (cc) {
      if (cc.type !== c.type && types.indexOf(cc.type) < 0) types.push(cc.type);
    });
    if (!types.length) return;
    for (var k = 0; k < n; k++) c.queue.push({ type: types[k % types.length], born: g.simTime });
  }

  function buildScene() {
    // the office never holds weekly reviews, and the frontier is frozen
    CW.config.upgradePeriodDays = 9999;
    var g = CW.createGame();
    CW.game = g;
    S.game = g;
    g.phase = 'playing';
    g.invincible = true;
    g.spawn.next = Infinity;

    for (var i = 0; i < 4; i++) g.cheat.spawnColony();
    g.cheat.spawnSpecial();
    g.cheat.spawnSpecial();

    var ids = g.colonies.map(function (c) { return c.id; });

    // route A — a four-stop trunk line
    g.commitCorridorEdit(null, ids.slice(0, Math.min(4, ids.length)), false);
    // route B — a branch sharing one terminus
    if (ids.length >= 6) g.commitCorridorEdit(null, [ids[3], ids[4], ids[5]], false);

    // route C — by preference one that crosses a nebula (shows a relay
    // beacon); otherwise a loop, to show closed-circuit rendering
    for (var r = 0; r < 6; r++) g.cheat.addRelay();
    var crossPair = null;
    outer:
    for (var a = 0; a < g.colonies.length; a++) {
      for (var b = a + 1; b < g.colonies.length; b++) {
        if (g.segCrossCost(g.colonies[a], g.colonies[b]) > 0) {
          crossPair = [g.colonies[a].id, g.colonies[b].id];
          break outer;
        }
      }
    }
    if (crossPair) g.commitCorridorEdit(null, crossPair, false);
    else if (ids.length >= 5) g.commitCorridorEdit(null, [ids[0], ids[2], ids[4]], true);

    // fleet: a couple of vessels per route, one towing pods
    g.cheat.addShip(); g.cheat.addShip(); g.cheat.addShip();
    g.corridors.forEach(function (cor) { g.assignShip(cor, true); });
    if (g.corridors[0]) g.assignShip(g.corridors[0], true);
    g.cheat.addPod(); g.cheat.addPod();
    if (g.corridors[0]) { g.assignPod(g.corridors[0]); g.assignPod(g.corridors[0]); }

    // an orbital hub on the second stop
    g.cheat.addHub();
    if (g.colonies[1]) g.placeHub(g.colonies[1]);

    // busy yards, so waiting crates are always on show
    S.busy = [ids[0], ids[3]].filter(function (x) { return x != null; });
    S.busy.forEach(function (id) { stuffQueue(g, g.colonyById(id), 4); });

    // one colony held in permanent (harmless) distress for telegraphy
    var unconnected = g.colonies.filter(function (c) {
      return !g.corridors.some(function (cor) { return cor.stops.indexOf(c.id) >= 0; });
    });
    S.distressId = (unconnected[0] || g.colonies[g.colonies.length - 1]).id;

    // a spread of reserve states so every ring style is visible
    S.targets = {};
    var spread = [0.92, 0.92, 0.55, 0.92, 0.22, 0.92, 0.75, 0.92];
    g.colonies.forEach(function (c, i) { S.targets[c.id] = spread[i % spread.length]; });

    // undo the config base clock: the showcase runs at its designed pace
    g.cheatTimeScale = S.motion ? 1 / (CW.config.baseTimeScale || 1) : 0;
  }

  /* Hold the scene in its showcase state: reserves pinned, yards
     stocked, the distress colony kept theatrically distressed. */
  function maintain() {
    var g = S.game;
    if (!g) return;
    g.colonies.forEach(function (c) {
      if (S.distressOn && c.id === S.distressId) { c.reserve = 0; return; }
      c.reserve = S.targets[c.id] != null ? S.targets[c.id] : 0.9;
      c.starve = null;
      c.graceActive = false;
      if (c.queue.length > 8) c.queue.length = 8;
    });
    S.busy.forEach(function (id) {
      var c = g.colonyById(id);
      if (c && c.queue.length < 3) stuffQueue(g, c, 3 - c.queue.length);
    });
  }

  // ------------------------------------------------------------ camera
  function fitCamera() {
    var g = S.game, cam = CW.camera;
    var canvas = $('game');
    if (!g.colonies.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    g.colonies.forEach(function (c) {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    });
    var m = 110;
    var bw = Math.max(maxX - minX + m * 2, 300), bh = Math.max(maxY - minY + m * 2, 240);
    S.baseScale = Math.min(canvas.clientWidth / bw, canvas.clientHeight / bh);
    cam.x = (minX + maxX) / 2;
    cam.y = (minY + maxY) / 2;
    cam.scale = S.baseScale * parseFloat($('do-zoom').value);
    cam.init = true;
  }

  function initPan() {
    var canvas = $('game');
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var cam = CW.camera;
      cam.x -= (e.clientX - drag.x) / cam.scale;
      cam.y -= (e.clientY - drag.y) / cam.scale;
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('pointercancel', function () { drag = null; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var z = $('do-zoom');
      var v = parseFloat(z.value) * (e.deltaY > 0 ? 0.92 : 1.09);
      z.value = Math.max(0.4, Math.min(3, v));
      CW.camera.scale = S.baseScale * parseFloat(z.value);
    }, { passive: false });
  }

  // ------------------------------------------------------------ controls
  var inputs = {};   // key -> refresh function

  function fmt(v, step) {
    return step >= 1 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  }

  function buildControls() {
    var box = $('do-controls');
    box.innerHTML = '';
    CW.THEME_SCHEMA.forEach(function (grp, gi) {
      var det = document.createElement('details');
      det.className = 'do-group';
      if (gi < 2) det.open = true;
      var sum = document.createElement('summary');
      sum.textContent = grp.group.toUpperCase();
      det.appendChild(sum);

      grp.items.forEach(function (item) {
        var key = item[0], label = item[1], type = item[2];
        var row = document.createElement('div');
        row.className = 'do-item';
        var lab = document.createElement('label');
        lab.textContent = label;
        row.appendChild(lab);

        if (type === 'color') {
          var inp = document.createElement('input');
          inp.type = 'color';
          inp.value = CW.theme[key];
          var hex = document.createElement('span');
          hex.className = 'do-hex';
          hex.textContent = CW.theme[key];
          inp.addEventListener('input', function () {
            hex.textContent = inp.value;
            setTheme(key, inp.value);
          });
          row.appendChild(inp);
          row.appendChild(hex);
          inputs[key] = function () { inp.value = CW.theme[key]; hex.textContent = CW.theme[key]; };
        } else if (type === 'font') {
          var sel = document.createElement('select');
          Object.keys(CW.THEME_FONTS).forEach(function (fk) {
            var opt = document.createElement('option');
            opt.value = fk;
            opt.textContent = CW.THEME_FONTS[fk].label;
            sel.appendChild(opt);
          });
          sel.value = CW.theme[key];
          sel.addEventListener('change', function () { setTheme(key, sel.value); });
          row.appendChild(sel);
          inputs[key] = function () { sel.value = CW.theme[key]; };
        } else {
          var min = item[3], max = item[4], step = item[5];
          var rng = document.createElement('input');
          rng.type = 'range';
          rng.min = min; rng.max = max; rng.step = step;
          rng.value = CW.theme[key];
          var val = document.createElement('span');
          val.className = 'do-val';
          val.textContent = fmt(CW.theme[key], step);
          rng.addEventListener('input', function () {
            var v = parseFloat(rng.value);
            val.textContent = fmt(v, step);
            setTheme(key, v);
          });
          row.appendChild(rng);
          row.appendChild(val);
          inputs[key] = function () { rng.value = CW.theme[key]; val.textContent = fmt(CW.theme[key], step); };
        }
        det.appendChild(row);
      });
      box.appendChild(det);
    });
  }

  function refreshControls() {
    Object.keys(inputs).forEach(function (k) { inputs[k](); });
  }

  function setTheme(key, value) {
    CW.theme[key] = value;
    CW.applyTheme();
    if (key === 'starCount') CW.remakeStars();
  }

  function themeDiff() {
    var diff = {};
    Object.keys(CW.THEME_DEFAULTS).forEach(function (k) {
      if (CW.theme[k] !== CW.THEME_DEFAULTS[k]) diff[k] = CW.theme[k];
    });
    return diff;
  }

  // ------------------------------------------------------------ header actions
  function initActions() {
    $('do-save').addEventListener('click', function () {
      CW.saveTheme(CW.theme);
      toast('Filed with the Board. The terminal will observe the new finish.');
    });

    $('do-reset').addEventListener('click', function () {
      CW.resetTheme(CW.theme);
      CW.applyTheme();
      CW.remakeStars();
      refreshControls();
      $('do-preset').value = '';
      toast('Returned to the factory finish, as the founders intended.');
    });

    var sel = $('do-preset');
    var ph = document.createElement('option');
    ph.value = ''; ph.textContent = 'HOUSE STYLES…'; ph.disabled = false;
    sel.appendChild(ph);
    Object.keys(CW.THEME_PRESETS).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      CW.applyPreset(CW.theme, sel.value);
      CW.applyTheme();
      CW.remakeStars();
      refreshControls();
      toast('“' + sel.value + '” taken from the pattern store. Not yet filed.');
    });

    $('do-export').addEventListener('click', function () {
      $('do-json').value = JSON.stringify(themeDiff(), null, 2);
      toast('Written out. Differences from factory only.');
    });
    $('do-copy').addEventListener('click', function () {
      $('do-json').value = $('do-json').value || JSON.stringify(themeDiff(), null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText($('do-json').value);
      toast('Carbon copy taken.');
    });
    $('do-import').addEventListener('click', function () {
      try {
        var parsed = JSON.parse($('do-json').value || '{}');
        var applied = 0;
        Object.keys(parsed).forEach(function (k) {
          if (k in CW.THEME_DEFAULTS &&
              typeof parsed[k] === typeof CW.THEME_DEFAULTS[k]) {
            CW.theme[k] = parsed[k];
            applied++;
          }
        });
        CW.applyTheme();
        CW.remakeStars();
        refreshControls();
        toast(applied + ' value' + (applied === 1 ? '' : 's') + ' read in. Not yet filed.');
      } catch (e) {
        toast('The clerk cannot read that JSON. Kindly rewrite it.');
      }
    });

    // preview bar
    $('do-zoom').addEventListener('input', function () {
      CW.camera.scale = S.baseScale * parseFloat($('do-zoom').value);
    });
    $('do-fit').addEventListener('click', function () {
      $('do-zoom').value = 1;
      fitCamera();
    });
    $('do-motion').addEventListener('click', function () {
      S.motion = !S.motion;
      S.game.cheatTimeScale = S.motion ? 1 / (CW.config.baseTimeScale || 1) : 0;
      $('do-motion').classList.toggle('active', S.motion);
    });
    $('do-distress').addEventListener('click', function () {
      S.distressOn = !S.distressOn;
      if (!S.distressOn) {
        var c = S.game.colonyById(S.distressId);
        if (c) { c.starve = null; c.reserve = 0.9; }
      }
      $('do-distress').classList.toggle('active', S.distressOn);
    });
    $('do-resurvey').addEventListener('click', function () {
      buildScene();
      CW.remakeStars();
      fitCamera();
      toast('A fresh survey sheet. The colonies are new; the finish is yours.');
    });
  }

  // ------------------------------------------------------------ main loop
  var lastT = 0;
  function loop(t) {
    var dt = Math.min((t - lastT) / 1000, 0.1) || 0.016;
    lastT = t;
    try {
      maintain();
      S.game.update(dt);
      CW.renderFrame(S.game, dt, t / 1000);
    } catch (err) {
      if (window.console) console.error(err);
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', function () {
    CW.inputActive = true;              // the office camera is hand-cranked
    CW.initRenderer($('game'));
    buildScene();
    buildControls();
    initActions();
    initPan();
    fitCamera();
    window.addEventListener('resize', function () {
      CW.resizeRenderer();
      fitCamera();
    });
    requestAnimationFrame(loop);
  });
})();
