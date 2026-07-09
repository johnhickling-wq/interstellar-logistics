/* planetgen.js — the engine room of the Planetary Works. A
   self-contained procedural world generator and painter: hand it a
   seed and it returns a planet SPECIFICATION (pure, serialisable
   data — archetype, size, tints, rings, moons, weather); hand the
   spec back with a canvas, a radius and a style mix and it paints
   the world. It touches no DOM and no game state, so the whole
   module can be lifted into the game unchanged.

     CW.PlanetGen.generate(seed)            -> spec
     CW.PlanetGen.mixStyles({cartoon: 60,
                             magical: 40})  -> blended style params
     CW.PlanetGen.render(ctx, spec, x, y, r, mixOrName, t, opts)
     CW.PlanetGen.renderInto(canvas, spec, mixOrName, t, opts)

   Styles are parameter sets, not code paths: every knob (outline,
   posterisation, saturation, hatching, sparkle, pixelation…) blends
   linearly, so any weighted mixture of styles is itself a style. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  // ------------------------------------------------------ seeded rng
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(v) {
    var s = String(v), h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function smooth(e0, e1, v) {
    var t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ------------------------------------------------------ colour
  var INK = [11, 16, 23], PARCH = [233, 224, 201], BRASS = [201, 162, 39];
  function hsl(h, s, l) {  // h degrees, s/l 0..1 -> [r,g,b]
    h = (((h % 360) + 360) % 360) / 360;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function f(t) {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255),
            Math.round(f(h - 1 / 3) * 255)];
  }
  function css(c, a) {
    if (a == null) return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  }
  function mixc(a, b, f) {
    return [Math.round(a[0] + (b[0] - a[0]) * f),
            Math.round(a[1] + (b[1] - a[1]) * f),
            Math.round(a[2] + (b[2] - a[2]) * f)];
  }
  // hue-rotation matrix (luminance-preserving enough for our purposes)
  function hueMatrix(deg) {
    var c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180);
    return [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ];
  }
  function rampLUT(stops) {  // stops: [[t, [r,g,b]], …] sorted by t
    var lut = new Uint8ClampedArray(256 * 3);
    for (var i = 0; i < 256; i++) {
      var t = i / 255, k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      var a = stops[k], b = stops[k + 1];
      var f = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
      var c = mixc(a[1], b[1], f);
      lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
    }
    return lut;
  }

  // ------------------------------------------------------ 3D value noise
  // Sampled on a cylinder so every texture wraps seamlessly east-west.
  function makeNoise(rng) {
    var p = new Uint8Array(512);
    var i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      j = (rng() * (i + 1)) | 0;
      t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (i = 0; i < 256; i++) p[256 + i] = p[i];
    function fade(u) { return u * u * (3 - 2 * u); }
    function lat(ix, iy, iz) {
      return p[(p[(p[ix & 255] + iy) & 255] + iz) & 255] / 255;
    }
    function noise3(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
      var c000 = lat(xi, yi, zi), c100 = lat(xi + 1, yi, zi);
      var c010 = lat(xi, yi + 1, zi), c110 = lat(xi + 1, yi + 1, zi);
      var c001 = lat(xi, yi, zi + 1), c101 = lat(xi + 1, yi, zi + 1);
      var c011 = lat(xi, yi + 1, zi + 1), c111 = lat(xi + 1, yi + 1, zi + 1);
      var x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
      var x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
      var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
      return y0 + (y1 - y0) * w;
    }
    function fbm(x, y, z, oct) {
      var sum = 0, amp = 0.5, norm = 0, f = 1;
      for (var o = 0; o < oct; o++) {
        sum += noise3(x * f, y * f, z * f) * amp;
        norm += amp; amp *= 0.55; f *= 2.17;
      }
      return sum / norm;
    }
    function ridge(x, y, z, oct) {
      return 1 - Math.abs(fbm(x, y, z, oct) * 2 - 1);
    }
    return { noise3: noise3, fbm: fbm, ridge: ridge };
  }

  // ------------------------------------------------------ styles
  // Every parameter is 0..1 (sat is a straight multiplier) and blends
  // linearly, which is what makes style merging possible.
  var STYLES = {
    realistic: { label: 'Realistic', detail: 1.00, poster: 0.00, sat: 0.95,
      cel: 0.00, gloss: 0.10, outline: 0.00, wobble: 0.00, glow: 0.14,
      sparkle: 0.00, hatch: 0.00, pixel: 0.00, rim: 0.85, irid: 0.04,
      duo: 0.00, shade: 1.00 },
    cartoon: { label: 'Cartoon', detail: 0.45, poster: 0.85, sat: 1.32,
      cel: 0.90, gloss: 0.85, outline: 1.00, wobble: 0.60, glow: 0.07,
      sparkle: 0.05, hatch: 0.00, pixel: 0.00, rim: 0.35, irid: 0.00,
      duo: 0.00, shade: 0.55 },
    magical: { label: 'Magical', detail: 0.70, poster: 0.12, sat: 1.18,
      cel: 0.20, gloss: 0.30, outline: 0.15, wobble: 0.10, glow: 1.00,
      sparkle: 1.00, hatch: 0.00, pixel: 0.00, rim: 1.00, irid: 0.80,
      duo: 0.05, shade: 0.80 },
    ink: { label: 'Survey Ink', detail: 0.80, poster: 0.40, sat: 0.30,
      cel: 0.25, gloss: 0.00, outline: 0.50, wobble: 0.00, glow: 0.05,
      sparkle: 0.00, hatch: 1.00, pixel: 0.00, rim: 0.50, irid: 0.00,
      duo: 0.95, shade: 0.90 },
    pixel: { label: 'Pixel Age', detail: 0.55, poster: 0.70, sat: 1.12,
      cel: 0.60, gloss: 0.35, outline: 0.40, wobble: 0.00, glow: 0.06,
      sparkle: 0.12, hatch: 0.00, pixel: 1.00, rim: 0.30, irid: 0.05,
      duo: 0.00, shade: 0.70 },
  };
  var STYLE_KEYS = ['realistic', 'cartoon', 'magical', 'ink', 'pixel'];
  var NUMERIC = ['detail', 'poster', 'sat', 'cel', 'gloss', 'outline',
    'wobble', 'glow', 'sparkle', 'hatch', 'pixel', 'rim', 'irid', 'duo',
    'shade'];

  function mixStyles(weights) {
    var total = 0, k;
    for (k in weights) if (STYLES[k]) total += Math.max(0, weights[k] || 0);
    if (total <= 0) { weights = { realistic: 1 }; total = 1; }
    var P = { _mixed: true, label: [] };
    NUMERIC.forEach(function (key) { P[key] = 0; });
    STYLE_KEYS.forEach(function (sk) {
      var w = Math.max(0, weights[sk] || 0) / total;
      if (w <= 0.001) return;
      P.label.push(STYLES[sk].label + ' ' + Math.round(w * 100) + '%');
      NUMERIC.forEach(function (key) { P[key] += STYLES[sk][key] * w; });
    });
    P.label = P.label.join(' · ');
    return P;
  }
  function resolveStyle(mix) {
    if (mix && mix._mixed) return mix;
    if (typeof mix === 'string' && STYLES[mix]) {
      var w = {}; w[mix] = 1;
      return mixStyles(w);
    }
    return mixStyles(mix || { realistic: 1 });
  }

  // ------------------------------------------------------ archetypes
  var ARCHS = [
    { id: 'terran', w: 15, label: 'Verdant World' },
    { id: 'ocean',  w: 10, label: 'Pelagic World' },
    { id: 'desert', w: 12, label: 'Dust World' },
    { id: 'ice',    w: 11, label: 'Glacial World' },
    { id: 'lava',   w: 9,  label: 'Foundry World' },
    { id: 'gas',    w: 16, label: 'Gas Colossus' },
    { id: 'rock',   w: 12, label: 'Barren World' },
    { id: 'toxic',  w: 8,  label: 'Miasmic World' },
    { id: 'exotic', w: 7,  label: 'Anomalous World' },
  ];

  var ARCH_NOTES = {
    terran: 'Green in the right places. The Board is cautiously delighted.',
    ocean: 'Entirely sea. Recommend the immediate export of towels.',
    desert: 'Sand; then, upon closer inspection, further sand.',
    ice: 'Cold enough to preserve the minutes of every meeting ever held.',
    lava: 'The surface is enthusiastic. Landing is discouraged.',
    gas: 'No surface to speak of. Freight must keep to orbit.',
    rock: 'Quiet, cratered, and most unlikely to complain.',
    toxic: 'The atmosphere reads as a strongly worded letter.',
    exotic: 'The survey instruments returned different answers each time.',
  };
  var REMARKS = [
    'Charted without incident.',
    'Gravity present and accounted for.',
    'A pleasant view from a safe distance.',
    'Recommended for medium freight.',
    'The kettle performed admirably at altitude.',
    'Filed under M, for Miscellaneous.',
    'The junior surveyor has already named it twice.',
    'Approved for the winter catalogue.',
    'Orbit tidy; paperwork tidier.',
    'No complaints received from residents. No residents.',
  ];
  var AIR_LABELS = {
    terran: 'Breathable, with weather',
    ocean: 'Damp but serviceable',
    desert: 'Thin and abrasive',
    ice: 'Crisp; bring a scarf',
    lava: 'Smoke, sparks and opinions',
    gas: 'All atmosphere, no floor',
    rock: 'None to speak of',
    toxic: 'Emphatically not recommended',
    exotic: 'Present, though possibly sideways',
  };
  var GREEK = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'κ', 'λ', 'μ', 'σ', 'φ', 'ψ', 'ω'];
  var MOON_WORDS = ['None', 'One', 'Two', 'Three', 'Four'];

  // Victorian frontier naming, in the company voice.
  var NAME_PRE = ['New ', 'Little ', 'Greater ', 'Old ', 'Far ', 'High ',
    'Nether ', 'Port ', 'Lesser ', 'Upper '];
  var NAME_ROOT = ['Basingstoke', 'Wapping', 'Kettering', 'Dunstable',
    'Pimlico', 'Chigley', 'Purbright', 'Woking', 'Frome', 'Cromer',
    'Trumpington', 'Slough', 'Ambridge', 'Tolworth', 'Nempnett', 'Wigan',
    'Goole', 'Bletchley', 'Rutland', 'Melton', 'Oswaldtwistle', 'Penge',
    'Chalfont', 'Didcot', 'Surbiton', 'Grimsby', 'Ludlow', 'Kington'];
  var NAME_SUF = [' Major', ' Minor', ' Secundus', ' Tertius', ' Prime',
    ' Verge', '-in-the-Veil', '’s Folly', ' Reach', '-under-Star',
    ' Deep', ' Halt', ' Annexe', ' Perihelion'];
  function makeName(rng) {
    var root = NAME_ROOT[(rng() * NAME_ROOT.length) | 0];
    var r = rng();
    if (r < 0.30) return NAME_PRE[(rng() * NAME_PRE.length) | 0] + root;
    if (r < 0.72) return root + NAME_SUF[(rng() * NAME_SUF.length) | 0];
    if (r < 0.85) return NAME_PRE[(rng() * NAME_PRE.length) | 0] + root +
      NAME_SUF[(rng() * NAME_SUF.length) | 0];
    return root;
  }
  function fmtMiles(n) {
    var s = String(Math.round(n)), out = '';
    while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }

  // ------------------------------------------------------ generate
  function generate(seed, opts) {
    var sd = (typeof seed === 'number' && isFinite(seed)) ? (seed >>> 0)
      : hashSeed(seed == null ? String(Math.random()) : seed);
    var rng = mulberry32(sd);

    var total = 0;
    ARCHS.forEach(function (a) { total += a.w; });
    var pick = rng() * total, arch = ARCHS[0];
    for (var i = 0; i < ARCHS.length; i++) {
      pick -= ARCHS[i].w;
      if (pick <= 0) { arch = ARCHS[i]; break; }
    }
    // a commissioned archetype overrides the weighted draw (the game
    // typecasts worlds to the cargo they lack)
    if (opts && opts.arch) {
      for (i = 0; i < ARCHS.length; i++) {
        if (ARCHS[i].id === opts.arch) { arch = ARCHS[i]; break; }
      }
    }
    var isGas = arch.id === 'gas';

    // size: the commissioned ±50 per cent; colossi run large, rubble small
    var sizeF = isGas ? 1 + rng() * 0.5 : 0.5 + rng();
    if (arch.id === 'rock' && sizeF > 1.2) sizeF = 0.6 + rng() * 0.6;
    sizeF = clamp(sizeF, 0.5, 1.5);

    // palette hues per archetype
    var hue, hue2;
    switch (arch.id) {
      case 'terran': hue = 88 + rng() * 55;  hue2 = 190 + rng() * 40; break;
      case 'ocean':  hue = 185 + rng() * 45; hue2 = hue + 20; break;
      case 'desert': hue = 18 + rng() * 30;  hue2 = hue + 15; break;
      case 'ice':    hue = 185 + rng() * 40; hue2 = hue - 15; break;
      case 'lava':   hue = 6 + rng() * 20;   hue2 = hue + 30; break;
      case 'gas':    hue = rng() * 360;      hue2 = hue + 25 + rng() * 40; break;
      case 'rock':   hue = rng() < 0.5 ? 20 + rng() * 30 : 205 + rng() * 40;
                     hue2 = hue; break;
      case 'toxic':  hue = 52 + rng() * 60;  hue2 = hue + 30; break;
      default:       hue = rng() * 360;      hue2 = hue + 90 + rng() * 120;
    }

    var spin = (0.006 + rng() * 0.022) * (rng() < 0.82 ? 1 : -1);
    if (isGas) spin *= 1.6;

    // rings
    var ringChance = { gas: 0.55, exotic: 0.40, rock: 0.15, ice: 0.20,
      toxic: 0.15, desert: 0.12, terran: 0.12, ocean: 0.12, lava: 0.12 }[arch.id];
    var rings = null;
    if (rng() < ringChance) {
      var r0 = 1.35 + rng() * 0.2;
      var bandN = 3 + ((rng() * 4) | 0), bands = [];
      for (var b = 0; b < bandN; b++) {
        bands.push({
          p: clamp((b + 0.2 + rng() * 0.6) / bandN, 0, 1),
          w: 0.25 + rng() * 0.9,
          a: 0.25 + rng() * 0.55,
        });
      }
      rings = {
        tilt: (rng() - 0.5) * 1.1,
        squash: 0.18 + rng() * 0.20,
        r0: r0, r1: r0 + 0.35 + rng() * 0.55,
        hue: hue + (rng() - 0.5) * 60,
        sat: 0.25 + rng() * 0.35,
        bands: bands,
      };
    }

    // moons
    var moonOdds = isGas ? [0.10, 0.28, 0.30, 0.20, 0.12]
                         : [0.32, 0.42, 0.20, 0.06];
    var roll = rng(), moonN = 0, acc = 0;
    for (i = 0; i < moonOdds.length; i++) {
      acc += moonOdds[i];
      if (roll < acc) { moonN = i; break; }
      moonN = i;
    }
    var moons = [], distBase = rings ? rings.r1 + 0.28 : 1.55;
    for (i = 0; i < moonN; i++) {
      var mrng = rng, msz = 0.10 + mrng() * 0.16;
      var craters = [];
      for (var cN = 0; cN < 2; cN++) {
        var ca = mrng() * Math.PI * 2, cd = mrng() * 0.55;
        craters.push({ dx: Math.cos(ca) * cd, dy: Math.sin(ca) * cd,
          cr: 0.16 + mrng() * 0.16 });
      }
      moons.push({
        size: msz,
        dist: distBase + i * 0.52 + mrng() * 0.30,
        omega: (0.16 + mrng() * 0.45) * (mrng() < 0.85 ? 1 : -1),
        ph: mrng() * Math.PI * 2,
        incl: 0.16 + mrng() * 0.30,
        tone: 0.35 + mrng() * 0.45,
        hue: hue + (mrng() - 0.5) * 90,
        craters: craters,
      });
    }
    var moonTilt = rings ? rings.tilt : (rng() - 0.5) * 0.5;

    // craters on the world itself
    var craterCount = { rock: 8 + rng() * 8, ice: 2 + rng() * 5,
      desert: 1 + rng() * 4, terran: 0, ocean: 0, lava: 0, gas: 0,
      toxic: 0, exotic: 0 }[arch.id] | 0;
    var worldCraters = [];
    for (i = 0; i < craterCount; i++) {
      worldCraters.push({ u: rng(), v: 0.12 + rng() * 0.76,
        r: 0.020 + rng() * 0.050 });
    }

    // clouds
    var cloudOdds = { terran: 0.9, ocean: 0.8, toxic: 1, ice: 0.3,
      desert: 0.3, lava: 0.3, gas: 0, rock: 0, exotic: 0.3 }[arch.id];
    var clouds = null;
    if (rng() < cloudOdds) {
      clouds = {
        th: arch.id === 'toxic' ? 0.44 : 0.52 + rng() * 0.1,
        alpha: arch.id === 'toxic' ? 0.6 : 0.5 + rng() * 0.3,
        scale: 2.0 + rng() * 1.4,
        drift: 1.25 + rng() * 0.5,
        tint: arch.id === 'lava' ? [70, 62, 60]
          : (arch.id === 'toxic' ? hsl(hue + 20, 0.45, 0.72) : [240, 244, 248]),
      };
    }

    // atmosphere & aura
    var atmo = { terran: 0.8, ocean: 0.9, gas: 0.7, toxic: 1, ice: 0.5,
      desert: 0.4, lava: 0.55, rock: 0.12, exotic: 0.7 }[arch.id];
    var atmoCol = hsl(hue2, 0.55, 0.66);
    if (arch.id === 'lava') atmoCol = hsl(hue + 20, 0.85, 0.58);
    var glowCol = hsl(hue + 40 + rng() * 40, 0.75, 0.62);

    // one great storm for the colossi (and the odd miasmic world)
    var spot = null;
    if ((isGas && rng() < 0.8) || (arch.id === 'toxic' && rng() < 0.3)) {
      spot = { u: rng(), v: 0.30 + rng() * 0.40, r: 0.09 + rng() * 0.10,
        dark: rng() < 0.5 };
    }

    var caps = null;
    var capOdds = { terran: 0.75, ocean: 0.35, desert: 0.2, rock: 0.15 }[arch.id] || 0;
    if (rng() < capOdds) caps = { lat: 0.82 + rng() * 0.10 };

    var lights = arch.id === 'terran' && rng() < 0.4;

    var name = makeName(rng);
    var desig = 'Survey Ref. 1896–' + GREEK[(rng() * GREEK.length) | 0] +
      (1 + ((rng() * 98) | 0));

    var spinAbs = Math.abs(spin);
    var dayHrs = Math.round(5 + (0.030 - clamp(spinAbs, 0.006, 0.030)) / 0.024 * 130);
    var diameter = 7900 * sizeF * (isGas ? 9 + rng() * 3 : 1);

    var spec = {
      generator: 'C&W Planetary Works',
      seed: sd,
      arch: arch.id,
      classLabel: arch.label,
      name: name,
      desig: desig,
      sizeF: sizeF,
      hue: hue, hue2: hue2,
      spin: spin,
      nScale: (isGas ? 1.6 : 2.4) * (0.85 + rng() * 0.3),
      bandN: isGas ? 3 + ((rng() * 4) | 0) : 4 + ((rng() * 5) | 0),
      turb: 0.25 + rng() * 0.5,
      seaLevel: 0.5 + (rng() - 0.5) * 0.14,
      crackTh: 0.93 + rng() * 0.04,
      rings: rings,
      moons: moons,
      moonTilt: moonTilt,
      craters: worldCraters,
      clouds: clouds,
      cloudPhase: rng(),
      atmo: atmo,
      atmoCol: atmoCol,
      glowCol: glowCol,
      spot: spot,
      caps: caps,
      lights: lights,
      stats: {
        diameter: '≈ ' + fmtMiles(Math.round(diameter / 10) * 10) + ' miles',
        day: dayHrs + ' hrs' + (spin < 0 ? ' (retrograde)' : ''),
        moons: MOON_WORDS[moons.length] || String(moons.length),
        rings: rings ? (rings.bands.length >= 5 ? 'A grand set' : 'Yes, modest') : 'None',
        air: AIR_LABELS[arch.id],
      },
      notes: [ARCH_NOTES[arch.id], REMARKS[(rng() * REMARKS.length) | 0]],
    };

    // each world leans at its own angle; the renderer's axis option
    // (0..1) scales how much of the full lean is actually shown.
    // Drawn last so earlier seeds keep casting identical worlds.
    spec.axisTilt = (rng() - 0.5) * 2;

    // how far the ensemble reaches, in planet radii — for fitting views
    var extent = 1.32;
    if (rings) extent = Math.max(extent, rings.r1 + 0.12);
    moons.forEach(function (m) {
      extent = Math.max(extent, m.dist + m.size + 0.08);
    });
    spec.extent = Math.min(extent, 3.1);
    return spec;
  }

  // ------------------------------------------------------ surface samplers
  // Each returns t in 0..1 (an index into the archetype's colour ramp)
  // plus optional emissive strength. ax/ay are the unit-circle
  // coordinates of longitude; v is latitude 0..1.
  function makeSampler(spec, noise, oct) {
    var f = spec.nScale;
    var out = { t: 0.5, e: 0, land: 0 };
    function wrapDU(u, su) {
      var d = Math.abs(u - su);
      return Math.min(d, 1 - d) * 2;
    }
    function addSpot(u, v, t) {
      var sp = spec.spot;
      if (!sp) return t;
      var du = wrapDU(u, sp.u) * 1.6, dv = (v - sp.v) * 3.4;
      var d = Math.sqrt(du * du + dv * dv);
      if (d > sp.r * 3.4) return t;
      var k = smooth(sp.r * 3.4, sp.r * 1.2, d);
      var swirl = Math.sin(d / (sp.r * 3.4) * 9 - 1.5) * 0.10 * k;
      return lerp(t, sp.dark ? 0.12 : 0.94, k * 0.85) + swirl;
    }
    function capT(ax, ay, v, t) {
      if (!spec.caps) return t;
      var lat = Math.abs(v - 0.5) * 2;
      // the frost line must wander with longitude (ax/ay), or the cap
      // shears off in an implausibly tidy straight line
      var edge = spec.caps.lat
        + (noise.fbm(ax * 2.3, ay * 2.3, v * 4.5 + 5.1, 3) - 0.5) * 0.16
        + (noise.fbm(ax * 6.1, ay * 6.1, v * 9 + 2.7, 2) - 0.5) * 0.06;
      if (lat > edge) return lerp(t, 0.985, smooth(edge, edge + 0.04, lat));
      return t;
    }
    switch (spec.arch) {
      case 'terran': return function (ax, ay, u, v) {
        var c = noise.fbm(ax * f, ay * f, v * f * 2, oct);
        var sl = spec.seaLevel;
        var t;
        if (c < sl) { t = (c / sl) * 0.46; out.land = 0; }
        else { t = 0.52 + (c - sl) / (1 - sl) * 0.46; out.land = 1; }
        out.t = capT(ax, ay, v, t); out.e = 0;
        return out;
      };
      case 'ocean': return function (ax, ay, u, v) {
        var c = noise.fbm(ax * f, ay * f, v * f * 2, oct);
        var t = 0.16 + c * 0.42;
        if (c > 0.74) t = 0.62 + (c - 0.74) * 1.4;   // scattered atolls
        out.t = capT(ax, ay, v, t); out.e = 0; out.land = c > 0.74 ? 1 : 0;
        return out;
      };
      case 'desert': return function (ax, ay, u, v) {
        var w = noise.fbm(ax * f * 0.8, ay * f * 0.8, v * f, 3) - 0.5;
        var t = 0.48 + 0.28 * Math.sin(v * Math.PI * spec.bandN + w * 5.5)
          + (noise.fbm(ax * f * 2.2, ay * f * 2.2, v * f * 4, oct) - 0.5) * 0.34;
        out.t = capT(ax, ay, v, clamp(t, 0, 1)); out.e = 0;
        return out;
      };
      case 'ice': return function (ax, ay, u, v) {
        var c = noise.fbm(ax * f, ay * f, v * f * 2, oct);
        var cr = noise.ridge(ax * f * 1.7, ay * f * 1.7, v * f * 3.4, 3);
        var t = 0.55 + c * 0.42;
        if (cr > 0.88) t = 0.30 - (cr - 0.88) * 1.4;  // pressure cracks
        out.t = clamp(t, 0, 1); out.e = 0;
        return out;
      };
      case 'lava': return function (ax, ay, u, v) {
        var c = noise.fbm(ax * f, ay * f, v * f * 2, oct);
        var cr = noise.ridge(ax * f * 1.5, ay * f * 1.5, v * f * 3, 4);
        var t = c * 0.40, e = 0;
        if (cr > spec.crackTh) {
          e = smooth(spec.crackTh, spec.crackTh + 0.05, cr);
          t = 0.55 + e * 0.45;
        }
        out.t = clamp(t, 0, 1); out.e = e;
        return out;
      };
      case 'gas': return function (ax, ay, u, v) {
        var warp = (noise.fbm(ax * 1.3, ay * 1.3, v * 2.6, 4) - 0.5) * spec.turb * 7;
        var band = Math.sin(v * Math.PI * 2 * spec.bandN + warp);
        var streak = (noise.fbm(ax * 0.9, ay * 0.9, v * 9, 3) - 0.5) * 0.22;
        var t = clamp(0.5 + band * 0.40 + streak, 0, 1);
        out.t = addSpot(u, v, t); out.e = 0;
        return out;
      };
      case 'rock': return function (ax, ay, u, v) {
        var c = noise.fbm(ax * f, ay * f, v * f * 2, oct);
        var mare = noise.fbm(ax * f * 0.45, ay * f * 0.45, v * f, 3);
        var t = 0.42 + c * 0.34;
        if (mare < 0.42) t -= 0.22;                   // dark maria
        out.t = capT(ax, ay, v, clamp(t, 0, 1)); out.e = 0;
        return out;
      };
      case 'toxic': return function (ax, ay, u, v) {
        var warp = (noise.fbm(ax * 1.8, ay * 1.8, v * 3.4, 4) - 0.5) * spec.turb * 10;
        var band = Math.sin(v * Math.PI * 2 * (spec.bandN + 2) + warp);
        var t = clamp(0.5 + band * 0.44 +
          (noise.fbm(ax * 3, ay * 3, v * 6, 3) - 0.5) * 0.3, 0, 1);
        out.t = addSpot(u, v, t); out.e = 0;
        return out;
      };
      default: return function (ax, ay, u, v) {   // exotic
        var rv = noise.ridge(ax * f, ay * f, v * f * 2, oct);
        var fine = noise.fbm(ax * f * 3, ay * f * 3, v * f * 5, 2);
        var t = clamp((Math.round(rv * 5) / 5) * 0.82 + fine * 0.18, 0, 1);
        out.t = t; out.e = 0;
        return out;
      };
    }
  }

  // colour ramps per archetype
  function makeStops(spec) {
    var h = spec.hue, h2 = spec.hue2;
    switch (spec.arch) {
      case 'terran': return [
        [0.00, hsl(h2, 0.60, 0.20)], [0.30, hsl(h2, 0.56, 0.30)],
        [0.46, hsl(h2, 0.48, 0.42)], [0.52, hsl(45, 0.42, 0.64)],
        [0.60, hsl(h, 0.45, 0.40)], [0.78, hsl(h, 0.48, 0.27)],
        [0.90, hsl(28, 0.16, 0.42)], [0.97, hsl(h2, 0.08, 0.88)],
        [1.00, hsl(h2, 0.05, 0.94)]];
      case 'ocean': return [
        [0.00, hsl(h, 0.62, 0.16)], [0.35, hsl(h, 0.58, 0.30)],
        [0.58, hsl(h, 0.52, 0.44)], [0.64, hsl(45, 0.40, 0.62)],
        [0.72, hsl(h - 90, 0.40, 0.38)], [1.00, hsl(h, 0.30, 0.70)]];
      case 'desert': return [
        [0.00, hsl(h, 0.42, 0.26)], [0.30, hsl(h, 0.46, 0.38)],
        [0.55, hsl(h + 8, 0.50, 0.52)], [0.80, hsl(h + 14, 0.46, 0.64)],
        [1.00, hsl(h + 18, 0.36, 0.74)]];
      case 'ice': return [
        [0.00, hsl(h, 0.55, 0.34)], [0.25, hsl(h, 0.42, 0.52)],
        [0.60, hsl(h, 0.30, 0.72)], [0.85, hsl(h - 10, 0.22, 0.84)],
        [1.00, hsl(h, 0.12, 0.94)]];
      case 'lava': return [
        [0.00, hsl(h, 0.30, 0.06)], [0.30, hsl(h, 0.34, 0.13)],
        [0.50, hsl(h, 0.40, 0.20)], [0.62, hsl(h, 0.85, 0.38)],
        [0.80, hsl(h + 14, 0.95, 0.52)], [1.00, hsl(h + 34, 1.00, 0.72)]];
      case 'gas': return [
        [0.00, hsl(h, 0.44, 0.26)], [0.25, hsl(h + 8, 0.50, 0.40)],
        [0.50, hsl(h2, 0.46, 0.58)], [0.72, hsl(h - 10, 0.48, 0.38)],
        [0.88, hsl(h + 16, 0.42, 0.66)], [1.00, hsl(h2, 0.38, 0.74)]];
      case 'rock': return [
        [0.00, hsl(h, 0.10, 0.16)], [0.35, hsl(h, 0.10, 0.32)],
        [0.70, hsl(h, 0.12, 0.48)], [1.00, hsl(h, 0.10, 0.64)]];
      case 'toxic': return [
        [0.00, hsl(h, 0.55, 0.22)], [0.30, hsl(h + 12, 0.58, 0.36)],
        [0.55, hsl(h2, 0.62, 0.50)], [0.80, hsl(h + 6, 0.55, 0.62)],
        [1.00, hsl(h2 + 12, 0.50, 0.74)]];
      default: return [
        [0.00, hsl(h, 0.72, 0.18)], [0.30, hsl(h + 40, 0.80, 0.42)],
        [0.60, hsl(h2, 0.76, 0.58)], [0.85, hsl(h2 + 40, 0.70, 0.74)],
        [1.00, hsl(h2 + 70, 0.60, 0.86)]];
    }
  }

  // ------------------------------------------------------ texture baking
  function q(v) { return Math.round(v * 32) / 32; }

  function buildTexture(spec, D, P) {
    var h = D, w = D * 2;
    var noise = makeNoise(mulberry32((spec.seed ^ 0x9E3779B9) >>> 0));
    var oct = 2 + Math.round(P.detail * 3);
    var sampler = makeSampler(spec, noise, oct);
    var lut = rampLUT(makeStops(spec));
    var posterL = P.poster > 0.06 ? Math.max(3, Math.round(3 + (1 - P.poster) * 9)) : 0;
    var satM = P.sat;
    var duo = P.duo;
    var duoLut = duo > 0.01 ? rampLUT([
      [0, INK], [0.5, mixc(mixc(INK, PARCH, 0.42), hsl(spec.hue, 0.5, 0.5), 0.22)],
      [1, PARCH]]) : null;
    var irid = P.irid;

    var surf = document.createElement('canvas');
    surf.width = w; surf.height = h;
    var sctx = surf.getContext('2d');
    var img = sctx.createImageData(w, h);
    var d = img.data;

    var needMask = !!spec.lights;
    var mask = needMask ? new Uint8Array(w * h) : null;
    var emis = null, eimg = null, ed = null;
    if (spec.arch === 'lava') {
      emis = document.createElement('canvas');
      emis.width = w; emis.height = h;
      eimg = emis.getContext('2d').createImageData(w, h);
      ed = eimg.data;
    }

    var cosA = new Float64Array(w), sinA = new Float64Array(w);
    for (var px = 0; px < w; px++) {
      var a = ((px + 0.5) / w) * Math.PI * 2;
      cosA[px] = Math.cos(a) * 1.15;
      sinA[px] = Math.sin(a) * 1.15;
    }
    var rowMat = null;
    for (var py = 0; py < h; py++) {
      var v = (py + 0.5) / h;
      if (irid > 0.02) rowMat = hueMatrix((v - 0.5) * irid * 150);
      for (px = 0; px < w; px++) {
        var s = sampler(cosA[px], sinA[px], (px + 0.5) / w, v);
        var t = s.t;
        if (posterL) t = Math.round(t * (posterL - 1)) / (posterL - 1);
        var li = clamp((t * 255) | 0, 0, 255) * 3;
        var r = lut[li], g = lut[li + 1], bl = lut[li + 2];
        if (satM !== 1) {
          var lum = r * 0.299 + g * 0.587 + bl * 0.114;
          r = lum + (r - lum) * satM;
          g = lum + (g - lum) * satM;
          bl = lum + (bl - lum) * satM;
        }
        if (rowMat) {
          var rr = rowMat[0] * r + rowMat[1] * g + rowMat[2] * bl;
          var gg = rowMat[3] * r + rowMat[4] * g + rowMat[5] * bl;
          var bb = rowMat[6] * r + rowMat[7] * g + rowMat[8] * bl;
          r = rr; g = gg; bl = bb;
        }
        if (duoLut) {
          var dl = clamp(((r * 0.299 + g * 0.587 + bl * 0.114)) | 0, 0, 255) * 3;
          r = r + (duoLut[dl] - r) * duo;
          g = g + (duoLut[dl + 1] - g) * duo;
          bl = bl + (duoLut[dl + 2] - bl) * duo;
        }
        var o = (py * w + px) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = 255;
        if (mask) mask[py * w + px] = s.land;
        if (ed && s.e > 0.02) {
          ed[o] = 255; ed[o + 1] = 120 + s.e * 100; ed[o + 2] = 40;
          ed[o + 3] = Math.round(s.e * 235);
        }
      }
    }
    sctx.putImageData(img, 0, 0);
    if (eimg) emis.getContext('2d').putImageData(eimg, 0, 0);

    // stamp craters (drawn thrice for seamless wrap)
    if (spec.craters.length) {
      spec.craters.forEach(function (c) {
        var cx = c.u * w, cy = c.v * h, cr = c.r * h * 2.2;
        [0, -w, w].forEach(function (off) {
          sctx.fillStyle = 'rgba(8,10,14,0.30)';
          sctx.beginPath();
          sctx.arc(cx + off, cy, cr, 0, Math.PI * 2);
          sctx.fill();
          sctx.strokeStyle = 'rgba(255,250,238,0.22)';
          sctx.lineWidth = Math.max(1, cr * 0.18);
          sctx.beginPath();
          sctx.arc(cx + off - cr * 0.16, cy - cr * 0.16, cr * 0.82, -2.7, 0.4);
          sctx.stroke();
        });
      });
    }

    // night-side settlements, for worlds that earned them
    if (needMask) {
      emis = document.createElement('canvas');
      emis.width = w; emis.height = h;
      var ectx = emis.getContext('2d');
      var lrng = mulberry32((spec.seed ^ 0x1F2E3D4C) >>> 0);
      ectx.fillStyle = 'rgba(255,208,130,0.9)';
      for (var k = 0; k < w * 0.9; k++) {
        var lx = (lrng() * w) | 0, ly = (h * (0.15 + lrng() * 0.7)) | 0;
        if (!mask[ly * w + lx]) continue;
        if (noise.fbm(cosA[lx] * 2.4, sinA[lx] * 2.4, (ly / h) * 4.8, 2) < 0.52) continue;
        var sz = lrng() < 0.2 ? 2 : 1;
        ectx.fillRect(lx, ly, sz, sz);
        if (lrng() < 0.4) ectx.fillRect(lx + 1 + (lrng() * 2 | 0), ly + (lrng() * 2 | 0), 1, 1);
      }
    }

    // weather layer
    var cloudCv = null;
    if (spec.clouds) {
      cloudCv = document.createElement('canvas');
      cloudCv.width = w; cloudCv.height = h;
      var cctx = cloudCv.getContext('2d');
      var cimg = cctx.createImageData(w, h);
      var cd = cimg.data;
      var cf = spec.clouds.scale;
      var softEdge = lerp(0.24, 0.045, P.poster);
      var ct = spec.clouds.tint;
      for (py = 0; py < h; py++) {
        v = (py + 0.5) / h;
        for (px = 0; px < w; px++) {
          var cn = noise.fbm(cosA[px] * cf, sinA[px] * cf, v * cf * 2 + 11.3, oct);
          var al = smooth(spec.clouds.th, spec.clouds.th + softEdge, cn) * spec.clouds.alpha;
          if (al < 0.01) continue;
          var co = (py * w + px) * 4;
          cd[co] = ct[0]; cd[co + 1] = ct[1]; cd[co + 2] = ct[2];
          cd[co + 3] = Math.round(al * 255);
        }
      }
      cctx.putImageData(cimg, 0, 0);
    }

    return { surf: surf, clouds: cloudCv, emis: emis, w: w, h: h };
  }

  function ensureTexture(spec, D, P, budget) {
    var key = D + '|' + q(P.detail) + '|' + q(P.poster) + '|' + q(P.sat) +
      '|' + q(P.duo) + '|' + q(P.irid);
    var cur = spec._tex;
    if (cur && cur.key === key) return cur;
    if (budget && budget.n <= 0) return cur;  // stale beats stalled; null waits
    if (budget) budget.n--;
    var tex = buildTexture(spec, D, P);
    tex.key = key;
    if (!Object.getOwnPropertyDescriptor(spec, '_tex')) {
      Object.defineProperty(spec, '_tex',
        { value: null, writable: true, enumerable: false, configurable: true });
    }
    spec._tex = tex;
    return tex;
  }

  // ------------------------------------------------------ draw helpers
  var LX = -0.685, LY = -0.729;   // house light, upper left, as in the game

  function drawSlices(ctx, img, u, r) {
    var h = img.height, w = img.width;
    var sc = (2 * r) / h;
    var sx = (u * w) % w;
    if (sx < 0) sx += w;
    var w1 = Math.min(h, w - sx);
    ctx.drawImage(img, sx, 0, w1, h, -r, -r, w1 * sc + 0.6, 2 * r);
    if (w1 < h) {
      var w2 = h - w1;
      ctx.drawImage(img, 0, 0, w2, h, -r + w1 * sc - 0.6, -r, w2 * sc + 0.6, 2 * r);
    }
  }

  function crescent(ctx, r, offF, rF, alpha) {
    if (alpha <= 0.004) return;
    ctx.fillStyle = css(INK, Math.min(1, alpha));
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(LX * offF * r, LY * offF * r, rF * r, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }

  function shadeSphere(ctx, r, P) {
    var soft = (1 - P.cel * 0.75) * P.shade;
    if (soft > 0.02) {
      var g = ctx.createRadialGradient(LX * 0.55 * r, LY * 0.55 * r, r * 0.1,
        LX * 0.55 * r, LY * 0.55 * r, r * 2.05);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.26 * soft).toFixed(3) + ')');
      g.addColorStop(0.38, 'rgba(255,255,255,0)');
      g.addColorStop(0.62, css(INK, 0.10 * soft));
      g.addColorStop(1, css(INK, 0.72 * soft));
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, 2 * r, 2 * r);
    }
    if (P.cel > 0.03) {
      crescent(ctx, r, 0.26, 1.04, 0.22 * P.cel * (0.5 + P.shade * 0.5));
      crescent(ctx, r, 0.50, 0.82, 0.20 * P.cel * (0.5 + P.shade * 0.5));
    }
    // limb darkening, always a whisper of it
    var lg = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(0.82, 'rgba(0,0,0,0)');
    lg.addColorStop(1, css(INK, 0.34 * P.shade));
    ctx.fillStyle = lg;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
  }

  function drawHatch(ctx, r, P) {
    if (P.hatch <= 0.03) return;
    var s = Math.max(2.4, r * 0.13);
    var lw = Math.max(0.5, r * 0.018);
    ctx.save();
    ctx.strokeStyle = css(INK, 0.15 * P.hatch);
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (var x = -2 * r; x < 2 * r; x += s) {
      ctx.moveTo(x, r + 2);
      ctx.lineTo(x + 2 * r + 4, -r - 2);
    }
    ctx.stroke();
    // a denser pass on the night side, like plate engraving
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(LX * 0.42 * r, LY * 0.42 * r, r * 0.98, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    ctx.strokeStyle = css(INK, 0.22 * P.hatch);
    ctx.beginPath();
    for (x = -2 * r + s * 0.5; x < 2 * r; x += s * 0.55) {
      ctx.moveTo(x, r + 2);
      ctx.lineTo(x + 2 * r + 4, -r - 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  var scratch = document.createElement('canvas');
  function drawEmissive(ctx, tex, u, r, maskLo) {
    var h = tex.h;
    if (scratch.width < h || scratch.height < h) {
      scratch.width = h; scratch.height = h;
    }
    var sc = scratch.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, h, h);
    sc.save();
    sc.translate(h / 2, h / 2);
    drawSlices(sc, tex.emis, u, h / 2);
    sc.restore();
    sc.globalCompositeOperation = 'destination-in';
    var g = sc.createLinearGradient(0, 0, h, h);
    g.addColorStop(0, 'rgba(0,0,0,' + maskLo.toFixed(2) + ')');
    g.addColorStop(0.5, 'rgba(0,0,0,' + Math.min(1, maskLo + 0.15).toFixed(2) + ')');
    g.addColorStop(0.78, 'rgba(0,0,0,0.92)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, h, h);
    sc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(scratch, 0, 0, h, h, -r, -r, 2 * r, 2 * r);
    ctx.restore();
  }

  function drawRingHalf(ctx, spec, r, P, half, axis) {
    var R = spec.rings;
    if (!R) return;
    ctx.save();
    ctx.rotate(R.tilt + axis);
    var big = r * (R.r1 + 0.6) + 6;
    ctx.beginPath();
    if (half < 0) ctx.rect(-big, -big, big * 2, big);
    else ctx.rect(-big, 0, big * 2, big);
    ctx.clip();
    ctx.scale(1, R.squash);
    var col = hsl(R.hue, R.sat * clamp(P.sat, 0.2, 1.2), 0.62);
    col = mixc(col, PARCH, P.duo * 0.8);
    var wMul = 0.55 + P.cel * 1.2 + P.poster * 0.4 - P.hatch * 0.25;
    R.bands.forEach(function (b) {
      var rr = r * lerp(R.r0, R.r1, b.p);
      ctx.strokeStyle = css(col, clamp(b.a * (0.72 + P.glow * 0.28), 0, 1));
      ctx.lineWidth = Math.max(0.7, r * 0.05 * b.w * wMul);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
    });
    if (P.hatch > 0.25) {   // fine engraved guide lines
      ctx.strokeStyle = css(PARCH, 0.40 * P.hatch);
      ctx.lineWidth = Math.max(0.5, r * 0.008);
      [R.r0, (R.r0 + R.r1) / 2, R.r1].forEach(function (rr) {
        ctx.beginPath();
        ctx.arc(0, 0, r * rr, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    if (P.glow > 0.3) {     // an enchanted shimmer along the ring plane
      ctx.strokeStyle = css(spec.glowCol, 0.16 * P.glow);
      ctx.lineWidth = r * (R.r1 - R.r0) * 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, r * (R.r0 + R.r1) / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function outlineColour(spec, P) {
    var deep = hsl(spec.hue, 0.45, 0.16);
    return css(mixc(mixc(deep, INK, 0.55), INK, P.duo), 0.9);
  }

  function drawOutline(ctx, spec, r, P) {
    if (P.outline <= 0.03) return;
    // no minimum width: at small radii a floored outline reads as a
    // heavy black ring, so a faint outline simply fades away instead
    var w = r * 0.085 * P.outline;
    if (w < 0.5) return;
    ctx.strokeStyle = outlineColour(spec, P);
    ctx.lineWidth = w;
    ctx.beginPath();
    if (P.wobble > 0.05) {
      var wr = mulberry32((spec.seed ^ 0x51A7) >>> 0);
      var n = 30, rad = [];
      for (var i = 0; i < n; i++) rad.push(r + w * 0.35 + (wr() - 0.5) * P.wobble * r * 0.07);
      for (i = 0; i <= n; i++) {
        var a = (i % n) / n * Math.PI * 2;
        var rr = rad[i % n];
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, r + w * 0.35, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  function drawMoon(ctx, spec, m, mx, my, mr, P, behind) {
    var col = hsl(m.hue, 0.14, m.tone);
    col = mixc(col, PARCH, P.duo * 0.8);
    if (behind) col = mixc(col, INK, 0.22);
    var g = ctx.createRadialGradient(mx + LX * 0.4 * mr, my + LY * 0.4 * mr,
      mr * 0.1, mx, my, mr * 1.02);
    g.addColorStop(0, css(mixc(col, [255, 255, 255], 0.30)));
    g.addColorStop(0.6, css(col));
    g.addColorStop(1, css(mixc(col, INK, 0.55 * P.shade)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    if (mr > 2.5) {
      ctx.fillStyle = css(INK, 0.22);
      m.craters.forEach(function (c) {
        ctx.beginPath();
        ctx.arc(mx + c.dx * mr, my + c.dy * mr, c.cr * mr, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (P.cel > 0.05) {
      ctx.save();
      ctx.translate(mx, my);
      crescent(ctx, mr, 0.34, 0.95, 0.24 * P.cel);
      ctx.restore();
    }
    if (P.outline > 0.03) {
      ctx.strokeStyle = outlineColour(spec, P);
      ctx.lineWidth = Math.max(0.8, mr * 0.16 * P.outline);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSparkles(ctx, spec, r, P, t) {
    if (P.sparkle <= 0.03) return;
    var rng = mulberry32((spec.seed ^ 0xC0FFEE) >>> 0);
    var n = Math.round(4 + P.sparkle * 12);
    for (var i = 0; i < n; i++) {
      var ang = rng() * Math.PI * 2 + t * 0.05;
      var dist = r * (1.14 + rng() * 0.9);
      var sz = r * (0.035 + rng() * 0.05);
      var spd = 0.4 + rng() * 1.3, ph = rng() * 6.28;
      var pick = rng();
      var tw = Math.sin(t * spd + ph);
      tw = tw > 0 ? tw * tw : 0;
      var a = tw * P.sparkle;
      if (a < 0.04) continue;
      var x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
      var colr = pick < 0.4 ? [255, 255, 255] : (pick < 0.7 ? BRASS : spec.glowCol);
      ctx.strokeStyle = css(colr, Math.min(1, a));
      ctx.lineWidth = Math.max(0.6, sz * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y);
      ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
      ctx.moveTo(x - sz * 0.4, y - sz * 0.4); ctx.lineTo(x + sz * 0.4, y + sz * 0.4);
      ctx.moveTo(x + sz * 0.4, y - sz * 0.4); ctx.lineTo(x - sz * 0.4, y + sz * 0.4);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------ the world entire
  function drawWorld(ctx, spec, r, P, t, opts) {
    var maxTex = (opts && opts.maxTex) || 288;
    var over = (opts && opts.oversample) || 1;   // for small-but-zoomable worlds
    var D = clamp(Math.round(2 * r * over), 48, maxTex);
    var tex = ensureTexture(spec, D, P, opts && opts.budget);
    var u = (t * spec.spin) % 1;
    // axial lean: the surface, rings and moons tilt together; the
    // lighting stays put, since the sun takes no instruction from us
    var axis = (spec.axisTilt || 0) *
      ((opts && opts.axis != null) ? opts.axis : 0) * 0.75;

    // enchanted aura, behind everything
    if (P.glow > 0.03) {
      var pulse = 0.8 + 0.2 * Math.sin(t * 1.7 + spec.seed % 7);
      var ag = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.95);
      ag.addColorStop(0, css(spec.glowCol, 0.30 * P.glow * pulse));
      ag.addColorStop(0.55, css(spec.glowCol, 0.14 * P.glow * pulse));
      ag.addColorStop(1, css(spec.glowCol, 0));
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.95, 0, Math.PI * 2);
      ctx.fill();
    }

    // moon positions this instant
    var behind = [], front = [];
    spec.moons.forEach(function (m) {
      var a = m.ph + t * m.omega;
      var ox = Math.cos(a) * m.dist * r;
      var oy = Math.sin(a) * m.dist * r * m.incl;
      var ct = Math.cos(spec.moonTilt + axis), st = Math.sin(spec.moonTilt + axis);
      var mx = ox * ct - oy * st, my = ox * st + oy * ct;
      var z = Math.sin(a);
      var mr = m.size * r * (1 + z * 0.12);
      (z < 0 ? behind : front).push({ m: m, x: mx, y: my, r: mr });
    });

    // survey orbit guides, when the ink is strong
    if (P.hatch > 0.3 && spec.moons.length) {
      ctx.save();
      ctx.rotate(spec.moonTilt + axis);
      ctx.strokeStyle = css(PARCH, 0.12 * P.hatch);
      ctx.lineWidth = Math.max(0.5, r * 0.012);
      ctx.setLineDash([3, 4]);
      spec.moons.forEach(function (m) {
        ctx.beginPath();
        ctx.ellipse(0, 0, m.dist * r, m.dist * r * m.incl, 0, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawRingHalf(ctx, spec, r, P, -1, axis);
    behind.forEach(function (b) { drawMoon(ctx, spec, b.m, b.x, b.y, b.r, P, true); });

    // ------- the disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.save();
    ctx.rotate(axis);   // surface leans; the clip circle doesn't care
    ctx.fillStyle = css(hsl(spec.hue, 0.35, 0.4));
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    if (tex) {
      drawSlices(ctx, tex.surf, u, r);
      if (tex.clouds) {
        var cu = (t * spec.spin * spec.clouds.drift + spec.cloudPhase) % 1;
        ctx.globalAlpha = 0.9;
        drawSlices(ctx, tex.clouds, cu, r);
        ctx.globalAlpha = 1;
      }
      if (tex.emis) drawEmissive(ctx, tex, u, r, spec.arch === 'lava' ? 0.5 : 0.06);
    }
    ctx.restore();
    shadeSphere(ctx, r, P);
    drawHatch(ctx, r, P);
    ctx.restore();

    // atmospheric limb
    var rim = spec.atmo * P.rim;
    if (rim > 0.02) {
      var rg = ctx.createRadialGradient(0, 0, r * 0.86, 0, 0, r * 1.18);
      rg.addColorStop(0, css(spec.atmoCol, 0));
      rg.addColorStop(0.42, css(spec.atmoCol, 0.34 * rim));
      rg.addColorStop(1, css(spec.atmoCol, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
      ctx.fill();
      // lit-side limb arc, as on the route chart
      ctx.strokeStyle = 'rgba(225,235,245,' + (0.22 * rim).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.8, r * 0.022);
      ctx.beginPath();
      ctx.arc(0, 0, r - Math.max(0.6, r * 0.012), Math.PI * 0.8, Math.PI * 1.75);
      ctx.stroke();
    }

    // storybook gloss
    if (P.gloss > 0.03) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.40 * P.gloss).toFixed(3) + ')';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.2, r * 0.10);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, Math.PI * 1.08, Math.PI * 1.38);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.40 * P.gloss).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(r * 0.72 * Math.cos(Math.PI * 1.52), r * 0.72 * Math.sin(Math.PI * 1.52),
        Math.max(0.8, r * 0.05), 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = 'butt';
    }

    drawOutline(ctx, spec, r, P);
    drawRingHalf(ctx, spec, r, P, 1, axis);
    front.forEach(function (f) { drawMoon(ctx, spec, f.m, f.x, f.y, f.r, P, false); });
    drawSparkles(ctx, spec, r, P, t);
  }

  // ------------------------------------------------------ public painting
  var stage = document.createElement('canvas');

  function render(ctx, spec, x, y, r, mix, t, opts) {
    var P = resolveStyle(mix);
    t = t || 0;
    var cell = 1 + P.pixel * clamp(r / 16, 1.5, 5);
    if (cell <= 1.25) {
      ctx.save();
      ctx.translate(x, y);
      drawWorld(ctx, spec, r, P, t, opts);
      ctx.restore();
      return;
    }
    // the Pixel Age: paint small, enlarge without apology
    var size = Math.ceil(((r * spec.extent + 4) * 2) / cell);
    if (stage.width !== size || stage.height !== size) {
      stage.width = size; stage.height = size;
    }
    var sctx = stage.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, size, size);
    sctx.translate(size / 2, size / 2);
    drawWorld(sctx, spec, r / cell, P, t,
      { budget: opts && opts.budget, maxTex: 96, axis: opts && opts.axis });
    var prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(stage, 0, 0, size, size,
      x - size * cell / 2, y - size * cell / 2, size * cell, size * cell);
    ctx.imageSmoothingEnabled = prev;
  }

  function renderInto(canvas, spec, mix, t, opts) {
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw; canvas.height = bh;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    var base = Math.min(cw, ch) / 2;
    var r = Math.min(base * 0.46 * spec.sizeF, (base - 4) / spec.extent);
    render(ctx, spec, cw / 2, ch / 2, Math.max(6, r), mix, t, opts);
  }

  CW.PlanetGen = {
    generate: generate,
    render: render,
    renderInto: renderInto,
    mixStyles: mixStyles,
    STYLES: STYLES,
    STYLE_KEYS: STYLE_KEYS,
    hashSeed: hashSeed,
    VERSION: 1,
  };
})();
