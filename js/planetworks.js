/* planetworks.js — The Planetary Works, retail floor. A standalone
   companion app (like the Drawing Office) that casts batches of
   procedural worlds with CW.PlanetGen and lets you grade between the
   house finishes — Realistic, Cartoon, Magical, Survey Ink, Pixel
   Age — or mix them by weight. Nothing here touches gameplay; the
   generator module is the part built to be lifted into the game.

   Query strings are honoured, for sharing and for the test bench:
     planets.html?seed=basingstoke&count=8&mix=cartoon:60,magical:40&still=1 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PG = CW.PlanetGen;
  var LSKEY = 'cw-planetworks-v1';

  var S = {
    seedText: '',
    count: 12,
    weights: { realistic: 100, cartoon: 0, magical: 0, ink: 0, pixel: 0 },
    motion: true,
    specs: [],
    tiles: [],
    sel: 0,
    time: 0,
    still: false,        // frozen clock, for reproducible screenshots
    mix: null,
    dirty: true,
  };

  var PRESETS = [
    { name: 'REALISTIC', w: { realistic: 100 } },
    { name: 'CARTOON', w: { cartoon: 100 } },
    { name: 'MAGICAL', w: { magical: 100 } },
    { name: 'SURVEY INK', w: { ink: 100 } },
    { name: 'PIXEL AGE', w: { pixel: 100 } },
    { name: 'DREAM SURVEY', w: { realistic: 55, magical: 45 } },
    { name: 'FAIRY ATLAS', w: { ink: 55, magical: 45 } },
    { name: 'SATURDAY SUPPLEMENT', w: { cartoon: 65, pixel: 35 } },
    { name: 'EVEN BLEND', w: { realistic: 20, cartoon: 20, magical: 20, ink: 20, pixel: 20 } },
  ];

  // ------------------------------------------------------------ toast
  var toastTimer = null;
  function toast(msg) {
    var el = $('pw-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ------------------------------------------------------------ state
  function save() {
    try {
      localStorage.setItem(LSKEY, JSON.stringify({
        seedText: S.seedText, count: S.count, weights: S.weights,
      }));
    } catch (e) { /* a browser with no drawers */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(LSKEY);
      if (!raw) return;
      var st = JSON.parse(raw);
      if (st.seedText) S.seedText = String(st.seedText);
      if (st.count) S.count = Math.max(4, Math.min(24, st.count | 0));
      if (st.weights) {
        PG.STYLE_KEYS.forEach(function (k) {
          if (typeof st.weights[k] === 'number') {
            S.weights[k] = Math.max(0, Math.min(100, st.weights[k]));
          }
        });
      }
    } catch (e) { /* unreadable ledger; start afresh */ }
  }
  function readQuery() {
    var q = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      q[decodeURIComponent(k)] = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
    });
    if (q.seed) S.seedText = q.seed;
    if (q.count) S.count = Math.max(4, Math.min(24, parseInt(q.count, 10) || S.count));
    if (q.still) { S.still = true; S.motion = false; S.time = 4.2; }
    if (q.mix) {
      PG.STYLE_KEYS.forEach(function (k) { S.weights[k] = 0; });
      q.mix.split(',').forEach(function (part) {
        var bits = part.split(':');
        var k = bits[0];
        if (PG.STYLES[k]) S.weights[k] = Math.max(0, parseFloat(bits[1]) || 100);
      });
    }
  }
  function randomSeedText() {
    var syll = ['bas', 'ing', 'stoke', 'pen', 'ge', 'wob', 'urn', 'crum',
      'wain', 'star', 'void', 'ket', 'fern', 'goole', 'ol', 'dri'];
    var out = '';
    for (var i = 0; i < 3; i++) out += syll[(Math.random() * syll.length) | 0];
    return out + ((Math.random() * 90 + 10) | 0);
  }

  // ------------------------------------------------------------ mixing
  function rebuildMix() {
    S.mix = PG.mixStyles(S.weights);
    $('pw-mixnote').textContent = 'ON THE BRUSH: ' + (S.mix.label || '—');
    S.dirty = true;
  }

  // ------------------------------------------------------------ batch
  function specSeed(i) { return S.seedText + '#' + i; }

  function newBatch() {
    S.specs = [];
    var names = {}, kinds = {};
    var kindCap = Math.max(2, Math.ceil(S.count / 4));
    for (var i = 0; i < S.count; i++) {
      // deterministic rerolls keep each batch varied without breaking
      // the promise that a seed always casts the same worlds
      var spec = PG.generate(specSeed(i));
      for (var k = 0; k < 4 &&
          (names[spec.name] || (kinds[spec.arch] || 0) >= kindCap); k++) {
        spec = PG.generate(specSeed(i) + '·' + k);
      }
      names[spec.name] = true;
      kinds[spec.arch] = (kinds[spec.arch] || 0) + 1;
      S.specs.push(spec);
    }
    S.sel = Math.min(S.sel, S.specs.length - 1);
    buildGallery();
    $('pw-batchno').textContent = 'BATCH Nº ' + S.seedText.toUpperCase() +
      ' · ' + S.count + ' WORLDS';
    updateCard();
    S.dirty = true;
  }

  function buildGallery() {
    var box = $('pw-gallery');
    box.innerHTML = '';
    S.tiles = [];
    S.specs.forEach(function (spec, i) {
      var tile = document.createElement('div');
      tile.className = 'pw-tile' + (i === S.sel ? ' selected' : '');
      var cv = document.createElement('canvas');
      var cap = document.createElement('div');
      cap.className = 'pw-cap';
      cap.textContent = spec.name;
      var sub = document.createElement('span');
      sub.textContent = spec.classLabel.toUpperCase();
      cap.appendChild(sub);
      tile.appendChild(cv);
      tile.appendChild(cap);
      tile.addEventListener('click', function () { select(i); });
      box.appendChild(tile);
      S.tiles.push({ tile: tile, canvas: cv, spec: spec });
    });
  }

  function select(i) {
    S.sel = i;
    S.tiles.forEach(function (t, k) {
      t.tile.classList.toggle('selected', k === i);
    });
    updateCard();
    S.dirty = true;
  }

  function updateCard() {
    var spec = S.specs[S.sel];
    if (!spec) return;
    $('pw-name').textContent = spec.name;
    $('pw-desig').textContent = spec.desig.toUpperCase();
    $('pw-class').textContent = spec.classLabel;
    $('pw-diam').textContent = spec.stats.diameter;
    $('pw-day').textContent = spec.stats.day;
    $('pw-moons').textContent = spec.stats.moons;
    $('pw-rings').textContent = spec.stats.rings;
    $('pw-air').textContent = spec.stats.air;
    $('pw-notes').textContent = '“' + spec.notes[0] + ' ' + spec.notes[1] + '”';
  }

  // ------------------------------------------------------------ controls
  var sliderRefresh = [];

  function buildMixer() {
    var box = $('pw-mixer');
    box.innerHTML = '';
    sliderRefresh = [];
    PG.STYLE_KEYS.forEach(function (key) {
      var row = document.createElement('div');
      row.className = 'pw-item';
      var lab = document.createElement('label');
      lab.textContent = PG.STYLES[key].label;
      var rng = document.createElement('input');
      rng.type = 'range';
      rng.min = 0; rng.max = 100; rng.step = 5;
      rng.value = S.weights[key];
      var val = document.createElement('span');
      val.className = 'pw-val';
      val.textContent = S.weights[key] + '%';
      rng.addEventListener('input', function () {
        S.weights[key] = parseFloat(rng.value);
        val.textContent = Math.round(S.weights[key]) + '%';
        rebuildMix();
        save();
      });
      row.appendChild(lab);
      row.appendChild(rng);
      row.appendChild(val);
      box.appendChild(row);
      sliderRefresh.push(function () {
        rng.value = S.weights[key];
        val.textContent = Math.round(S.weights[key]) + '%';
      });
    });

    var chips = $('pw-presets');
    chips.innerHTML = '';
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'pw-btn small';
      b.textContent = p.name;
      b.addEventListener('click', function () {
        PG.STYLE_KEYS.forEach(function (k) { S.weights[k] = p.w[k] || 0; });
        sliderRefresh.forEach(function (f) { f(); });
        rebuildMix();
        save();
        toast('“' + p.name + '” taken from the pattern book.');
      });
      chips.appendChild(b);
    });
  }

  function initActions() {
    $('pw-new').addEventListener('click', function () {
      S.seedText = randomSeedText();
      $('pw-seed').value = S.seedText;
      newBatch();
      save();
      toast('A fresh batch, still warm from the forge.');
    });

    $('pw-motion').addEventListener('click', function () {
      S.motion = !S.motion;
      $('pw-motion').classList.toggle('active', S.motion);
      S.dirty = true;
    });

    $('pw-count').addEventListener('input', function () {
      S.count = parseInt($('pw-count').value, 10);
      $('pw-count-val').textContent = S.count;
      newBatch();
      save();
    });

    $('pw-useseed').addEventListener('click', function () {
      var v = $('pw-seed').value.trim();
      if (!v) { toast('The forge requires a seed, however small.'); return; }
      S.seedText = v;
      newBatch();
      save();
      toast('Cast from seed “' + v + '”. The same seed casts the same worlds.');
    });
    $('pw-seed').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('pw-useseed').click();
    });

    $('pw-reroll').addEventListener('click', function () {
      var spec = PG.generate(randomSeedText() + '!' + Date.now());
      S.specs[S.sel] = spec;
      var t = S.tiles[S.sel];
      t.spec = spec;
      t.tile.querySelector('.pw-cap').childNodes[0].textContent = spec.name;
      t.tile.querySelector('.pw-cap span').textContent = spec.classLabel.toUpperCase();
      updateCard();
      S.dirty = true;
      toast('Melted down and recast. No two pours alike.');
    });

    $('pw-copyspec').addEventListener('click', function () {
      var spec = S.specs[S.sel];
      if (!spec) return;
      var out = JSON.stringify({ styleMix: S.weights, spec: spec }, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out).then(function () {
          toast('Specification copied. Handle with clean gloves.');
        }, function () { toast('The clipboard declined. Most irregular.'); });
      } else {
        toast('No clipboard in this browser; the spec stays on the bench.');
      }
    });
  }

  // ------------------------------------------------------------ painting
  function drawAll(budget) {
    var spec = S.specs[S.sel];
    if (spec) PG.renderInto($('pw-detail'), spec, S.mix, S.time, { budget: budget, maxTex: 288 });
    S.tiles.forEach(function (t) {
      PG.renderInto(t.canvas, t.spec, S.mix, S.time, { budget: budget, maxTex: 128 });
    });
  }

  var lastT = 0;
  function loop(t) {
    var dt = Math.min((t - lastT) / 1000, 0.1) || 0.016;
    lastT = t;
    if (S.motion) S.time += dt;
    if (S.motion || S.dirty) {
      var budget = { n: 3 };   // textures rebuilt a few per frame
      drawAll(budget);
      if (!S.motion) S.dirty = budget.n <= 0;  // stale textures remain
    }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ boot
  window.addEventListener('load', function () {
    load();
    readQuery();
    if (!S.seedText) S.seedText = randomSeedText();
    $('pw-seed').value = S.seedText;
    $('pw-count').value = S.count;
    $('pw-count-val').textContent = S.count;
    $('pw-motion').classList.toggle('active', S.motion);
    buildMixer();
    rebuildMix();
    initActions();
    newBatch();
    window.addEventListener('resize', function () { S.dirty = true; });
    requestAnimationFrame(loop);
  });
})();
