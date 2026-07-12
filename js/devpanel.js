/* devpanel.js — The Tuning Office. Strictly staff only.
   Open with ` or F2 on a keyboard, or tap the C&W monogram five times
   in quick succession. Every gameplay variable can be adjusted live;
   changes persist to localStorage until Reset is pressed. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var panel = null;
  var visible = false;
  var taps = [];
  var metricsEl = null;
  var inputs = {};
  var themeInputs = {};
  var themeSaveTimer = null;

  function build() {
    panel = document.createElement('div');
    panel.id = 'devpanel';
    panel.innerHTML =
      '<div class="dp-head">' +
      '<div class="dp-title">THE TUNING OFFICE</div>' +
      '<div class="dp-sub">Strictly staff only. Kindly close the door.</div>' +
      '<button class="dp-close" id="dp-close">×</button>' +
      '</div>';

    var body = document.createElement('div');
    body.className = 'dp-body';
    panel.appendChild(body);

    // live metrics
    var mGroup = section(body, 'Operations Ledger (live)');
    metricsEl = document.createElement('div');
    metricsEl.className = 'dp-metrics';
    mGroup.appendChild(metricsEl);

    // time scale + god mode
    var cGroup = section(body, 'Direct Intervention');
    var ts = sliderRow(cGroup, 'Time scale ×', 0, 8, 0.25, 1, function (v) {
      if (CW.game) CW.game.cheatTimeScale = v;
    });
    inputs.__timescale = ts;

    var inv = document.createElement('label');
    inv.className = 'dp-check';
    inv.innerHTML = '<input type="checkbox" id="dp-invincible"> Colonies may not fail (inspection mode)';
    cGroup.appendChild(inv);
    inv.querySelector('input').addEventListener('change', function (e) {
      if (CW.game) CW.game.invincible = e.target.checked;
    });

    var btnRow = document.createElement('div');
    btnRow.className = 'dp-btnrow';
    cGroup.appendChild(btnRow);
    [
      ['+ Vessel', function (g) { g.cheat.addShip(); }],
      ['+ Corridor', function (g) { g.cheat.addCorridor(); }],
      ['+ Relay', function (g) { g.cheat.addRelay(); }],
      ['+ Pod', function (g) { g.cheat.addPod(); }],
      ['+ Hub', function (g) { g.cheat.addHub(); }],
      ['Spawn colony', function (g) { g.cheat.spawnColony(); }],
      ['Spawn special', function (g) { g.cheat.spawnSpecial(); }],
      ['Weekly review', function (g) { g.cheat.triggerReview(); }],
      ['Fill reserves', function (g) { g.cheat.fillReserves(); }],
    ].forEach(function (def) {
      var b = document.createElement('button');
      b.className = 'dp-btn';
      b.textContent = def[0];
      b.addEventListener('click', function () { if (CW.game) def[1](CW.game); });
      btnRow.appendChild(b);
    });

    // tunables from schema
    CW.TUNING_SCHEMA.forEach(function (group) {
      var g = section(body, group.group);
      group.items.forEach(function (item) {
        var key = item[0];
        inputs[key] = sliderRow(g, item[1], item[2], item[3], item[4], CW.config[key], function (v) {
          CW.config[key] = v;
        });
      });
    });

    // chart appearance: a handful of THEME values kept within reach of
    // the duty officer. Ranges come from THEME_SCHEMA; changes file
    // themselves to the browser at once (the Drawing Office holds the
    // full ledger).
    var aGroup = section(body, 'Chart Appearance');
    var APPEAR = [
      ['bandIn', 'Planet band: inner radius'],
      ['bandOut', 'Planet band: outer radius'],
      ['bandLine', 'Planet band: line weight'],
      ['ringWidth', 'Planet band: gauge weight'],
      ['shipRingIn', 'Ship ring: inner radius'],
      ['shipRingOut', 'Ship ring: outer radius'],
      ['shipRingLine', 'Ship ring: line weight'],
      ['cargoRingGlyph', 'Cargo icons: size aboard ship'],
      ['crateR', 'Cargo icons: size in the band'],
      ['cargoBold', 'Cargo icons: weight'],
    ];
    var themeRange = {};
    CW.THEME_SCHEMA.forEach(function (group) {
      group.items.forEach(function (item) { themeRange[item[0]] = item; });
    });
    APPEAR.forEach(function (def) {
      var key = def[0], sch = themeRange[key];
      themeInputs[key] = sliderRow(aGroup, def[1], sch[3], sch[4], sch[5],
        CW.theme[key], function (v) {
          CW.theme[key] = v;
          clearTimeout(themeSaveTimer);
          themeSaveTimer = setTimeout(function () { CW.saveTheme(CW.theme); }, 400);
        });
    });
    var aRow = document.createElement('div');
    aRow.className = 'dp-btnrow';
    aGroup.appendChild(aRow);
    var aReset = document.createElement('button');
    aReset.className = 'dp-btn';
    aReset.textContent = 'Factory appearance';
    aReset.addEventListener('click', function () {
      APPEAR.forEach(function (def) {
        CW.theme[def[0]] = CW.THEME_DEFAULTS[def[0]];
      });
      CW.saveTheme(CW.theme);
      refreshSliders();
      flash(aReset, 'Restored.');
    });
    aRow.appendChild(aReset);
    var aNote = document.createElement('div');
    aNote.className = 'dp-note';
    aNote.textContent = 'Appearance values file themselves at once and are honoured by the Drawing Office.';
    aGroup.appendChild(aNote);

    // persistence controls
    var pGroup = section(body, 'Filing');
    var pRow = document.createElement('div');
    pRow.className = 'dp-btnrow';
    pGroup.appendChild(pRow);

    var save = document.createElement('button');
    save.className = 'dp-btn dp-primary';
    save.textContent = 'Save to this browser';
    save.addEventListener('click', function () {
      CW.saveConfig(CW.config);
      flash(save, 'Filed.');
    });
    pRow.appendChild(save);

    var reset = document.createElement('button');
    reset.className = 'dp-btn';
    reset.textContent = 'Reset to factory';
    reset.addEventListener('click', function () {
      CW.resetConfig(CW.config);
      refreshSliders();
      flash(reset, 'Restored.');
    });
    pRow.appendChild(reset);

    var copy = document.createElement('button');
    copy.className = 'dp-btn';
    copy.textContent = 'Copy JSON';
    copy.addEventListener('click', function () {
      var diff = {};
      Object.keys(CW.DEFAULTS).forEach(function (k) {
        if (CW.config[k] !== CW.DEFAULTS[k]) diff[k] = CW.config[k];
      });
      var text = JSON.stringify(diff, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { flash(copy, 'Copied.'); });
      else { window.prompt('Current overrides:', text); }
    });
    pRow.appendChild(copy);

    var note = document.createElement('div');
    note.className = 'dp-note';
    note.textContent = 'Changes apply immediately. Some (starting inventory, map shape) take effect on the next game.';
    pGroup.appendChild(note);

    document.body.appendChild(panel);
    panel.querySelector('#dp-close').addEventListener('click', toggle);

    setInterval(updateMetrics, 500);
  }

  function section(parent, title) {
    var s = document.createElement('div');
    s.className = 'dp-section';
    var h = document.createElement('div');
    h.className = 'dp-section-title';
    h.textContent = title;
    s.appendChild(h);
    parent.appendChild(s);
    return s;
  }

  function sliderRow(parent, label, min, max, step, value, onChange) {
    var row = document.createElement('div');
    row.className = 'dp-row';
    var lab = document.createElement('label');
    lab.textContent = label;
    var val = document.createElement('span');
    val.className = 'dp-val';
    val.textContent = fmt(value);
    var input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = step; input.value = value;
    input.addEventListener('input', function () {
      var v = parseFloat(input.value);
      val.textContent = fmt(v);
      onChange(v);
    });
    row.appendChild(lab);
    row.appendChild(input);
    row.appendChild(val);
    parent.appendChild(row);
    return { input: input, val: val };
  }

  function fmt(v) { return (Math.round(v * 1000) / 1000).toString(); }

  function refreshSliders() {
    Object.keys(inputs).forEach(function (key) {
      if (key.slice(0, 2) === '__') return;
      inputs[key].input.value = CW.config[key];
      inputs[key].val.textContent = fmt(CW.config[key]);
    });
    Object.keys(themeInputs).forEach(function (key) {
      themeInputs[key].input.value = CW.theme[key];
      themeInputs[key].val.textContent = fmt(CW.theme[key]);
    });
  }

  function flash(btn, msg) {
    var old = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = old; }, 900);
  }

  function updateMetrics() {
    if (!visible || !CW.game) return;
    var m = CW.game.metrics();
    metricsEl.innerHTML =
      row('Day', m.day) + row('Colonies', m.colonies) +
      row('Avg reserve', Math.round(m.avgReserve * 100) + '%') +
      row('Crates waiting', m.waiting) + row('Crates in transit', m.inTransit) +
      row('Delivered (total)', m.delivered) + row('Deliveries / min', m.perMin);
    function row(k, v) { return '<div><span>' + k + '</span><span>' + v + '</span></div>'; }
  }

  function toggle() {
    if (!panel) build();
    visible = !visible;
    panel.classList.toggle('visible', visible);
    if (visible) refreshSliders();
  }

  CW.toggleDevPanel = toggle;

  CW.initDevPanel = function (brandEl) {
    window.addEventListener('keydown', function (e) {
      if (e.key === '`' || e.key === 'F2') { e.preventDefault(); toggle(); }
    });
    // five quick taps on the monogram
    brandEl.addEventListener('click', function () {
      var now = performance.now();
      taps.push(now);
      taps = taps.filter(function (t) { return now - t < 2000; });
      if (taps.length >= 5) { taps = []; toggle(); }
    });
  };
})();
