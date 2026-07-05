/* render.js — canvas renderer. The player is not looking at space; they
   are looking at the holographic route chart of an Interstellar
   Logistics Command terminal: deep ink, a polar survey grid, parchment
   glyphs and thin corridors of company livery. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var INK = '#0b1017';           // page background lives in CSS too
  var PARCH = '#e9e0c9';
  var PARCH_DIM = 'rgba(233,224,201,0.55)';
  var AMBER = '#dca94b';
  var RED = '#d4574f';

  var SIZES = {
    colonyR: 13, specialR: 16.5, glyphLine: 2.4,
    crateR: 5.4, corridorW: 3.6, ringGap: 7,
  };
  CW.SIZES = SIZES;

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
    for (var i = 0; i < 150; i++) {
      stars.push({
        x: (rnd() - 0.5) * 3000, y: (rnd() - 0.5) * 2000,
        r: 0.4 + rnd() * 1.1, a: 0.08 + rnd() * 0.3,
        tw: 0.5 + rnd() * 2, ph: rnd() * 6.28,
      });
    }
  }

  CW.initRenderer = function (canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
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
    var m = 95;
    minX -= m; maxX += m + 40; minY -= m; maxY += m;
    var bw = Math.max(maxX - minX, 260), bh = Math.max(maxY - minY, 200);
    var padX = 40, padTop = 58, padBot = 74;
    var ts = Math.min((W - padX * 2) / bw, (H - padTop - padBot) / bh);
    ts = Math.max(0.4, Math.min(1.9, ts));
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
  function alphaColor(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function flick(t, id) {
    return 0.72 + 0.28 * Math.sin(t * 13 + id * 7.3) * Math.sin(t * 29 + id * 3.1);
  }

  // ------------------------------------------------------ background
  function drawBackground(game, t) {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(19,27,39,0.55)');
    vg.addColorStop(1, 'rgba(4,6,10,0.9)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(t) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x * 0.85, -cam.y * 0.85); // slight parallax
    stars.forEach(function (s) {
      var a = s.a * (0.75 + 0.25 * Math.sin(t * s.tw + s.ph));
      ctx.fillStyle = 'rgba(214,222,240,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    });
    ctx.restore();
  }

  function drawSurveyGrid() {
    ctx.strokeStyle = 'rgba(233,224,201,0.05)';
    ctx.lineWidth = 1 / cam.scale;
    for (var r = 150; r <= 1200; r += 150) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(233,224,201,0.032)';
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 70, Math.sin(a) * 70);
      ctx.lineTo(Math.cos(a) * 1220, Math.sin(a) * 1220);
      ctx.stroke();
    }
    // origin datum mark
    ctx.strokeStyle = 'rgba(233,224,201,0.12)';
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    ctx.moveTo(0, -8); ctx.lineTo(0, 8);
    ctx.stroke();
  }

  // ------------------------------------------------------ nebulae
  function drawNebulae(game, t) {
    game.nebulae.forEach(function (neb, ni) {
      neb.blobs.forEach(function (b, i) {
        var wob = 1 + 0.06 * Math.sin(t * 0.4 + i * 1.7 + ni * 3);
        var r = b.r * wob;
        var g = ctx.createRadialGradient(b.x, b.y, r * 0.1, b.x, b.y, r);
        var h = neb.hue;
        g.addColorStop(0, 'hsla(' + h + ',48%,44%,0.16)');
        g.addColorStop(0.7, 'hsla(' + h + ',52%,36%,0.10)');
        g.addColorStop(1, 'hsla(' + h + ',55%,30%,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
      });
      // ionisation sparkles
      ctx.fillStyle = 'rgba(216,190,255,0.5)';
      for (var s = 0; s < neb.blobs.length; s++) {
        var b2 = neb.blobs[s];
        var ph = Math.sin(t * 2.1 + s * 4.7);
        if (ph > 0.86) {
          var sx = b2.x + Math.sin(s * 13.7 + t * 0.2) * b2.r * 0.5;
          var sy = b2.y + Math.cos(s * 7.9 + t * 0.13) * b2.r * 0.5;
          ctx.fillRect(sx, sy, 1.6, 1.6);
        }
      }
    });
  }

  // ------------------------------------------------------ corridors
  function corridorPoints(cor) { return cor.path || []; }

  function strokePath(pts, loop, colour, width, dash, glow) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    if (glow) {
      ctx.strokeStyle = alphaColor(colour, 0.13);
      ctx.lineWidth = width * 2.6;
      tracePath(pts, loop); ctx.stroke();
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    tracePath(pts, loop); ctx.stroke();
    ctx.restore();
  }
  function tracePath(pts, loop) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (loop) ctx.closePath();
  }

  function computeNubs(game) {
    game.corridors.forEach(function (cor) {
      if (cor.loop || cor.path.length < 2) { cor._nubs = []; return; }
      var nubs = [];
      [['head', 0, 1], ['tail', cor.path.length - 1, cor.path.length - 2]].forEach(function (spec) {
        var p = cor.path[spec[1]], q = cor.path[spec[2]];
        var dx = p.x - q.x, dy = p.y - q.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ext = SIZES.colonyR + 15;
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
      var dash = cor.ships.length ? null : [9, 7];
      strokePath(corridorPoints(cor), cor.loop, colour, SIZES.corridorW, dash, true);
    });
    // end nubs (grab handles)
    computeNubs(game);
    game.corridors.forEach(function (cor) {
      if (drag && drag.corridor === cor) return;
      var colour = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;
      (cor._nubs || []).forEach(function (nub) {
        var p = cor.path[nub.end === 'head' ? 0 : cor.path.length - 1];
        ctx.strokeStyle = colour;
        ctx.lineWidth = SIZES.corridorW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nub.x, nub.y);
        ctx.stroke();
        // perpendicular cap tick
        ctx.beginPath();
        ctx.moveTo(nub.x - nub.dy * 6, nub.y + nub.dx * 6);
        ctx.lineTo(nub.x + nub.dy * 6, nub.y - nub.dx * 6);
        ctx.stroke();
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
        ctx.strokeStyle = PARCH;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.stroke();
        var blink = 0.35 + 0.65 * (Math.sin(t * 3) > 0 ? 1 : 0.15);
        ctx.fillStyle = alphaColor(colour, blink);
        ctx.beginPath();
        ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  function drawDragPreview(game, drag, t) {
    var colour = CW.CORRIDOR_COLOURS[drag.colourIdx].hex;
    var pts = drag.renderStops || [];
    if (pts.length >= 2) strokePath(pts, drag.renderLoop, colour, SIZES.corridorW, null, true);
    (drag.elastics || []).forEach(function (e) {
      ctx.save();
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = e.blocked ? RED : alphaColor(colour, 0.85);
      ctx.lineWidth = SIZES.corridorW * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e.x0, e.y0);
      ctx.lineTo(e.x1, e.y1);
      ctx.stroke();
      ctx.restore();
    });
  }

  // ------------------------------------------------------ ships
  function drawShips(game, t) {
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
      if (ship.trail && ship.trail.length > 1 && ship.state === 'move') {
        ctx.save();
        ctx.lineCap = 'round';
        for (var i = 1; i < ship.trail.length; i++) {
          var f = i / ship.trail.length;
          ctx.strokeStyle = alphaColor(colour, 0.28 * f);
          ctx.lineWidth = 2.4 * f;
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

      var len = 17, wid = 8;
      // pods trail behind
      for (var pd = 0; pd < ship.pods; pd++) {
        var px = -len / 2 - 5 - pd * 13;
        ctx.fillStyle = alphaColor(colour, 0.9);
        roundRect(px - 11, -wid / 2 + 1, 11, wid - 2, 2.5);
        ctx.fill();
      }
      // hull: capsule with pointed bow
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(len / 2 + 4, 0);
      ctx.lineTo(len / 2 - 4, -wid / 2);
      ctx.lineTo(-len / 2, -wid / 2);
      ctx.lineTo(-len / 2, wid / 2);
      ctx.lineTo(len / 2 - 4, wid / 2);
      ctx.closePath();
      ctx.fill();

      // cargo minis (dark ink glyphs on the hull, MM-style):
      // first six ride the hull in a 2×3 grid, six more per pod
      var slots = Math.min(ship.cargo.length, 6 + ship.pods * 6);
      for (var ci = 0; ci < slots; ci++) {
        var cx, cy;
        if (ci < 6) {
          cx = len / 2 - 5.5 - Math.floor(ci / 2) * 6.2;
          cy = (ci % 2 === 0) ? -2.3 : 2.3;
        } else {
          var pi = Math.floor((ci - 6) / 6);
          var slot = (ci - 6) % 6;
          cx = -len / 2 - 8 - pi * 13 - Math.floor(slot / 2) * 3.4;
          cy = (slot % 2 === 0) ? -2 : 2;
        }
        CW.drawGlyph(ctx, ship.cargo[ci].type, cx, cy, 2.6, 'solid', 'rgba(10,14,20,0.85)');
      }
      ctx.restore();
    });
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ------------------------------------------------------ colonies
  function drawColonies(game, t) {
    var cfg = CW.config;
    game.colonies.forEach(function (c) {
      var special = !CW.TYPE_BY_ID[c.type].common;
      var R = special ? SIZES.specialR : SIZES.colonyR;
      var bright = 0.55 + 0.45 * c.reserve;
      if (c.reserve < 0.25 || c.starve !== null) bright *= flick(t, c.id);

      // halo glow
      var g = ctx.createRadialGradient(c.x, c.y, R * 0.4, c.x, c.y, R * 2.4);
      g.addColorStop(0, 'rgba(233,224,201,' + (0.13 * bright).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(233,224,201,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // dark plate behind glyph so corridors don't run through it
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R + 3.2, 0, Math.PI * 2);
      ctx.fill();

      // hub: double ring
      if (c.isHub) {
        ctx.strokeStyle = alphaColor('#e9e0c9', 0.85 * bright);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, R + SIZES.ringGap + 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // reserve ring / distress countdown
      var ringR = R + SIZES.ringGap;
      if (c.starve === null) {
        var col = c.reserve > 0.4 ? PARCH_DIM : (c.reserve > 0.15 ? AMBER : RED);
        ctx.strokeStyle = c.reserve > 0.4 ? col : alphaColor(c.reserve > 0.15 ? '#dca94b' : '#d4574f', 0.9);
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, c.reserve));
        ctx.stroke();
        // ghost of full ring
        ctx.strokeStyle = 'rgba(233,224,201,0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        var frac = Math.max(0, c.starve / cfg.starveCountdownSec);
        var dcol = c.graceActive ? AMBER : RED;
        ctx.strokeStyle = dcol;
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
        ctx.strokeStyle = alphaColor('#e9e0c9', c.pulse * 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, ringR + (1 - c.pulse) * 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // the glyph itself — the colony IS its unmet need
      var glyphCol = alphaColor('#e9e0c9', Math.min(1, bright));
      ctx.lineWidth = SIZES.glyphLine;
      CW.drawGlyph(ctx, c.type, c.x, c.y, R * 0.78, 'outline', glyphCol);
      CW.drawGlyphDetail(ctx, c.type, c.x, c.y, R * 0.78, alphaColor('#e9e0c9', bright * 0.5));

      // waiting crates, queued beside the colony
      drawQueue(game, c, R);

      // assign-mode target pulse
      if (CW.assignMode === 'hub' && !c.isHub) {
        var pa = 0.35 + 0.3 * Math.sin(t * 5);
        ctx.strokeStyle = alphaColor('#e9e0c9', pa);
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
    var qx = c.x + R + 11, qy = c.y - 9;
    var maxDraw = 14;
    for (var i = 0; i < Math.min(c.queue.length, maxDraw); i++) {
      var col = i % 5, row = Math.floor(i / 5);
      CW.drawGlyph(ctx, c.queue[i].type, qx + col * 12.5, qy + row * 12.5, SIZES.crateR, 'solid', PARCH);
    }
    if (c.queue.length > maxDraw) {
      ctx.fillStyle = PARCH_DIM;
      ctx.font = '9px Georgia, serif';
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
        var col = e.kind === 'transform' ? '#c9a227' : '#e9e0c9';
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
    var pa = 0.18 + 0.14 * Math.sin(t * 5);
    game.corridors.forEach(function (cor) {
      strokePath(corridorPoints(cor), cor.loop, alphaColor('#ffffff', pa), SIZES.corridorW * 3, null, false);
    });
  }

  // ------------------------------------------------------ frame
  CW.renderFrame = function (game, dt, wallT) {
    if (!ctx) return;
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) CW.resizeRenderer();
    updateCamera(game, dt);
    var t = wallT;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(game, t);
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
