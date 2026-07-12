/* Crump & Wainwright — Interstellar Freight Services
   theme.js — every VISUAL number and colour lives here. The Drawing
   Office (design.html) edits these values live; the game reads them
   at boot from localStorage. Gameplay numbers stay in config.js. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  // ---------------------------------------------------------------
  // Defaults — the Factory finish, as first approved by the Board.
  // ---------------------------------------------------------------
  CW.THEME_DEFAULTS = {
    // Palette
    ink: '#0b1017',            // deep space / page ink
    inkRaise: '#121926',       // raised panels (HUD, memos)
    parch: '#e9e0c9',          // parchment — glyphs, rings, text
    brass: '#c9a227',          // company brass
    amber: '#dca94b',          // caution
    red: '#d4574f',            // distress
    starColour: '#d6def0',

    // Corridor livery (paints from the company stores)
    corridor0: '#c9a227', corridor1: '#3fa88e', corridor2: '#c25450',
    corridor3: '#6f9bd8', corridor4: '#a273b8', corridor5: '#cf7b3e',
    corridor6: '#8fae5c', corridor7: '#d8d2e0',

    // Planet tints
    planet0: '#46587a', planet1: '#4b6a6c', planet2: '#6b584a',
    planet3: '#6a4c5a', planet4: '#4b6653', planet5: '#584f6e',
    planet6: '#665f44', planet7: '#4c5d72',

    // Background & survey chart
    vignette: 1.0,             // edge darkening strength
    starCount: 150,
    starSize: 1.0,
    starBrightness: 1.0,
    gridOpacity: 1.0,          // survey circles/radials visibility
    gridSpacing: 150,          // world units between survey circles
    gridRadials: 12,

    // Nebulae
    nebulaGlow: 1.0,           // luminous body strength
    nebulaWisps: 1.0,          // drifting inner wisps
    nebulaHatch: 1.0,          // survey hatching visibility
    hatchSpacing: 17,
    nebulaSparks: 1.0,         // ionisation sparks
    nebulaHueShift: 0,         // degrees, added to each nebula's hue
    nebulaSat: 1.0,            // saturation multiplier

    // Planets (colonies)
    colonyR: 15,
    specialR: 19,
    planetLight: 0.32,         // lit-side brightening
    planetShade: 0.62,         // limb-edge darkening
    surfaceDetail: 1.0,        // bands / craters contrast
    terminator: 1.0,           // night-side shadow strength
    limbLight: 1.0,            // thin lit-edge arc
    halo: 1.0,                 // colony halo glow
    specialRing: 1.0,          // ringed-world ring opacity
    glyphScale: 0.56,          // glyph size as fraction of radius
    glyphLine: 1.9,

    // Generated worlds — the Planetary Works supplies the frontier.
    // Style weights mix like paint, exactly as in planets.html.
    worldPlanets: 1,           // 1 = procedural worlds, 0 = classic discs
    worldRealistic: 100,
    worldCartoon: 0,
    worldMagical: 100,
    worldInk: 100,
    worldPixel: 0,
    worldAxis: 1.0,            // how much of each world's axial lean shows
    worldSizeVar: 0.6,         // portion of each world's ±50% size shown
    worldShimmer: 1.6,         // aura & sparkle boost on the route chart

    // Freight band & reserve gauge (the gauge rides the band's outer
    // line; ringGap is retired but kept for saved-theme compat)
    bandIn: 24,                // colony freight band, inner line radius
    bandOut: 32,               // colony freight band, outer line radius
    bandLine: 1,               // freight band line weight
    ringGap: 7,
    ringWidth: 2.6,            // reserve gauge line weight

    // Hyperspace conduits
    corridorW: 7.2,
    conduitGlow: 1.0,          // ambient field + interior light
    conduitHollow: 3,          // channel inset (bigger = thinner rails)
    pulseLen: 3,               // travelling energy pulse length
    pulseGap: 13,
    pulseSpeed: 26,
    pulseAlpha: 0.55,
    relayScale: 1.0,

    // Vessels
    shipL: 30,
    shipW: 11,
    shipTrim: 0.75,            // parchment trim stroke opacity
    exhaust: 1.0,              // engine flame intensity
    trailAlpha: 1.0,           // engine trail strength
    cargoCell: 5.6,            // container size on pod barges
    shipRingIn: 24,            // vessel consignment ring, inner line radius
    shipRingOut: 32,           // vessel consignment ring, outer line radius
    shipRingLine: 1,           // vessel ring line weight
    cargoRingGlyph: 4.6,       // consignment glyph size (aboard ship)
    cargoRingAlpha: 0.17,      // consignment ring & freight band ink

    // Miscellaneous
    crateR: 4.8,               // waiting-crate glyph size (in the band)
    cargoBold: 0.3,            // extra stroke weight on cargo glyphs

    // Lettering (HUD & memoranda)
    uiFont: 'iowan',
  };

  CW.THEME_FONTS = {
    iowan:   { label: 'Iowan Old Style (factory)', stack: '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif' },
    georgia: { label: 'Georgia', stack: 'Georgia,"Times New Roman",serif' },
    palatino:{ label: 'Palatino', stack: '"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif' },
    times:   { label: 'Times', stack: '"Times New Roman",Times,serif' },
    courier: { label: 'Courier (typing pool)', stack: '"Courier New",Courier,monospace' },
    system:  { label: 'System sans', stack: 'ui-sans-serif,system-ui,"Helvetica Neue",Arial,sans-serif' },
  };

  // ---------------------------------------------------------------
  // Schema for the Drawing Office. item: [key, label, type, min, max, step]
  // type: 'color' | 'range' | 'font'
  // ---------------------------------------------------------------
  CW.THEME_SCHEMA = [
    { group: 'Palette', items: [
      ['ink', 'Space ink', 'color'],
      ['inkRaise', 'Panel ink', 'color'],
      ['parch', 'Parchment', 'color'],
      ['brass', 'Company brass', 'color'],
      ['amber', 'Caution amber', 'color'],
      ['red', 'Distress red', 'color'],
      ['starColour', 'Starlight', 'color'],
      ['uiFont', 'Lettering', 'font'],
    ]},
    { group: 'Corridor Livery', items: [
      ['corridor0', 'Brass', 'color'],
      ['corridor1', 'Verdigris', 'color'],
      ['corridor2', 'Signal Red', 'color'],
      ['corridor3', 'Wedgwood Blue', 'color'],
      ['corridor4', 'Plum', 'color'],
      ['corridor5', 'Furnace Orange', 'color'],
      ['corridor6', 'Cabbage', 'color'],
      ['corridor7', 'Porcelain', 'color'],
    ]},
    { group: 'Planet Tints', items: [
      ['planet0', 'Tint I', 'color'], ['planet1', 'Tint II', 'color'],
      ['planet2', 'Tint III', 'color'], ['planet3', 'Tint IV', 'color'],
      ['planet4', 'Tint V', 'color'], ['planet5', 'Tint VI', 'color'],
      ['planet6', 'Tint VII', 'color'], ['planet7', 'Tint VIII', 'color'],
    ]},
    { group: 'Background & Survey Chart', items: [
      ['vignette', 'Edge vignette', 'range', 0, 2, 0.05],
      ['starCount', 'Star count', 'range', 0, 400, 10],
      ['starSize', 'Star size', 'range', 0.5, 3, 0.1],
      ['starBrightness', 'Star brightness', 'range', 0, 3, 0.1],
      ['gridOpacity', 'Survey grid', 'range', 0, 3, 0.1],
      ['gridSpacing', 'Grid ring spacing', 'range', 60, 300, 10],
      ['gridRadials', 'Grid radials', 'range', 0, 24, 1],
    ]},
    { group: 'Nebulae', items: [
      ['nebulaGlow', 'Body glow', 'range', 0, 2.5, 0.05],
      ['nebulaWisps', 'Inner wisps', 'range', 0, 3, 0.1],
      ['nebulaHatch', 'Survey hatching', 'range', 0, 3, 0.1],
      ['hatchSpacing', 'Hatch spacing', 'range', 8, 40, 1],
      ['nebulaSparks', 'Ionisation sparks', 'range', 0, 2, 0.1],
      ['nebulaHueShift', 'Hue shift (°)', 'range', -180, 180, 5],
      ['nebulaSat', 'Saturation', 'range', 0, 1.6, 0.05],
    ]},
    { group: 'Planets', items: [
      ['colonyR', 'Colony radius', 'range', 9, 24, 0.5],
      ['specialR', 'Designated radius', 'range', 12, 30, 0.5],
      ['planetLight', 'Lit-side light', 'range', 0, 0.8, 0.02],
      ['planetShade', 'Limb shading', 'range', 0, 1, 0.02],
      ['surfaceDetail', 'Surface detail', 'range', 0, 3, 0.1],
      ['terminator', 'Night side', 'range', 0, 2, 0.05],
      ['limbLight', 'Lit edge arc', 'range', 0, 3, 0.1],
      ['halo', 'Halo glow', 'range', 0, 3, 0.1],
      ['specialRing', 'World rings', 'range', 0, 2, 0.05],
      ['glyphScale', 'Glyph size', 'range', 0.3, 0.85, 0.01],
      ['glyphLine', 'Glyph line weight', 'range', 1, 5, 0.1],
      ['bandIn', 'Band inner radius', 'range', 12, 34, 0.5],
      ['bandOut', 'Band outer radius', 'range', 16, 44, 0.5],
      ['bandLine', 'Band line weight', 'range', 0.4, 3, 0.1],
      ['ringWidth', 'Gauge line weight', 'range', 1, 6, 0.1],
    ]},
    { group: 'Generated Worlds', items: [
      ['worldPlanets', 'Procedural worlds', 'range', 0, 1, 1],
      ['worldRealistic', 'Realistic', 'range', 0, 100, 5],
      ['worldCartoon', 'Cartoon', 'range', 0, 100, 5],
      ['worldMagical', 'Magical', 'range', 0, 100, 5],
      ['worldInk', 'Survey Ink', 'range', 0, 100, 5],
      ['worldPixel', 'Pixel Age', 'range', 0, 100, 5],
      ['worldAxis', 'Axis variation', 'range', 0, 1, 0.05],
      ['worldSizeVar', 'Size variation', 'range', 0, 1, 0.05],
      ['worldShimmer', 'Shimmer', 'range', 0, 3, 0.1],
    ]},
    { group: 'Hyperspace Conduits', items: [
      ['corridorW', 'Conduit width', 'range', 3, 14, 0.2],
      ['conduitGlow', 'Field glow', 'range', 0, 3, 0.1],
      ['conduitHollow', 'Channel hollow', 'range', 0, 8, 0.2],
      ['pulseLen', 'Pulse length', 'range', 1, 12, 0.5],
      ['pulseGap', 'Pulse spacing', 'range', 4, 40, 1],
      ['pulseSpeed', 'Pulse speed', 'range', 0, 90, 2],
      ['pulseAlpha', 'Pulse brightness', 'range', 0, 1, 0.05],
      ['relayScale', 'Relay beacon size', 'range', 0.5, 2, 0.05],
    ]},
    { group: 'Vessels', items: [
      ['shipL', 'Hull length', 'range', 18, 48, 1],
      ['shipW', 'Hull beam', 'range', 7, 18, 0.5],
      ['shipTrim', 'Trim brightness', 'range', 0, 1, 0.05],
      ['exhaust', 'Exhaust flame', 'range', 0, 3, 0.1],
      ['trailAlpha', 'Engine trail', 'range', 0, 3, 0.1],
      ['cargoCell', 'Barge container size', 'range', 4, 7.5, 0.1],
      ['shipRingIn', 'Ring inner radius', 'range', 12, 36, 0.5],
      ['shipRingOut', 'Ring outer radius', 'range', 16, 46, 0.5],
      ['shipRingLine', 'Ring line weight', 'range', 0.4, 3, 0.1],
      ['cargoRingGlyph', 'Ship cargo glyph size', 'range', 2.5, 8, 0.1],
      ['cargoRingAlpha', 'Ring & band ink', 'range', 0, 0.6, 0.01],
      ['crateR', 'Band crate size', 'range', 2.5, 8, 0.1],
      ['cargoBold', 'Cargo glyph weight', 'range', 0, 2, 0.05],
    ]},
  ];

  // ---------------------------------------------------------------
  // House styles — alternative finishes held in the pattern store.
  // Partial diffs applied over the factory defaults.
  // ---------------------------------------------------------------
  CW.THEME_PRESETS = {
    'Factory Finish': {},
    'Blueprint': {
      ink: '#0c1c33', inkRaise: '#132741', parch: '#dcebff',
      brass: '#9fc2ee', amber: '#e8d27a', starColour: '#eaf2ff',
      corridor0: '#eaf2ff', corridor1: '#a8c8f0', corridor2: '#ff9d94',
      corridor3: '#7fd0d8', corridor4: '#c9b3f0', corridor5: '#f0c48a',
      corridor6: '#b8e0a0', corridor7: '#f5f0ff',
      planet0: '#2e4a73', planet1: '#33567d', planet2: '#3d5d86',
      planet3: '#28466e', planet4: '#356084', planet5: '#2f4f78',
      planet6: '#3a5a80', planet7: '#2b4a70',
      gridOpacity: 2.2, gridRadials: 24, nebulaSat: 0.45,
      nebulaHueShift: -40, surfaceDetail: 0.6, vignette: 0.7,
    },
    'Gaslight': {
      ink: '#171310', inkRaise: '#221c16', parch: '#f2e3c2',
      brass: '#d9a637', amber: '#e0a94e', starColour: '#f0e2c8',
      corridor0: '#d9a637', corridor1: '#7da05e', corridor2: '#c25a45',
      corridor3: '#8f9fc0', corridor4: '#a97a9a', corridor5: '#d08040',
      corridor6: '#a4a35a', corridor7: '#e5d9c5',
      planet0: '#6a5a44', planet1: '#5d5a48', planet2: '#75543e',
      planet3: '#6e4e48', planet4: '#5a5f46', planet5: '#645648',
      planet6: '#70603e', planet7: '#5e5648',
      nebulaHueShift: 160, nebulaSat: 0.55, vignette: 1.4,
      halo: 1.5, uiFont: 'palatino',
    },
    'Signal Room': {
      ink: '#06110b', inkRaise: '#0a1b12', parch: '#c8ecd2',
      brass: '#63d68a', amber: '#d6d663', red: '#e06060',
      starColour: '#bfe8cc',
      corridor0: '#63d68a', corridor1: '#3fa88e', corridor2: '#e06060',
      corridor3: '#5fb8d8', corridor4: '#9a86d8', corridor5: '#d6a04e',
      corridor6: '#a0c860', corridor7: '#d8e8d8',
      planet0: '#2e5a42', planet1: '#33604e', planet2: '#3a5a3a',
      planet3: '#28513e', planet4: '#356045', planet5: '#2f5748',
      planet6: '#3a6040', planet7: '#2b523e',
      nebulaHueShift: -80, gridOpacity: 1.6, uiFont: 'courier',
      starBrightness: 0.6, pulseSpeed: 42, pulseAlpha: 0.75,
    },
  };

  // ---------------------------------------------------------------
  // Persistence & application
  // ---------------------------------------------------------------
  var STORE_KEY = 'cw_theme_v1';

  function validValue(def, v) {
    if (typeof def === 'number') return typeof v === 'number' && isFinite(v);
    return typeof v === 'string' && v.length < 80;
  }

  CW.loadTheme = function () {
    var th = {};
    Object.keys(CW.THEME_DEFAULTS).forEach(function (k) { th[k] = CW.THEME_DEFAULTS[k]; });
    try {
      var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        Object.keys(saved).forEach(function (k) {
          if (k in th && validValue(CW.THEME_DEFAULTS[k], saved[k])) th[k] = saved[k];
        });
      }
    } catch (e) { /* an unreadable pattern book is quietly reshelved */ }
    return th;
  };

  CW.saveTheme = function (th) {
    var diff = {};
    Object.keys(CW.THEME_DEFAULTS).forEach(function (k) {
      if (th[k] !== CW.THEME_DEFAULTS[k]) diff[k] = th[k];
    });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(diff)); } catch (e) {}
    return diff;
  };

  CW.resetTheme = function (th) {
    Object.keys(CW.THEME_DEFAULTS).forEach(function (k) { th[k] = CW.THEME_DEFAULTS[k]; });
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  };

  CW.applyPreset = function (th, name) {
    var p = CW.THEME_PRESETS[name];
    if (!p) return;
    Object.keys(CW.THEME_DEFAULTS).forEach(function (k) {
      th[k] = (k in p) ? p[k] : CW.THEME_DEFAULTS[k];
    });
  };

  function alphaHex(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* Push the theme into everything that cannot read it per-frame:
     CSS variables (HUD, memoranda) and the shared corridor livery. */
  CW.applyTheme = function () {
    var th = CW.theme;
    var root = document.documentElement.style;
    root.setProperty('--ink', th.ink);
    root.setProperty('--ink-raise', th.inkRaise);
    root.setProperty('--parch', th.parch);
    root.setProperty('--parch-dim', alphaHex(th.parch, 0.55));
    root.setProperty('--parch-faint', alphaHex(th.parch, 0.22));
    root.setProperty('--brass', th.brass);
    root.setProperty('--red', th.red);
    var font = CW.THEME_FONTS[th.uiFont] || CW.THEME_FONTS.iowan;
    root.setProperty('--serif', font.stack);
    CW.themeFont = font.stack;
    for (var i = 0; i < CW.CORRIDOR_COLOURS.length; i++) {
      CW.CORRIDOR_COLOURS[i].hex = th['corridor' + i];
    }
  };

  CW.theme = CW.loadTheme();
  CW.applyTheme();
})();
