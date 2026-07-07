/* render.js — canvas renderer. The player is not looking at space; they
   are looking at the holographic route chart of an Interstellar
   Logistics Command terminal: deep ink, a polar survey grid, stylised
   planets, twin-rail hyperspace conduits and charted nebula hazards. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  // Visual constants live in theme.js (CW.theme); the Drawing Office
  // edits them live. syncTheme() refreshes this module's working set
  // once per frame so every draw call below stays cheap.
  var TH = {};
  var INK = '#0b1017';
  var PARCH = '#e9e0c9';
  var PARCH_DIM = 'rgba(233,224,201,0.55)';
  var AMBER = '#dca94b';
  var RED = '#d4574f';

  var SIZES = {
    colonyR: 15, specialR: 19, glyphLine: 2.5,
    crateR: 5.4, corridorW: 7.2, ringGap: 7,
  };
  CW.SIZES = SIZES;

  // muted planetary tints; the glyph stays parchment on all of them
  var PLANET_TINTS = [
    '#46587a', '#4b6a6c', '#6b584a', '#6a4c5a',
    '#4b6653', '#584f6e', '#665f44', '#4c5d72',
  ];

  function syncTheme() {
    TH = CW.theme;
    if (!TH) { TH = {}; return; }
    INK = TH.ink; PARCH = TH.parch;
    PARCH_DIM = alphaColor(PARCH, 0.55);
    AMBER = TH.amber; RED = TH.red;
    SIZES.colonyR = TH.colonyR; SIZES.specialR = TH.specialR;
    SIZES.glyphLine = TH.glyphLine; SIZES.crateR = TH.crateR;
    SIZES.corridorW = TH.corridorW; SIZES.ringGap = TH.ringGap;
    PLANET_TINTS = [TH.planet0, TH.planet1, TH.planet2, TH.planet3,
      TH.planet4, TH.planet5, TH.planet6, TH.planet7];
  }

  // ink-family dark used for channels, shadows and recesses
  function darkInk(a) {
    var r = parseInt(INK.slice(1, 3), 16), g = parseInt(INK.slice(3, 5), 16), b = parseInt(INK.slice(5, 7), 16);
    return 'rgba(' + Math.round(r * 0.75) + ',' + Math.round(g * 0.75) + ',' + Math.round(b * 0.78) + ',' + a + ')';
  }

  var canvas, ctx, dpr = 1, W = 0, H = 0;

  var cam = { x: 0, y: 0, scale: 1, init: false };
  CW.camera = cam;

  CW.worldToScreen = function (x, y) {
    return { x: (x - cam.x) * cam.scale + W / 2, y: (y - cam.y) * cam.scale + H / 2 };
  };
  CW.screenToWorld = function (x, y) {
    return { x: (x - W / 2) / cam.scale + cam.x, y: (y - H / 2) / cam.scale + cam.y };
  };

  var stars = [];
  function makeStars(seedRng) {
    stars = [];
    var rnd = seedRng || Math.random;
    var count = (CW.theme && CW.theme.starCount != null) ? CW.theme.starCount : 150;
    for (var i = 0; i < count; i++) {
      stars.push({
        x: (rnd() - 0.5) * 5200, y: (rnd() - 0.5) * 3400,
        r: 0.4 + rnd() * 1.1, a: 0.08 + rnd() * 0.3,
        tw: 0.5 + rnd() * 2, ph: rnd() * 6.28,
      });
    }
  }

  CW.initRenderer = function (canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    syncTheme();
    CW.resizeRenderer();
    makeStars();
  };

  CW.resizeRenderer = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };

  // ------------------------------------------------------ camera
  function updateCamera(game, dt) {
    if (!game.colonies.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    game.colonies.forEach(function (c) {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    });
    var m = 100;
    minX -= m; maxX += m + 42; minY -= m; maxY += m;
    var bw = Math.max(maxX - minX, 260), bh = Math.max(maxY - minY, 200);
    var padX = 40, padTop = 58, padBot = 74;
    var ts = Math.min((W - padX * 2) / bw, (H - padTop - padBot) / bh);
    ts = Math.max(0.22, Math.min(1.9, ts));
    var tx = (minX + maxX) / 2, ty = (minY + maxY) / 2 + (padBot - padTop) / 2 / ts;
    if (!cam.init) { cam.x = tx; cam.y = ty; cam.scale = ts; cam.init = true; return; }
    if (CW.inputActive) return; // hold steady under the player's finger
    var k = 1 - Math.exp(-dt * 2.2);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.scale += (ts - cam.scale) * k;
  }
  CW.resetCamera = function () { cam.init = false; };
  CW.remakeStars = function () { makeStars(); };

  // ------------------------------------------------------ helpers
  function chan(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function alphaColor(hex, a) {
    var c = chan(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function mix(hexA, hexB, f) {
    var a = chan(hexA), b = chan(hexB);
    var r = Math.round(a[0] + (b[0] - a[0]) * f);
    var g = Math.round(a[1] + (b[1] - a[1]) * f);
    var bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function hashId(id) {
    var h = id | 0;
    h = Math.imul(h ^ 61, 0x27d4eb2d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2545f491);
    return (h ^ (h >>> 13)) >>> 0;
  }
  function flick(t, id) {
    return 0.72 + 0.28 * Math.sin(t * 13 + id * 7.3) * Math.sin(t * 29 + id * 3.1);
  }
  function colonyRadius(c) {
    return CW.TYPE_BY_ID[c.type].common ? SIZES.colonyR : SIZES.specialR;
  }

  // ------------------------------------------------------ background
  function drawBackground() {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(19,27,39,' + Math.min(1, 0.55 * TH.vignette).toFixed(3) + ')');
    vg.addColorStop(1, darkInk(Math.min(1, 0.9 * TH.vignette)));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(t) {
    if (TH.starBrightness <= 0) return;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x * 0.85, -cam.y * 0.85); // slight parallax
    stars.forEach(function (s) {
      var a = s.a * (0.75 + 0.25 * Math.sin(t * s.tw + s.ph)) * TH.starBrightness;
      ctx.fillStyle = alphaColor(TH.starColour, Math.min(1, a));
      ctx.fillRect(s.x, s.y, s.r * TH.starSize, s.r * TH.starSize);
    });
    ctx.restore();
  }

  function drawSurveyGrid() {
    if (TH.gridOpacity <= 0) return;
    ctx.strokeStyle = alphaColor(PARCH, Math.min(1, 0.05 * TH.gridOpacity));
    ctx.lineWidth = 1 / cam.scale;
    var step = Math.max(50, TH.gridSpacing);
    for (var r = step; r <= 1200; r += step) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = alphaColor(PARCH, Math.min(1, 0.032 * TH.gridOpacity));
    var radials = Math.max(0, Math.round(TH.gridRadials));
    for (var i = 0; i < radials; i++) {
      var a = (i / radials) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 70, Math.sin(a) * 70);
      ctx.lineTo(Math.cos(a) * 1220, Math.sin(a) * 1220);
      ctx.stroke();
    }
    // origin datum mark
    ctx.strokeStyle = alphaColor(PARCH, Math.min(1, 0.12 * TH.gridOpacity));
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    ctx.moveTo(0, -8); ctx.lineTo(0, 8);
    ctx.stroke();
  }

  // ------------------------------------------------------ nebulae
  // Rendered as charted hazard regions: luminous ionised body, drifting
  // wisps, survey hatching and sparks. Corridors may not pass through
  // without a Beacon Relay.
  function drawNebulae(game, t) {
    game.nebulae.forEach(function (neb, ni) {
      var hue = neb.hue + TH.nebulaHueShift;
      var sat = function (s) { return Math.max(0, Math.min(100, s * TH.nebulaSat)).toFixed(1); };

      // pass 1 — luminous body
      var bodyA = 0.26 * TH.nebulaGlow, bodyB = 0.14 * TH.nebulaGlow;
      neb.blobs.forEach(function (b, i) {
        var wob = 1 + 0.05 * Math.sin(t * 0.4 + i * 1.7 + ni * 3);
        var r = b.r * wob;
        var g = ctx.createRadialGradient(b.x, b.y, r * 0.08, b.x, b.y, r);
        g.addColorStop(0, 'hsla(' + hue + ',' + sat(60) + '%,52%,' + bodyA.toFixed(3) + ')');
        g.addColorStop(0.65, 'hsla(' + hue + ',' + sat(58) + '%,42%,' + bodyB.toFixed(3) + ')');
        g.addColorStop(1, 'hsla(' + hue + ',' + sat(55) + '%,34%,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // pass 2 — drifting inner wisps
      var wispA = 0.10 * TH.nebulaWisps;
      for (var wi = 0; wi < neb.blobs.length; wi += 2) {
        var b2 = neb.blobs[wi];
        var ox = Math.sin(t * 0.22 + wi * 2.3) * b2.r * 0.34;
        var oy = Math.cos(t * 0.17 + wi * 1.1) * b2.r * 0.3;
        var wr = b2.r * 0.5;
        var g2 = ctx.createRadialGradient(b2.x + ox, b2.y + oy, 1, b2.x + ox, b2.y + oy, wr);
        g2.addColorStop(0, 'hsla(' + hue + ',' + sat(75) + '%,70%,' + wispA.toFixed(3) + ')');
        g2.addColorStop(1, 'hsla(' + hue + ',' + sat(75) + '%,70%,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(b2.x + ox, b2.y + oy, wr, 0, Math.PI * 2);
        ctx.fill();
      }

      // pass 3 — survey hatching, clipped to the region (a charted
      // "keep out" wash straight off a company drawing)
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ctx.save();
      ctx.beginPath();
      neb.blobs.forEach(function (b) {
        ctx.moveTo(b.x + b.r * 0.86, b.y);
        ctx.arc(b.x, b.y, b.r * 0.86, 0, Math.PI * 2);
        x0 = Math.min(x0, b.x - b.r); y0 = Math.min(y0, b.y - b.r);
        x1 = Math.max(x1, b.x + b.r); y1 = Math.max(y1, b.y + b.r);
      });
      ctx.clip();
      ctx.strokeStyle = 'hsla(' + hue + ',' + sat(80) + '%,82%,' + (0.07 * TH.nebulaHatch).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      var span = (y1 - y0);
      for (var k = x0 - span; k < x1; k += Math.max(6, TH.hatchSpacing)) {
        ctx.moveTo(k, y1);
        ctx.lineTo(k + span, y0);
      }
      ctx.stroke();
      ctx.restore();

      // pass 4 — ionisation sparks
      if (TH.nebulaSparks <= 0) return;
      ctx.fillStyle = 'hsla(' + hue + ',' + sat(90) + '%,85%,' + Math.min(1, 0.7 * TH.nebulaSparks).toFixed(3) + ')';
      for (var s = 0; s < neb.blobs.length; s++) {
        var b3 = neb.blobs[s];
        var ph = Math.sin(t * 2.1 + s * 4.7);
        if (ph > 0.78) {
          var sx = b3.x + Math.sin(s * 13.7 + t * 0.2) * b3.r * 0.55;
          var sy = b3.y + Math.cos(s * 7.9 + t * 0.13) * b3.r * 0.55;
          ctx.fillRect(sx, sy, 1.8, 1.8);
        }
      }
    });
  }

  // ------------------------------------------------------ corridors
  function tracePath(pts, loop) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (loop) ctx.closePath();
  }

  // simple stroked path — still used for highlights and elastics
  function strokePath(pts, loop, colour, width, dash) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    tracePath(pts, loop);
    ctx.stroke();
    ctx.restore();
  }

  /* A hyperspace conduit: soft field glow, twin containment rails with
     a dark channel between them, and a slow pulse of energy travelling
     the channel. Deliberately nothing like a metro line. */
  function drawConduit(pts, loop, colour, t, active) {
    if (pts.length < 2) return;
    var outer = SIZES.corridorW;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = active ? 1 : 0.55;

    // ambient field
    ctx.strokeStyle = alphaColor(colour, Math.min(1, 0.10 * TH.conduitGlow));
    ctx.lineWidth = outer * 2.4;
    tracePath(pts, loop); ctx.stroke();

    // rail body
    ctx.strokeStyle = alphaColor(colour, 0.95);
    ctx.lineWidth = outer;
    tracePath(pts, loop); ctx.stroke();

    // hollow the channel: leaves two thin rails
    var hollow = Math.max(0, outer - TH.conduitHollow);
    if (hollow > 0) {
      ctx.strokeStyle = darkInk(0.93);
      ctx.lineWidth = hollow;
      tracePath(pts, loop); ctx.stroke();

      // faint luminous interior
      ctx.strokeStyle = alphaColor(colour, Math.min(1, 0.14 * TH.conduitGlow));
      ctx.lineWidth = hollow;
      tracePath(pts, loop); ctx.stroke();
    }

    if (active) {
      // travelling energy pulses
      ctx.setLineDash([TH.pulseLen, TH.pulseGap]);
      ctx.lineDashOffset = -(t * TH.pulseSpeed) % (TH.pulseLen + TH.pulseGap);
      ctx.strokeStyle = alphaColor(colour, TH.pulseAlpha);
      ctx.lineWidth = 1.8;
      tracePath(pts, loop); ctx.stroke();
    } else {
      // awaiting a vessel: a still, dashed survey line
      ctx.setLineDash([6, 7]);
      ctx.strokeStyle = alphaColor(colour, 0.5);
      ctx.lineWidth = 1.4;
      tracePath(pts, loop); ctx.stroke();
    }
    ctx.restore();
  }

  function computeNubs(game) {
    game.corridors.forEach(function (cor) {
      if (cor.loop || cor.path.length < 2) { cor._nubs = []; return; }
      var nubs = [];
      [['head', 0, 1], ['tail', cor.path.length - 1, cor.path.length - 2]].forEach(function (spec) {
        var p = cor.path[spec[1]], q = cor.path[spec[2]];
        var stop = game.colonyById(cor.stops[spec[1]]);
        var dx = p.x - q.x, dy = p.y - q.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ext = (stop ? colonyRadius(stop) : SIZES.colonyR) + 13;
        nubs.push({ end: spec[0], x: p.x + dx / len * ext, y: p.y + dy / len * ext, dx: dx / len, dy: dy / len });
      });
      cor._nubs = nubs;
    });
  }

  function drawCorridors(game, t) {
    var drag = CW.input && CW.input.drag;
    game.corridors.forEach(function (cor) {
      if (drag && drag.corridor === cor) return; // preview drawn instead
      var colour = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;
      drawConduit(cor.path, cor.loop, colour, t, cor.ships.length > 0);
    });
    // end nubs (grab handles): a dashed unfinished stub with a cap tick
    computeNubs(game);
    game.corridors.forEach(function (cor) {
      if (drag && drag.corridor === cor) return;
      var colour = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;
      (cor._nubs || []).forEach(function (nub) {
        var p = cor.path[nub.end === 'head' ? 0 : cor.path.length - 1];
        ctx.save();
        ctx.strokeStyle = alphaColor(colour, 0.85);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nub.x, nub.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(nub.x - nub.dy * 6.5, nub.y + nub.dx * 6.5);
        ctx.lineTo(nub.x + nub.dy * 6.5, nub.y - nub.dx * 6.5);
        ctx.stroke();
        ctx.restore();
      });
    });
    drawRelayBeacons(game, t);
    if (drag) drawDragPreview(game, drag, t);
  }

  function drawRelayBeacons(game, t) {
    game.corridors.forEach(function (cor) {
      var n = cor.stops.length, count = cor.loop ? n : n - 1;
      for (var i = 0; i < count; i++) {
        var a = game.colonyById(cor.stops[i]), b = game.colonyById(cor.stops[(i + 1) % n]);
        if (!a || !b) continue;
        if (game.segCrossCost(a, b) <= 0) continue;
        // find midpoint of the crossing span
        var inside = [];
        for (var s = 0; s <= 24; s++) {
          var x = a.x + (b.x - a.x) * (s / 24), y = a.y + (b.y - a.y) * (s / 24);
          if (game.pointInNebula(x, y, 0)) inside.push(s / 24);
        }
        var mid = inside.length ? inside[Math.floor(inside.length / 2)] : 0.5;
        var mx = a.x + (b.x - a.x) * mid, my = a.y + (b.y - a.y) * mid;
        var colour = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;
        ctx.save();
        ctx.translate(mx, my);
        ctx.scale(TH.relayScale, TH.relayScale);
        // stabilised clearing around the beacon
        var cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
        cg.addColorStop(0, darkInk(0.55));
        cg.addColorStop(1, darkInk(0));
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
        // the relay pylon
        ctx.strokeStyle = PARCH;
        ctx.lineWidth = 1.9;
        ctx.beginPath();
        ctx.moveTo(0, -9.5); ctx.lineTo(7, 0); ctx.lineTo(0, 9.5); ctx.lineTo(-7, 0);
        ctx.closePath();
        ctx.stroke();
        var blink = 0.35 + 0.65 * (Math.sin(t * 3) > 0 ? 1 : 0.15);
        ctx.fillStyle = alphaColor(colour, blink);
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        // radiating stabilisation ring
        var ph = (t * 0.7) % 1;
        ctx.strokeStyle = alphaColor(colour, (1 - ph) * 0.4);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + ph * 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawDragPreview(game, drag, t) {
    var colour = CW.CORRIDOR_COLOURS[drag.colourIdx].hex;
    var pts = drag.renderStops || [];
    if (pts.length >= 2) drawConduit(pts, drag.renderLoop, colour, t, true);
    (drag.elastics || []).forEach(function (e) {
      ctx.save();
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = e.blocked ? RED : alphaColor(colour, 0.85);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.x0, e.y0);
      ctx.lineTo(e.x1, e.y1);
      ctx.stroke();
      ctx.restore();
    });
  }

  // ------------------------------------------------------ ships
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawContainer(cx, cy, cell, crate) {
    if (crate) {
      ctx.fillStyle = PARCH;
      roundRect(cx - cell / 2, cy - cell / 2, cell, cell, 1.1);
      ctx.fill();
      CW.drawGlyph(ctx, crate.type, cx, cy, cell * 0.40, 'solid', darkInk(0.9));
    } else {
      // empty bay: a visible recessed slot
      ctx.fillStyle = darkInk(0.45);
      roundRect(cx - cell / 2, cy - cell / 2, cell, cell, 1.1);
      ctx.fill();
      ctx.strokeStyle = alphaColor(PARCH, 0.22);
      ctx.lineWidth = 0.7;
      roundRect(cx - cell / 2, cy - cell / 2, cell, cell, 1.1);
      ctx.stroke();
    }
  }

  /* The company freighter, top-down: pointed bridge section, container
     spine amidships, engine block astern with a live exhaust. Cargo is
     carried as visible parchment containers, six to the hull and six to
     each towed pod barge. */
  function drawShips(game, t) {
    var cfg = CW.config;
    game.ships.forEach(function (ship) {
      var cor = ship.corridor;
      if (!cor || cor.path.length < 2) return;
      var colour = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;

      // heading
      var n = cor.path.length;
      var p0 = cor.path[ship.seg], p1 = cor.path[(ship.seg + 1) % n];
      if (ship.state === 'move') {
        ship.angle = Math.atan2((p1.y - p0.y) * ship.dir, (p1.x - p0.x) * ship.dir);
      }
      var ang = ship.angle || 0;

      // engine trail
      if (ship.trail && ship.trail.length > 1 && ship.state === 'move' && TH.trailAlpha > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        for (var i = 1; i < ship.trail.length; i++) {
          var f = i / ship.trail.length;
          ctx.strokeStyle = alphaColor(colour, Math.min(1, 0.30 * f * TH.trailAlpha));
          ctx.lineWidth = 2.8 * f;
          ctx.beginPath();
          ctx.moveTo(ship.trail[i - 1].x, ship.trail[i - 1].y);
          ctx.lineTo(ship.trail[i].x, ship.trail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ang);

      var L = TH.shipL, Wd = TH.shipW;
      var hullDark = mix(colour, '#0a0e14', 0.45);

      // exhaust (only under way)
      if (ship.state === 'move' && TH.exhaust > 0) {
        var lick = (5 + 2.4 * Math.sin(t * 21 + ship.id * 3)) * TH.exhaust;
        ctx.fillStyle = 'rgba(255,214,140,' + Math.min(1, 0.5 * TH.exhaust).toFixed(3) + ')';
        [[-Wd * 0.22], [Wd * 0.22]].forEach(function (off) {
          ctx.beginPath();
          ctx.moveTo(-L / 2 - 0.5, off[0] - 1.6);
          ctx.lineTo(-L / 2 - lick, off[0]);
          ctx.lineTo(-L / 2 - 0.5, off[0] + 1.6);
          ctx.closePath();
          ctx.fill();
        });
      }

      // hull — ink underlay then colour, with a fine parchment trim so
      // the vessel never camouflages against its own conduit
      function hullPath(grow) {
        var g2 = grow || 0;
        ctx.beginPath();
        ctx.moveTo(L / 2 + 5 + g2, 0);                        // bow tip
        ctx.lineTo(L / 2 - 3, -Wd * 0.34 - g2);               // bridge taper
        ctx.lineTo(L * 0.16, -Wd * 0.5 - g2);
        ctx.lineTo(-L / 2 + 3.5, -Wd * 0.5 - g2);             // spine
        ctx.lineTo(-L / 2 - g2, -Wd * 0.30);                  // stern notch
        ctx.lineTo(-L / 2 - g2, Wd * 0.30);
        ctx.lineTo(-L / 2 + 3.5, Wd * 0.5 + g2);
        ctx.lineTo(L * 0.16, Wd * 0.5 + g2);
        ctx.lineTo(L / 2 - 3, Wd * 0.34 + g2);
        ctx.closePath();
      }
      ctx.fillStyle = darkInk(0.75);
      hullPath(1.6);
      ctx.fill();
      ctx.fillStyle = colour;
      hullPath(0);
      ctx.fill();
      ctx.strokeStyle = alphaColor(PARCH, TH.shipTrim);
      ctx.lineWidth = 0.9;
      hullPath(0);
      ctx.stroke();

      // stern fins
      ctx.fillStyle = hullDark;
      ctx.beginPath();
      ctx.moveTo(-L / 2 + 5, -Wd * 0.5); ctx.lineTo(-L / 2 + 1, -Wd * 0.82);
      ctx.lineTo(-L / 2 + 1.6, -Wd * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-L / 2 + 5, Wd * 0.5); ctx.lineTo(-L / 2 + 1, Wd * 0.82);
      ctx.lineTo(-L / 2 + 1.6, Wd * 0.45);
      ctx.closePath(); ctx.fill();

      // engine block + bridge light
      ctx.fillStyle = hullDark;
      roundRect(-L / 2 - 0.5, -Wd * 0.3, 3.4, Wd * 0.6, 1);
      ctx.fill();
      ctx.fillStyle = alphaColor(PARCH, 0.9);
      ctx.beginPath();
      ctx.arc(L / 2 - 0.5, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // container bays: 2 × 3 on the hull spine
      var cell = TH.cargoCell;
      var hullSlots = Math.min(cfg.shipCapacity, 6);
      for (var slot = 0; slot < hullSlots; slot++) {
        var col = Math.floor(slot / 2), row = slot % 2;
        var cx = L * 0.16 - 3.4 - col * (cell + 0.9);
        var cy = row === 0 ? -Wd * 0.24 : Wd * 0.24;
        drawContainer(cx, cy, cell, ship.cargo[slot]);
      }

      // towed pod barges, 6 containers each — sized from the cell
      var bargeW = (cell + 0.9) * 3 + 1.5, bargeH = cell * 2 + 1.6;
      for (var pd = 0; pd < ship.pods; pd++) {
        var bx = -L / 2 - 5 - pd * (bargeW + 2.5);   // barge centre x
        // coupling
        ctx.strokeStyle = alphaColor(colour, 0.7);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(bx + bargeW / 2, 0);
        ctx.lineTo(bx + bargeW / 2 + 3.5, 0);
        ctx.stroke();
        ctx.fillStyle = mix(colour, '#0a0e14', 0.25);
        roundRect(bx - bargeW / 2, -bargeH / 2, bargeW, bargeH, 2);
        ctx.fill();
        for (var ps = 0; ps < 6; ps++) {
          var pcol = Math.floor(ps / 2), prow = ps % 2;
          var pcx = bx + bargeW / 2 - cell / 2 - 1.3 - pcol * (cell + 0.8);
          var pcy = (prow === 0 ? -1 : 1) * (cell / 2 + 0.3);
          drawContainer(pcx, pcy, cell - 0.4, ship.cargo[6 + pd * 6 + ps]);
        }
      }
      ctx.restore();
    });
  }

  // ------------------------------------------------------ colonies (planets)
  function drawPlanet(c, R, bright, t) {
    var h = hashId(c.id);
    var tint = PLANET_TINTS[h % PLANET_TINTS.length];
    var special = !CW.TYPE_BY_ID[c.type].common;

    // designated colonies are ringed worlds — the ring peeks out
    // behind the disc, drawn first so the planet occludes its middle
    if (special && TH.specialRing > 0) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(-0.45 + (h % 5) * 0.09);
      ctx.strokeStyle = alphaColor(PARCH, Math.min(1, 0.5 * bright * TH.specialRing));
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.7, R * 0.52, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // sphere
    var g = ctx.createRadialGradient(c.x - R * 0.38, c.y - R * 0.42, R * 0.12, c.x, c.y, R * 1.02);
    g.addColorStop(0, mix(tint, '#dfe8f2', TH.planetLight));
    g.addColorStop(0.55, tint);
    g.addColorStop(1, mix(tint, '#05070b', TH.planetShade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.fill();

    // surface character, clipped to the disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.clip();
    if (h & 1) {
      // banded world
      var tilt = ((h >> 3) % 7 - 3) * 0.06;
      ctx.strokeStyle = darkInk(Math.min(1, 0.16 * TH.surfaceDetail));
      ctx.lineWidth = R * 0.17;
      [-0.42, 0.05, 0.5].forEach(function (yy, bi) {
        ctx.beginPath();
        ctx.moveTo(c.x - R, c.y + R * yy - R * tilt);
        ctx.quadraticCurveTo(c.x, c.y + R * yy + R * 0.12 * (bi - 1), c.x + R, c.y + R * yy + R * tilt);
        ctx.stroke();
      });
    } else {
      // cratered world
      ctx.fillStyle = darkInk(Math.min(1, 0.18 * TH.surfaceDetail));
      for (var ci = 0; ci < 3; ci++) {
        var ca = ((h >> (ci * 4)) % 100) / 100 * Math.PI * 2;
        var cr = R * (0.42 + ((h >> (ci * 3)) % 40) / 100);
        ctx.beginPath();
        ctx.arc(c.x + Math.cos(ca) * cr, c.y + Math.sin(ca) * cr, R * (0.11 + ((h >> ci) % 3) * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // terminator: night side to lower-right
    var tg = ctx.createRadialGradient(c.x - R * 0.5, c.y - R * 0.5, R * 0.4, c.x - R * 0.5, c.y - R * 0.5, R * 2.1);
    tg.addColorStop(0, darkInk(0));
    tg.addColorStop(0.72, darkInk(0));
    tg.addColorStop(1, darkInk(Math.min(1, 0.55 * TH.terminator)));
    ctx.fillStyle = tg;
    ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2);
    ctx.restore();

    // thin atmospheric limb on the lit side
    ctx.strokeStyle = 'rgba(220,230,240,' + Math.min(1, 0.22 * bright * TH.limbLight).toFixed(3) + ')';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R - 0.6, Math.PI * 0.8, Math.PI * 1.75);
    ctx.stroke();

    // reserves failing: the world goes dark
    if (bright < 1) {
      ctx.fillStyle = darkInk((1 - bright) * 0.6);
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawColonies(game, t) {
    var cfg = CW.config;
    game.colonies.forEach(function (c) {
      var R = colonyRadius(c);
      var bright = 0.55 + 0.45 * c.reserve;
      if (c.reserve < 0.25 || c.starve !== null) bright *= flick(t, c.id);

      // halo glow
      var g = ctx.createRadialGradient(c.x, c.y, R * 0.4, c.x, c.y, R * 2.3);
      g.addColorStop(0, alphaColor(PARCH, Math.min(1, 0.12 * bright * TH.halo)));
      g.addColorStop(1, alphaColor(PARCH, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R * 2.3, 0, Math.PI * 2);
      ctx.fill();

      drawPlanet(c, R, bright, t);

      // hub: an outer orbital works ring
      if (c.isHub) {
        ctx.strokeStyle = alphaColor(PARCH, Math.min(1, 0.85 * bright));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, R + SIZES.ringGap + 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // reserve ring / distress countdown
      var ringR = R + SIZES.ringGap;
      if (c.starve === null) {
        var warn = c.reserve <= 0.4;
        ctx.strokeStyle = !warn ? PARCH_DIM
          : alphaColor(c.reserve > 0.15 ? AMBER : RED, 0.9);
        ctx.lineWidth = warn ? TH.ringWidth + 0.6 : TH.ringWidth;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, c.reserve));
        ctx.stroke();
        // ghost of full ring
        ctx.strokeStyle = alphaColor(PARCH, 0.10);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        var frac = Math.max(0, c.starve / cfg.starveCountdownSec);
        ctx.strokeStyle = c.graceActive ? AMBER : RED;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
        // distress pulses
        if (!c.graceActive) {
          for (var pu = 0; pu < 2; pu++) {
            var ph = ((t * 0.8) + pu * 0.5) % 1;
            ctx.strokeStyle = alphaColor('#d4574f', (1 - ph) * 0.5);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(c.x, c.y, ringR + 4 + ph * 26, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // delivery pulse
      if (c.pulse > 0) {
        ctx.strokeStyle = alphaColor(PARCH, c.pulse * 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR + (1 - c.pulse) * 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // the glyph — the world IS its unmet need. Drop shadow first so
      // it stays legible over any planet tint.
      var gr = R * TH.glyphScale;
      ctx.lineWidth = SIZES.glyphLine;
      CW.drawGlyph(ctx, c.type, c.x + 0.9, c.y + 1.2, gr, 'outline', darkInk(0.55));
      CW.drawGlyph(ctx, c.type, c.x, c.y, gr, 'outline', alphaColor(PARCH, Math.min(1, bright)));
      CW.drawGlyphDetail(ctx, c.type, c.x, c.y, gr, alphaColor(PARCH, bright * 0.5));

      // waiting crates, queued beside the colony
      drawQueue(game, c, R);

      // assign-mode target pulse
      if (CW.assignMode === 'hub' && !c.isHub) {
        var pa = 0.35 + 0.3 * Math.sin(t * 5);
        ctx.strokeStyle = alphaColor(PARCH, pa);
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  function drawQueue(game, c, R) {
    var qx = c.x + R + 12, qy = c.y - 9;
    var maxDraw = 14;
    for (var i = 0; i < Math.min(c.queue.length, maxDraw); i++) {
      var col = i % 5, row = Math.floor(i / 5);
      CW.drawGlyph(ctx, c.queue[i].type, qx + col * 12.5, qy + row * 12.5, SIZES.crateR, 'solid', PARCH);
    }
    if (c.queue.length > maxDraw) {
      ctx.fillStyle = PARCH_DIM;
      ctx.font = '9px ' + (CW.themeFont || 'Georgia, serif');
      ctx.fillText('+' + (c.queue.length - maxDraw), qx, qy + 3 * 12.5);
    }
  }

  // ------------------------------------------------------ effects
  function drawEffects(game, t) {
    game.effects.forEach(function (e) {
      var age = game.simTime - e.t0;
      if (e.kind === 'delivery') return; // colony pulse covers it
      var f = Math.min(1, age / 1.6);
      if (e.kind === 'spawn' || e.kind === 'transform') {
        var col = e.kind === 'transform' ? TH.brass : PARCH;
        for (var i = 0; i < 2; i++) {
          var ff = Math.max(0, Math.min(1, f * 1.3 - i * 0.25));
          if (ff <= 0 || ff >= 1) continue;
          ctx.strokeStyle = alphaColor(col, (1 - ff) * 0.7);
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 14 + ff * 42, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
  }

  // ------------------------------------------------------ assign-mode corridor pulse
  function drawAssignHighlights(game, t) {
    if (CW.assignMode !== 'ship' && CW.assignMode !== 'pod') return;
    var pa = 0.14 + 0.10 * Math.sin(t * 5);
    game.corridors.forEach(function (cor) {
      strokePath(cor.path, cor.loop, 'rgba(255,255,255,' + pa.toFixed(3) + ')', SIZES.corridorW * 3, null);
    });
  }

  // ------------------------------------------------------ frame
  CW.renderFrame = function (game, dt, wallT) {
    if (!ctx) return;
    syncTheme();
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) CW.resizeRenderer();
    updateCamera(game, dt);
    var t = wallT;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    drawStars(t);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x, -cam.y);

    drawSurveyGrid();
    drawNebulae(game, t);
    drawAssignHighlights(game, t);
    drawCorridors(game, t);
    drawShips(game, t);
    drawColonies(game, t);
    drawEffects(game, t);

    ctx.restore();
  };
})();
