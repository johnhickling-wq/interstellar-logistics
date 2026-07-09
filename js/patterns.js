/* patterns.js — The Pattern Book, second edition. The first printing
   taught the Board a lesson: thirty line styles are not nine beautiful
   objects. This edition presents three corridors, three vessels and
   three relay beacons, worked to the standard of the planets — soft,
   layered, quietly luminous, faintly magical — plus the letterform
   specimens carried over unchanged. Selections and adjustments persist
   in this browser and export as a requisition docket. Nothing here
   alters the game. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var TH = CW.theme;
  var INK = TH.ink, PARCH = TH.parch, BRASS = TH.brass;
  var COLS = CW.CORRIDOR_COLOURS.map(function (c) { return c.hex; });
  var TINTS = [TH.planet0, TH.planet1, TH.planet2, TH.planet3,
    TH.planet4, TH.planet5, TH.planet6, TH.planet7];
  var WARM = '#ffd9a0';           // lamplight
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ------------------------------------------------------------ colour
  function chan(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function alphaCol(hex, a) {
    var c = chan(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)) + ')';
  }
  function mix(hexA, hexB, f) { // returns hex so results can feed alphaCol/mix again
    var a = chan(hexA), b = chan(hexB);
    function h2(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + h2(a[0] + (b[0] - a[0]) * f) + h2(a[1] + (b[1] - a[1]) * f) + h2(a[2] + (b[2] - a[2]) * f);
  }
  function dark(a) {
    var c = chan(INK);
    return 'rgba(' + Math.round(c[0] * 0.72) + ',' + Math.round(c[1] * 0.72) + ',' + Math.round(c[2] * 0.76) + ',' + a + ')';
  }
  function rngFor(seed) {
    var s = seed * 2654435761 % 4294967296;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }
  // small value noise for organic variation
  function hash1(n) { var s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
  function noise1(x) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash1(i) * (1 - u) + hash1(i + 1) * u;
  }

  // ------------------------------------------------------------ paths
  function makePath(pts) {
    var segs = [], len = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      var l = Math.sqrt(dx * dx + dy * dy);
      segs.push({ x: pts[i - 1].x, y: pts[i - 1].y, dx: dx / l, dy: dy / l, l: l, d0: len });
      len += l;
    }
    return {
      pts: pts, len: len,
      at: function (d) {
        d = Math.max(0, Math.min(len, d));
        for (var i = segs.length - 1; i >= 0; i--) {
          if (d >= segs[i].d0) {
            var s = segs[i], u = d - s.d0;
            return { x: s.x + s.dx * u, y: s.y + s.dy * u, dx: s.dx, dy: s.dy, nx: -s.dy, ny: s.dx };
          }
        }
        var s0 = segs[0];
        return { x: s0.x, y: s0.y, dx: s0.dx, dy: s0.dy, nx: -s0.dy, ny: s0.dx };
      },
    };
  }
  // a gentle drape between two worlds: quadratic bézier, finely sampled
  function makeCurve(p0, pc, p1, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var u = i / n, v = 1 - u;
      pts.push({
        x: v * v * p0.x + 2 * v * u * pc.x + u * u * p1.x,
        y: v * v * p0.y + 2 * v * u * pc.y + u * u * p1.y,
      });
    }
    return makePath(pts);
  }
  function trace(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  }
  function offset(pts, d) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      var dx = p1.x - p0.x, dy = p1.y - p0.y;
      var l = Math.sqrt(dx * dx + dy * dy) || 1;
      out.push({ x: pts[i].x - dy / l * d, y: pts[i].y + dx / l * d });
    }
    return out;
  }
  function strokePts(c, pts, style, w, a) {
    c.strokeStyle = alphaCol(style, a);
    c.lineWidth = w;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    trace(c, pts);
    c.stroke();
  }
  // variable-width filled ribbon along a path
  function ribbon(c, P, halfW, style, a) {
    var up = [], down = [];
    for (var d = 0; d <= P.len; d += 4) {
      var p = P.at(d), hw = halfW(d);
      up.push({ x: p.x + p.nx * hw, y: p.y + p.ny * hw });
      down.push({ x: p.x - p.nx * hw, y: p.y - p.ny * hw });
    }
    c.fillStyle = alphaCol(style, a);
    c.beginPath();
    c.moveTo(up[0].x, up[0].y);
    up.forEach(function (p) { c.lineTo(p.x, p.y); });
    down.reverse().forEach(function (p) { c.lineTo(p.x, p.y); });
    c.closePath();
    c.fill();
  }
  // a soft luminous point: layered radial falloff
  function glowDot(c, x, y, r, hex, a) {
    if (a <= 0.003 || r <= 0) return;
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, alphaCol(hex, a));
    g.addColorStop(0.45, alphaCol(hex, a * 0.38));
    g.addColorStop(1, alphaCol(hex, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 6.29); c.fill();
  }

  // ------------------------------------------------------------ scenery
  function makeStars(rnd, n, W, H) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push([rnd() * W, rnd() * H, 0.4 + rnd() * 1.1, 0.05 + rnd() * 0.26,
        0.5 + rnd() * 1.8, rnd() * 6.28]);
    }
    return out;
  }
  function drawStars(c, stars, t) {
    stars.forEach(function (s) {
      c.fillStyle = alphaCol(TH.starColour, s[3] * (0.7 + 0.3 * Math.sin(t * s[4] + s[5])));
      c.fillRect(s[0], s[1], s[2], s[2]);
    });
  }
  function vignette(c, w, h) {
    var g = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  function nebulaWash(c, blobs, t, aMul) {
    if (aMul <= 0.02) return;
    blobs.forEach(function (b, i) {
      var breathe = 1 + 0.12 * Math.sin(t * 0.22 + i * 2.1);
      var g = c.createRadialGradient(b[0], b[1], 4, b[0], b[1], b[2]);
      g.addColorStop(0, 'hsla(' + b[3] + ',52%,62%,' + (0.15 * aMul * breathe) + ')');
      g.addColorStop(0.6, 'hsla(' + b[3] + ',52%,58%,' + (0.07 * aMul * breathe) + ')');
      g.addColorStop(1, 'hsla(' + b[3] + ',52%,58%,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(b[0], b[1], b[2], 0, 6.29); c.fill();
    });
  }

  function paintPlanet(c, x, y, R, tint, seed, glyphType) {
    glowDot(c, x, y, R * 2.3, tint, 0.16); // atmospheric presence
    var g = c.createRadialGradient(x - R * 0.38, y - R * 0.42, R * 0.12, x, y, R * 1.02);
    g.addColorStop(0, mix(tint, '#dfe8f2', 0.32));
    g.addColorStop(0.55, tint);
    g.addColorStop(1, mix(tint, '#05070b', 0.62));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.clip();
    if (seed & 1) {
      c.strokeStyle = dark(0.16);
      c.lineWidth = R * 0.18;
      [-0.4, 0.1, 0.55].forEach(function (yy) {
        c.beginPath();
        c.moveTo(x - R, y + R * yy);
        c.quadraticCurveTo(x, y + R * yy + R * 0.1, x + R, y + R * yy - R * 0.06);
        c.stroke();
      });
    } else {
      c.fillStyle = dark(0.2);
      for (var i = 0; i < 3; i++) {
        var a = (seed * (i + 3) * 1.7) % 6.28, cr = R * (0.35 + ((seed >> i) % 40) / 90);
        c.beginPath();
        c.arc(x + Math.cos(a) * cr, y + Math.sin(a) * cr, R * 0.13, 0, Math.PI * 2);
        c.fill();
      }
    }
    // night side
    var tg = c.createRadialGradient(x - R * 0.5, y - R * 0.5, R * 0.4, x - R * 0.5, y - R * 0.5, R * 2.1);
    tg.addColorStop(0, dark(0));
    tg.addColorStop(0.72, dark(0));
    tg.addColorStop(1, dark(0.55));
    c.fillStyle = tg;
    c.fillRect(x - R, y - R, R * 2, R * 2);
    c.restore();
    c.strokeStyle = 'rgba(220,230,240,0.22)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, R - 0.6, Math.PI * 0.8, Math.PI * 1.75); c.stroke();
    if (glyphType) {
      c.lineWidth = 1.6;
      CW.drawGlyph(c, glyphType, x, y, R * 0.55, 'outline', alphaCol(PARCH, 0.85));
    }
  }

  // a floating consignment: parchment chip, soft shadow, cargo glyph
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function chip(c, x, y, s, type, a) {
    c.save();
    c.globalAlpha = a;
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 4;
    c.shadowOffsetY = 2.5;
    c.fillStyle = mix(PARCH, '#8f8468', 0.18);
    rrect(c, x - s / 2, y - s / 2, s, s, 2.2); c.fill();
    c.shadowColor = 'transparent';
    var g = c.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
    g.addColorStop(0, alphaCol('#fff8e6', 0.5));
    g.addColorStop(1, alphaCol('#fff8e6', 0));
    c.fillStyle = g;
    rrect(c, x - s / 2, y - s / 2, s, s, 2.2); c.fill();
    CW.drawGlyph(c, type, x, y, s * 0.38, 'solid', dark(0.88));
    c.restore();
  }

  // ------------------------------------------------------------ card loop
  var cards = [];
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target._card.visible = e.isIntersecting; });
  }, { rootMargin: '80px' }) : null;

  function addCard(gridEl, plateKey, idx, no, name, sub, W, H, draw) {
    var el = document.createElement('div');
    el.className = 'card';
    var cv = document.createElement('canvas');
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.aspectRatio = W + ' / ' + H;
    el.appendChild(cv);
    var cap = document.createElement('div');
    cap.className = 'cap';
    cap.innerHTML = '<span class="no">No. ' + no + '</span><span class="nm">' + name + '</span>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '');
    el.appendChild(cap);
    var stamp = document.createElement('div');
    stamp.className = 'stamp';
    stamp.textContent = 'APPROVED';
    el.appendChild(stamp);
    gridEl.appendChild(el);

    var ctx = cv.getContext('2d');
    var card = { el: el, ctx: ctx, W: W, H: H, draw: draw, visible: !io, plate: plateKey, idx: idx };
    el._card = card;
    if (io) io.observe(el);
    el.addEventListener('click', function () { select(plateKey, idx); });
    cards.push(card);
    return card;
  }

  function frame(ms) {
    var t = ms / 1000;
    if (!document.hidden) {
      for (var i = 0; i < cards.length; i++) {
        var cd = cards[i];
        if (!cd.visible) continue;
        var c = cd.ctx;
        c.setTransform(DPR, 0, 0, DPR, 0, 0);
        cd.draw(c, cd.W, cd.H, t);
      }
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ controls
  function slider(parent, obj, key, label, min, max, step) {
    var row = document.createElement('label');
    row.className = 'pc-row';
    row.innerHTML = label + ' <input type="range" min="' + min + '" max="' + max +
      '" step="' + step + '" value="' + obj[key] + '"><span class="pc-val">' + obj[key] + '</span>';
    var inp = row.querySelector('input'), val = row.querySelector('.pc-val');
    inp.addEventListener('input', function () {
      obj[key] = parseFloat(inp.value);
      val.textContent = inp.value;
      persist();
      if (obj === typeS) applyTypeSettings();
    });
    parent.appendChild(row);
  }
  function swatches(parent, obj) {
    var box = document.createElement('div');
    box.className = 'pc-row';
    box.innerHTML = 'Paint ';
    var sw = document.createElement('div');
    sw.className = 'swatches';
    box.appendChild(sw);
    function mk(idx, el) {
      el.addEventListener('click', function () {
        obj.colour = idx;
        Array.prototype.forEach.call(sw.children, function (ch, i) {
          ch.classList.toggle('on', i === idx + 1);
        });
        persist();
      });
      if (obj.colour === idx) el.classList.add('on');
      sw.appendChild(el);
    }
    var vary = document.createElement('div');
    vary.className = 'swatch vary';
    vary.title = 'Vary — one paint per specimen';
    mk(-1, vary);
    COLS.forEach(function (hex, i) {
      var el = document.createElement('div');
      el.className = 'swatch';
      el.style.background = hex;
      el.title = CW.CORRIDOR_COLOURS[i].name;
      mk(i, el);
    });
    parent.appendChild(box);
  }
  function colFor(obj, idx) {
    return obj.colour >= 0 ? COLS[obj.colour] : COLS[idx % COLS.length];
  }

  // ================================================================
  // PLATE I — three corridors
  // ================================================================
  var corS = { weight: 1, glow: 1, alpha: 0.9, shimmer: 1, density: 1, colour: -1 };

  /* Each pattern draws a bidirectional channel. x = {c, P, col, t, S, seed}.
     Nothing may flow one way: animation is breathing, shimmer, twinkle. */
  var CORRIDORS = [
    ['Aurora Conduit', 'ionised ribbon · breathing glow', function (x) {
      var c = x.c, S = x.S, col = x.col, t = x.t;
      c.save();
      c.globalCompositeOperation = 'lighter';
      // layered translucent ribbon, width wandering slowly along and in time
      [[15, 0.05, 3.1], [8.5, 0.085, 7.7], [4.2, 0.13, 12.9]].forEach(function (L, li) {
        var breathe = 0.92 + 0.08 * Math.sin(t * 0.5 * S.shimmer + li * 1.7);
        ribbon(c, x.P, function (d) {
          var n = noise1(d * 0.016 + L[2] + t * 0.10 * S.shimmer);
          return (L[0] * (0.55 + 0.5 * n)) * S.weight * breathe + 0.4;
        }, mix(col, li === 2 ? PARCH : col, li === 2 ? 0.25 : 0), L[1] * S.glow);
      });
      // internal shimmer: slow alpha weather along the length, no travel
      for (var d = 0; d < x.P.len; d += 7) {
        var p0 = x.P.at(d), p1 = x.P.at(Math.min(x.P.len, d + 7.5));
        var a = 0.08 + 0.11 * noise1(d * 0.045 + t * 0.22 * S.shimmer);
        c.strokeStyle = alphaCol(mix(col, PARCH, 0.3), a);
        c.lineWidth = 1.7 * S.weight;
        c.lineCap = 'butt';
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      }
      // tiny stationary sparkles, each twinkling to its own clock
      var rnd = rngFor(x.seed * 3 + 11);
      var n = Math.round(16 * S.density);
      for (var i = 0; i < n; i++) {
        var dd = rnd() * x.P.len, off = (rnd() - 0.5) * 14 * S.weight;
        var ph = rnd() * 6.28, tw = 0.7 + rnd() * 1.3;
        var p = x.P.at(dd);
        var a2 = Math.pow(0.5 + 0.5 * Math.sin(t * tw * S.shimmer + ph), 3) * 0.8;
        var sx = p.x + p.nx * off, sy = p.y + p.ny * off;
        glowDot(c, sx, sy, 2.6, mix(col, PARCH, 0.5), a2 * 0.5);
        c.fillStyle = alphaCol('#fff6e0', a2);
        c.fillRect(sx - 0.5, sy - 0.5, 1, 1);
      }
      c.restore();
    }],

    ['Twin Rail Beacon Line', 'luminous rails · brass locator studs', function (x) {
      var c = x.c, S = x.S, col = x.col, t = x.t;
      c.save();
      c.globalCompositeOperation = 'lighter';
      strokePts(c, x.P.pts, col, 15 * S.weight, 0.045 * S.glow); // ambient field
      c.restore();
      // the dark channel between the rails
      strokePts(c, x.P.pts, INK, 3.4 * S.weight, 0.55);
      // each rail: soft under-glow, then a core laid in short spans so
      // individual lengths can flicker like gas mantles
      [2.6, -2.6].forEach(function (o, ri) {
        var railPts = offset(x.P.pts, o * S.weight);
        var railP = makePath(railPts);
        c.save();
        c.globalCompositeOperation = 'lighter';
        strokePts(c, railPts, col, 3.4 * S.weight, 0.16 * S.glow);
        c.restore();
        var span = 9;
        for (var i = 0; i * span < railP.len; i++) {
          var d0 = i * span, d1 = Math.min(railP.len, d0 + span + 0.6);
          var h = hash1(i * 13.7 + ri * 99 + Math.floor(t * 2.4 * S.shimmer) * 0.618);
          var a = 0.82;
          if (h > 0.955) a = 0.4;             // a mantle dims
          else if (h < 0.035) a = 1;          // a mantle surges
          var p0 = railP.at(d0), p1 = railP.at(d1);
          c.strokeStyle = alphaCol(mix(col, PARCH, 0.22), a);
          c.lineWidth = 1.15 * S.weight;
          c.lineCap = 'butt';
          c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
        }
      });
      // brass locator studs down the centre of the channel
      var sp = 32 / S.density;
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (var d = sp * 0.5; d < x.P.len; d += sp) {
        var p = x.P.at(d);
        glowDot(c, p.x, p.y, 3.2, BRASS, 0.20 * S.glow);
        c.fillStyle = alphaCol(mix(BRASS, '#fff2c8', 0.35), 0.85);
        c.beginPath(); c.arc(p.x, p.y, 0.95 * S.weight, 0, 6.29); c.fill();
      }
      c.restore();
    }],

    ['Starwake Thread', 'celestial hairline · luminous pearls', function (x) {
      var c = x.c, S = x.S, col = x.col, t = x.t;
      strokePts(c, x.P.pts, col, 0.7 * S.weight, 0.32); // the survey line itself
      var rnd = rngFor(x.seed * 7 + 5);
      var sp = 26 / S.density;
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (var d = sp * 0.5; d < x.P.len; d += sp) {
        var jitter = (rnd() - 0.5) * 8;
        var ph = rnd() * 6.28;
        var p = x.P.at(Math.max(0, Math.min(x.P.len, d + jitter)));
        var breathe = 0.75 + 0.25 * Math.sin(t * 1.25 * S.shimmer + ph);
        glowDot(c, p.x, p.y, 3.4 * S.weight, col, 0.14 * S.glow * breathe);
        c.fillStyle = alphaCol(mix(col, PARCH, 0.45), 0.85 * breathe);
        c.beginPath(); c.arc(p.x, p.y, 1.05 * S.weight, 0, 6.29); c.fill();
        // the rare lens bloom: a pearl catches the light
        var tw = Math.pow(Math.max(0, Math.sin(t * 0.29 * S.shimmer + ph * 9)), 14);
        if (tw > 0.02) {
          var ray = (4 + 9 * tw) * S.weight;
          c.strokeStyle = alphaCol(mix(col, '#fff6e0', 0.6), tw * 0.8);
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(p.x - ray, p.y); c.lineTo(p.x + ray, p.y);
          c.moveTo(p.x, p.y - ray); c.lineTo(p.x, p.y + ray);
          c.stroke();
          glowDot(c, p.x, p.y, 6 * tw + 2, col, 0.3 * tw);
        }
      }
      c.restore();
    }],
  ];

  // a small vessel under way, drawn softly enough to sit in the scene
  function serviceVessel(c, p, dir, col, t, ph) {
    var ang = Math.atan2(p.dy * dir, p.dx * dir);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    c.save();
    c.globalCompositeOperation = 'lighter';
    glowDot(c, -9, 0, 5, WARM, 0.28 + 0.1 * Math.sin(t * 13 + ph)); // engine
    c.restore();
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 3;
    c.shadowOffsetY = 2;
    var g = c.createLinearGradient(-8, -3, 8, 3);
    g.addColorStop(0, mix(mix(col, '#48505e', 0.55), '#dfe8f2', 0.25));
    g.addColorStop(1, mix(mix(col, '#48505e', 0.55), '#05070b', 0.4));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(9, 0);
    c.quadraticCurveTo(2, -3.2, -7.5, -1.6);
    c.quadraticCurveTo(-9.5, 0, -7.5, 1.6);
    c.quadraticCurveTo(2, 3.2, 9, 0);
    c.closePath();
    c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = alphaCol(BRASS, 0.4);
    c.lineWidth = 0.6;
    c.stroke();
    c.fillStyle = alphaCol(WARM, 0.9);
    c.beginPath(); c.arc(5.5, 0, 0.9, 0, 6.29); c.fill();
    c.restore();
  }

  function buildCorridorPlate() {
    var grid = document.getElementById('grid-cor');
    var W = 760, H = 210;
    CORRIDORS.forEach(function (def, i) {
      var seed = 100 + i;
      var rnd0 = rngFor(seed);
      var stars = makeStars(rnd0, 80, W, H);
      var blobs = [
        [W * (0.28 + rnd0() * 0.2), H * 0.28, 80 + rnd0() * 30, 268],
        [W * (0.62 + rnd0() * 0.2), H * 0.8, 70 + rnd0() * 30, 322],
      ];
      var pA = { x: 58, y: 155, r: 17 }, pB = { x: 702, y: 118, r: 13 };
      var P = makeCurve({ x: 82, y: 147 }, { x: 390, y: 42 }, { x: 682, y: 116 }, 70);

      addCard(grid, 'cor', i, i + 1, def[0], def[1], W, H, function (c, w, h, t) {
        c.fillStyle = INK; c.fillRect(0, 0, w, h);
        drawStars(c, stars, t);
        nebulaWash(c, blobs, t, 0.55);
        c.save();
        c.globalAlpha = corS.alpha;
        def[2]({ c: c, P: P, col: colFor(corS, i), t: t, S: corS, seed: seed });
        c.restore();
        paintPlanet(c, pA.x, pA.y, pA.r, TINTS[i % 8], seed, 'water');
        paintPlanet(c, pB.x, pB.y, pB.r, TINTS[(i + 3) % 8], seed + 7, 'energy');
        // two vessels in service, one each way — the channel works both directions
        var col = colFor(corS, i);
        var dOut = (t * 17 + i * 60) % P.len;
        var dHome = P.len - ((t * 14 + i * 130 + 90) % P.len);
        var pOut = P.at(dOut), pHome = P.at(dHome);
        serviceVessel(c, { x: pOut.x + pOut.nx * 3.4, y: pOut.y + pOut.ny * 3.4, dx: pOut.dx, dy: pOut.dy }, 1, col, t, i);
        serviceVessel(c, { x: pHome.x - pHome.nx * 3.4, y: pHome.y - pHome.ny * 3.4, dx: pHome.dx, dy: pHome.dy }, -1, col, t, i + 3);
        vignette(c, w, h);
      });
    });
  }

  // ================================================================
  // PLATE II — three vessels
  // ================================================================
  var shipS = { scale: 1, orbit: 1, pace: 1, crate: 1, ring: 0.35, livery: 0.45, exhaust: 1, colour: -1 };
  var SHIP_CARGO = ['water', 'minerals', 'machinery', 'medicine', 'energy'];
  var POD_CARGO = ['food', 'luxuries', 'biology'];

  function hullTone(col) { return mix('#454e5c', col, shipS.livery); }
  function litGrad(c, base, x0, y0, x1, y1) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, mix(base, '#dfe8f2', 0.30));
    g.addColorStop(0.5, base);
    g.addColorStop(1, mix(base, '#05070b', 0.45));
    return g;
  }
  function deckLamps(c, xs, y, t) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    xs.forEach(function (lx, i) {
      var a = 0.55 + 0.2 * Math.sin(t * 2 + i * 1.9);
      glowDot(c, lx, y, 2.6, WARM, a * 0.35);
      c.fillStyle = alphaCol('#fff3d6', a);
      c.fillRect(lx - 0.6, y - 0.6, 1.2, 1.2);
    });
    c.restore();
  }
  function dome(c, x, y, r) { // a small glass observatory, lit from within
    var g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, alphaCol('#eef4ff', 0.85));
    g.addColorStop(0.6, alphaCol('#9fb4d0', 0.55));
    g.addColorStop(1, alphaCol('#3a4658', 0.85));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 6.29); c.fill();
    c.strokeStyle = alphaCol(BRASS, 0.6);
    c.lineWidth = 0.8;
    c.beginPath(); c.arc(x, y, r, 0, 6.29); c.stroke();
    c.beginPath(); c.arc(x, y, r, -Math.PI * 0.9, Math.PI * 0.1); c.stroke();
    c.save();
    c.globalCompositeOperation = 'lighter';
    glowDot(c, x, y, r * 2.2, WARM, 0.12);
    c.restore();
  }
  function engineGlow(c, x, y, t, strength, col) {
    if (strength <= 0) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    var f = 0.8 + 0.2 * Math.sin(t * 17) * Math.sin(t * 7.3);
    glowDot(c, x, y, 9 * strength, WARM, 0.30 * strength * f);
    glowDot(c, x - 7 * strength, y, 16 * strength, mix(col, WARM, 0.5), 0.10 * strength * f);
    c.fillStyle = alphaCol('#fff3d6', 0.85 * f);
    c.beginPath(); c.arc(x, y, 1.4, 0, 6.29); c.fill();
    c.restore();
  }

  /* Vessel painters: origin amidships, bow toward +x, L×W the envelope. */
  var SHIPS = [
    ['Clipper', 'long exploration steamer', function (c, L, W, col, t) {
      var base = hullTone(col);
      engineGlow(c, -L * 0.52, 0, t, shipS.exhaust, col);
      function hull() {
        c.beginPath();
        c.moveTo(L * 0.55, 0);                                   // raked bow
        c.bezierCurveTo(L * 0.28, -W * 0.34, -L * 0.18, -W * 0.30, -L * 0.44, -W * 0.16);
        c.quadraticCurveTo(-L * 0.53, 0, -L * 0.44, W * 0.16);   // rounded counter stern
        c.bezierCurveTo(-L * 0.18, W * 0.30, L * 0.28, W * 0.34, L * 0.55, 0);
        c.closePath();
      }
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 9;
      c.shadowOffsetX = 2; c.shadowOffsetY = 5;
      c.fillStyle = litGrad(c, base, -L * 0.2, -W * 0.5, L * 0.2, W * 0.5);
      hull(); c.fill();
      c.restore();
      c.strokeStyle = alphaCol(BRASS, 0.45);                     // brass gunwale
      c.lineWidth = 0.9;
      hull(); c.stroke();
      // skylight spine glowing gently down the centreline
      c.save();
      c.globalCompositeOperation = 'lighter';
      var sg = c.createLinearGradient(-L * 0.4, 0, L * 0.42, 0);
      sg.addColorStop(0, alphaCol(WARM, 0));
      sg.addColorStop(0.5, alphaCol(WARM, 0.30));
      sg.addColorStop(1, alphaCol(WARM, 0));
      c.strokeStyle = sg;
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-L * 0.4, 0); c.lineTo(L * 0.42, 0); c.stroke();
      c.restore();
      // deck lamps along both rails
      var xs = [];
      for (var i = 0; i < 5; i++) xs.push(-L * 0.3 + i * L * 0.16);
      deckLamps(c, xs, -W * 0.18, t);
      deckLamps(c, xs, W * 0.18, t + 0.7);
      dome(c, -L * 0.12, -W * 0.04, W * 0.15);                   // chart-room dome, a touch off-centre
      c.fillStyle = alphaCol(PARCH, 0.75);                       // bow light
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, L * 0.5, 0, 4, col, 0.35);
      c.restore();
      c.beginPath(); c.arc(L * 0.5, 0, 1.1, 0, 6.29); c.fill();
    }],

    ['Packet', 'chunky workhorse freighter', function (c, L, W, col, t) {
      var base = hullTone(col);
      engineGlow(c, -L * 0.46, -W * 0.14, t, shipS.exhaust * 0.8, col);
      engineGlow(c, -L * 0.46, W * 0.14, t + 0.4, shipS.exhaust * 0.8, col);
      function hull() {
        c.beginPath();
        c.moveTo(L * 0.30, -W * 0.40);
        c.quadraticCurveTo(L * 0.52, -W * 0.34, L * 0.52, 0);    // bluff bow
        c.quadraticCurveTo(L * 0.52, W * 0.34, L * 0.30, W * 0.40);
        c.lineTo(-L * 0.38, W * 0.40);
        c.quadraticCurveTo(-L * 0.46, W * 0.36, -L * 0.46, 0);
        c.quadraticCurveTo(-L * 0.46, -W * 0.36, -L * 0.38, -W * 0.40);
        c.closePath();
      }
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 9;
      c.shadowOffsetX = 2; c.shadowOffsetY = 5;
      c.fillStyle = litGrad(c, base, -L * 0.15, -W * 0.55, L * 0.15, W * 0.55);
      hull(); c.fill();
      c.restore();
      c.strokeStyle = alphaCol(BRASS, 0.4);
      c.lineWidth = 0.9;
      hull(); c.stroke();
      // rubbing strakes along the sides
      c.strokeStyle = alphaCol(mix(base, '#05070b', 0.4), 0.8);
      c.lineWidth = 1.3;
      [-0.31, 0.31].forEach(function (yy) {
        c.beginPath();
        c.moveTo(L * 0.36, W * yy);
        c.lineTo(-L * 0.4, W * yy);
        c.stroke();
      });
      // recessed hold with two hatches
      c.fillStyle = dark(0.42);
      rrect(c, -L * 0.28, -W * 0.22, L * 0.5, W * 0.44, 2.5); c.fill();
      c.strokeStyle = alphaCol(PARCH, 0.2);
      c.lineWidth = 0.7;
      [-L * 0.24, 0].forEach(function (hx) {
        rrect(c, hx, -W * 0.16, L * 0.2, W * 0.32, 1.6); c.stroke();
      });
      // engine house astern
      c.fillStyle = mix(base, '#05070b', 0.3);
      rrect(c, -L * 0.44, -W * 0.24, L * 0.13, W * 0.48, 2); c.fill();
      c.strokeStyle = alphaCol(BRASS, 0.3);
      rrect(c, -L * 0.44, -W * 0.24, L * 0.13, W * 0.48, 2); c.stroke();
      // foremast with a working lamp
      c.strokeStyle = alphaCol(PARCH, 0.45);
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(L * 0.36, 0); c.lineTo(L * 0.44, 0); c.stroke();
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, L * 0.44, 0, 3.5, WARM, 0.4 + 0.15 * Math.sin(t * 1.7));
      c.restore();
      deckLamps(c, [-L * 0.33, L * 0.3], 0, t);
    }],

    ['Pilgrim', 'asymmetric survey vessel', function (c, L, W, col, t) {
      var base = hullTone(col);
      engineGlow(c, -L * 0.5, W * 0.06, t, shipS.exhaust, col);
      function hull() { // fuller to port, leaner to starboard: built around the observatory
        c.beginPath();
        c.moveTo(L * 0.54, W * 0.02);
        c.bezierCurveTo(L * 0.26, -W * 0.40, -L * 0.14, -W * 0.42, -L * 0.40, -W * 0.18);
        c.quadraticCurveTo(-L * 0.5, W * 0.0, -L * 0.4, W * 0.14);
        c.bezierCurveTo(-L * 0.12, W * 0.27, L * 0.26, W * 0.20, L * 0.54, W * 0.02);
        c.closePath();
      }
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 9;
      c.shadowOffsetX = 2; c.shadowOffsetY = 5;
      c.fillStyle = litGrad(c, base, -L * 0.2, -W * 0.5, L * 0.2, W * 0.5);
      hull(); c.fill();
      c.restore();
      c.strokeStyle = alphaCol(BRASS, 0.45);
      c.lineWidth = 0.9;
      hull(); c.stroke();
      // the observatory itself, set to port
      dome(c, -L * 0.06, -W * 0.13, W * 0.21);
      // meridian ring around the dome
      c.strokeStyle = alphaCol(BRASS, 0.5);
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(-L * 0.06, -W * 0.13, W * 0.3, W * 0.1, -0.4, 0, 6.29);
      c.stroke();
      // instrument boom to starboard with its sounding pod
      var bx = L * 0.1, by = W * 0.24, px = L * 0.2, py = W * 0.55;
      c.strokeStyle = alphaCol(BRASS, 0.6);
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(px, py); c.stroke();
      c.fillStyle = litGrad(c, mix(base, '#05070b', 0.15), px - 3, py - 3, px + 3, py + 3);
      c.beginPath(); c.arc(px, py, W * 0.095, 0, 6.29); c.fill();
      c.strokeStyle = alphaCol(BRASS, 0.5);
      c.lineWidth = 0.7;
      c.beginPath(); c.arc(px, py, W * 0.095, 0, 6.29); c.stroke();
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, px, py, 3, col, 0.35 + 0.25 * Math.sin(t * 2.6));
      c.restore();
      // survey lamp at the bow, in the corridor's colour
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, L * 0.5, W * 0.02, 5, col, 0.4);
      c.restore();
      c.fillStyle = alphaCol(PARCH, 0.8);
      c.beginPath(); c.arc(L * 0.5, W * 0.02, 1.1, 0, 6.29); c.fill();
      deckLamps(c, [-L * 0.3, -L * 0.05, L * 0.24], W * 0.1, t);
    }],
  ];

  function orbitPositions(n, cx, cy, R, t, pace, ph0) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var ph = t * 0.8 * pace + ph0 + i * Math.PI * 2 / n;
      out.push({
        x: cx + Math.cos(ph) * R, y: cy + Math.sin(ph) * R * 0.34,
        depth: Math.sin(ph), scale: 0.82 + 0.24 * Math.max(0, Math.sin(ph)),
      });
    }
    return out;
  }
  function orbitRing(c, cx, cy, R, col) {
    if (shipS.ring <= 0.02) return;
    c.save();
    c.setLineDash([2, 4.5]);
    c.strokeStyle = alphaCol(col, 0.35 * shipS.ring);
    c.lineWidth = 0.8;
    c.beginPath();
    c.ellipse(cx, cy, R, R * 0.34, 0, 0, 6.29);
    c.stroke();
    c.restore();
  }

  function buildShipPlate() {
    var grid = document.getElementById('grid-ship');
    var W = 420, H = 235;
    SHIPS.forEach(function (def, i) {
      var seed = 500 + i;
      var rnd0 = rngFor(seed);
      var stars = makeStars(rnd0, 55, W, H);
      var blobs = [[W * (0.15 + rnd0() * 0.6), H * (rnd0() < 0.5 ? 0.15 : 0.9), 70 + rnd0() * 30, rnd0() < 0.5 ? 268 : 322]];

      addCard(grid, 'ship', i, i + 1, def[0], def[1], W, H, function (c, w, h, t) {
        c.fillStyle = INK; c.fillRect(0, 0, w, h);
        drawStars(c, stars, t);
        nebulaWash(c, blobs, t, 0.4);
        paintPlanet(c, w - 52, 42, 10, TINTS[(i + 5) % 8], seed + 3);
        var col = colFor(shipS, i);
        var cy = h * 0.54;
        [2.4, -2.4].forEach(function (o) {   // the corridor it serves, faintly
          c.strokeStyle = alphaCol(col, 0.10);
          c.lineWidth = 0.9;
          c.beginPath(); c.moveTo(0, cy + o); c.lineTo(w, cy + o); c.stroke();
        });

        var sc = shipS.scale;
        var L = 112 * sc, Wd = 36 * sc;
        var R = 50 * sc * shipS.orbit;
        // on station under easy steam: she stays in frame, drifting a little
        var cx = w * 0.58 + Math.sin(t * 0.14 + i * 2.1) * 26;

        // pod barge astern, with its own small orbit
        var podX = cx - (L * 0.78 + 40 * sc);
        var podL = L * 0.42, podW = Wd * 0.5, podR = R * 0.5;
        c.strokeStyle = alphaCol(BRASS, 0.4);                    // tow line, sagging slightly
        c.lineWidth = 0.9;
        c.beginPath();
        c.moveTo(cx - L * 0.48, cy);
        c.quadraticCurveTo((cx - L * 0.48 + podX) / 2, cy + 4, podX + podL * 0.5, cy);
        c.stroke();
        var podOrbit = orbitPositions(3, podX, cy, podR, t * 1.2, shipS.pace, 2.1);
        orbitRing(c, podX, cy, podR, col);
        podOrbit.forEach(function (p, k) {
          if (p.depth < 0) chip(c, p.x, p.y, 8 * shipS.crate * p.scale, POD_CARGO[k], 0.6);
        });
        c.save();
        c.translate(podX, cy);
        def[2](c, podL, podW, col, t + 3);
        c.restore();
        podOrbit.forEach(function (p, k) {
          if (p.depth >= 0) chip(c, p.x, p.y, 8 * shipS.crate * p.scale, POD_CARGO[k], 0.95);
        });

        // the vessel with her lading in open orbit
        var pos = orbitPositions(5, cx, cy, R, t, shipS.pace, 0);
        orbitRing(c, cx, cy, R, col);
        pos.forEach(function (p, k) {
          if (p.depth < 0) chip(c, p.x, p.y, 10 * shipS.crate * p.scale, SHIP_CARGO[k], 0.6);
        });
        c.save();
        c.translate(cx, cy);
        def[2](c, L, Wd, col, t);
        c.restore();
        pos.forEach(function (p, k) {
          if (p.depth >= 0) chip(c, p.x, p.y, 10 * shipS.crate * p.scale, SHIP_CARGO[k], 0.95);
        });
        vignette(c, w, h);
      });
    });
  }

  // ================================================================
  // PLATE III — three relay beacons
  // ================================================================
  var relS = { scale: 1, rate: 1, bright: 1, nebula: 1, colour: -1 };

  var RELAYS = [
    ['Lighthouse', 'rotating lens · brass framework', function (c, col, t, S) {
      var B = S.bright;
      // the great halo, breathing into the weather
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, 0, -14, 62, col, 0.10 * B * (1 + 0.12 * Math.sin(t * 0.6)));
      // twin rotating beams
      var a0 = t * 0.55;
      [0, Math.PI].forEach(function (o) {
        var a = a0 + o, reach = 95;
        var ex = Math.cos(a) * reach, ey = -14 + Math.sin(a) * reach * 0.5;
        var g = c.createLinearGradient(0, -14, ex, ey);
        g.addColorStop(0, alphaCol(col, 0.30 * B));
        g.addColorStop(1, alphaCol(col, 0));
        c.fillStyle = g;
        var half = 0.13;
        c.beginPath();
        c.moveTo(0, -14);
        c.lineTo(Math.cos(a - half) * reach, -14 + Math.sin(a - half) * reach * 0.5);
        c.lineTo(Math.cos(a + half) * reach, -14 + Math.sin(a + half) * reach * 0.5);
        c.closePath();
        c.fill();
      });
      // a glint as the beam sweeps past the observer
      var glint = Math.pow(Math.abs(Math.cos(a0)), 30);
      if (glint > 0.02) {
        c.strokeStyle = alphaCol('#fff6e0', glint * 0.8 * B);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-18 * glint - 4, -14); c.lineTo(18 * glint + 4, -14);
        c.moveTo(0, -14 - 14 * glint - 3); c.lineTo(0, -14 + 14 * glint + 3);
        c.stroke();
      }
      c.restore();
      // the tower: tapering brass lattice on a stone base
      c.strokeStyle = alphaCol(BRASS, 0.8);
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(-8, 22); c.lineTo(-3.4, -8); c.stroke();
      c.beginPath(); c.moveTo(8, 22); c.lineTo(3.4, -8); c.stroke();
      c.lineWidth = 0.7;
      [[22, -8, 12.4], [12.4, -8, 3.2], [3.2, -8, -5.4]].forEach(function (row) {
        var y0 = row[0], y1 = row[2];
        var w0 = 8 - (22 - y0) / 30 * 4.6, w1 = 8 - (22 - y1) / 30 * 4.6;
        c.beginPath(); c.moveTo(-w0, y0); c.lineTo(w1, y1); c.stroke();
        c.beginPath(); c.moveTo(w0, y0); c.lineTo(-w1, y1); c.stroke();
      });
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-5.4, -8); c.lineTo(5.4, -8); c.stroke();     // gallery
      c.fillStyle = mix('#2a3140', BRASS, 0.15);                            // plinth
      c.beginPath(); c.ellipse(0, 22, 10.5, 3, 0, 0, 6.29); c.fill();
      c.strokeStyle = alphaCol(BRASS, 0.5);
      c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(0, 22, 10.5, 3, 0, 0, 6.29); c.stroke();
      // the lens: warm heart in a coloured mantle
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, 0, -14, 9, col, 0.55 * B);
      glowDot(c, 0, -14, 3.4, '#fff6e0', 0.9 * B);
      c.restore();
      c.strokeStyle = alphaCol(BRASS, 0.9);                                 // lens cage
      c.lineWidth = 0.9;
      c.strokeRect(-2.6, -17.6, 5.2, 6.4);
    }],

    ['Orrery', 'calibration rings · slow orbits', function (c, col, t, S) {
      var B = S.bright;
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, 0, 0, 40, col, 0.10 * B * (1 + 0.1 * Math.sin(t * 0.5)));
      glowDot(c, 0, 0, 11, col, 0.4 * B);
      glowDot(c, 0, 0, 3.2, '#fff6e0', 0.95 * B);
      c.restore();
      // outer calibration arcs, engraved and still
      c.save();
      c.setLineDash([2, 5.5]);
      c.strokeStyle = alphaCol(BRASS, 0.3);
      c.lineWidth = 0.8;
      c.beginPath(); c.arc(0, 0, 44, -0.5, 1.2); c.stroke();
      c.beginPath(); c.arc(0, 0, 44, Math.PI - 0.4, Math.PI + 1.1); c.stroke();
      c.restore();
      // three floating rings, each keeping its own slow time
      [[30, 0.34, 0.22, 0.3], [21, 0.52, -0.31, 1.8], [38, 0.2, 0.12, 3.6]].forEach(function (ring, i) {
        var rx = ring[0], squash = ring[1], rot = t * ring[2] + ring[3];
        c.save();
        c.rotate(Math.sin(rot * 0.7) * 0.25);
        c.strokeStyle = alphaCol(BRASS, 0.62);
        c.lineWidth = 1.05;
        c.beginPath(); c.ellipse(0, 0, rx, rx * squash, 0, 0, 6.29); c.stroke();
        // the ring's attendant bead, in the corridor's colour
        var ba = rot * 2.2;
        var bx = Math.cos(ba) * rx, by = Math.sin(ba) * rx * squash;
        c.save();
        c.globalCompositeOperation = 'lighter';
        glowDot(c, bx, by, 4.5, col, 0.35 * B);
        c.restore();
        c.fillStyle = alphaCol(mix(col, PARCH, 0.4), 0.9);
        c.beginPath(); c.arc(bx, by, 1.2, 0, 6.29); c.fill();
        c.restore();
      });
    }],

    ['Harbour Buoy', 'occulting lamp · patient station-keeping', function (c, col, t, S) {
      var B = S.bright;
      c.save();
      c.rotate(Math.sin(t * 0.45) * 0.05);                       // slow sway
      c.translate(0, Math.sin(t * 0.8) * 2.2);                   // gentle bob
      // float halo settling into the weather below
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, 0, 20, 26, col, 0.07 * B);
      c.restore();
      // the mast and its crosstree
      var mg = c.createLinearGradient(0, -26, 0, 20);
      mg.addColorStop(0, alphaCol(mix(BRASS, '#fff2c8', 0.3), 0.9));
      mg.addColorStop(1, alphaCol(mix(BRASS, '#4a3f22', 0.5), 0.8));
      c.strokeStyle = mg;
      c.lineWidth = 1.7;
      c.beginPath(); c.moveTo(0, 18); c.lineTo(0, -24); c.stroke();
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-4.5, -15); c.lineTo(4.5, -15); c.stroke();
      // stabilising fins and the counterweight below
      c.strokeStyle = alphaCol(BRASS, 0.7);
      c.lineWidth = 1.2;
      [[-7, 21], [0, 23], [7, 21]].forEach(function (f) {
        c.beginPath(); c.moveTo(0, 14); c.lineTo(f[0], f[1]); c.stroke();
      });
      c.fillStyle = mix('#2a3140', BRASS, 0.2);
      c.beginPath(); c.arc(0, 20, 3.2, 0, 6.29); c.fill();
      c.strokeStyle = alphaCol(BRASS, 0.6);
      c.lineWidth = 0.8;
      c.beginPath(); c.arc(0, 20, 3.2, 0, 6.29); c.stroke();
      // the lamp: a proper occulting light — long on, brief dark
      var u = (t * 0.45 * S.rate) % 1;
      function smooth(e0, e1, v) {
        var x = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
        return x * x * (3 - 2 * x);
      }
      var lit = 0.18 + 0.82 * Math.min(smooth(0, 0.06, u), 1 - smooth(0.72, 0.8, u));
      c.save();
      c.globalCompositeOperation = 'lighter';
      glowDot(c, 0, -28, 17, col, 0.35 * lit * B);
      glowDot(c, 0, -28, 6, col, 0.5 * lit * B);
      glowDot(c, 0, -28, 2, '#fff6e0', 0.95 * lit * B);
      c.restore();
      // lamp cage
      c.strokeStyle = alphaCol(BRASS, 0.85);
      c.lineWidth = 0.9;
      c.strokeRect(-2.4, -31, 4.8, 5.6);
      c.beginPath(); c.moveTo(-2.4, -31); c.lineTo(0, -33.5); c.lineTo(2.4, -31); c.stroke();
      c.restore();
    }],
  ];

  function buildRelayPlate() {
    var grid = document.getElementById('grid-relay');
    var W = 420, H = 240;
    RELAYS.forEach(function (def, i) {
      var seed = 900 + i;
      var rnd0 = rngFor(seed);
      var stars = makeStars(rnd0, 45, W, H);
      var blobs = [];
      for (var b = 0; b < 4; b++) {
        blobs.push([W / 2 + (rnd0() - 0.5) * 200, H / 2 + (rnd0() - 0.5) * 90,
          55 + rnd0() * 40, b === 3 ? 322 : 268]);
      }
      addCard(grid, 'relay', i, i + 1, def[0], def[1], W, H, function (c, w, h, t) {
        c.fillStyle = INK; c.fillRect(0, 0, w, h);
        drawStars(c, stars, t);
        nebulaWash(c, blobs, t, relS.nebula);
        var col = colFor(relS, i);
        // the corridor on its way through the weather
        c.strokeStyle = alphaCol(col, 0.22);
        c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(0, h * 0.56); c.lineTo(w, h * 0.5); c.stroke();
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (var d = 20; d < w; d += 46) {
          glowDot(c, d, h * 0.56 - d / w * h * 0.06, 2.4, col, 0.18);
        }
        c.restore();
        c.save();
        c.translate(w / 2, h * 0.5);
        c.scale(relS.scale * 1.35, relS.scale * 1.35);
        def[2](c, col, t * (0.6 + 0.4 * relS.rate), relS);
        c.restore();
        vignette(c, w, h);
      });
    });
  }

  // ================================================================
  // PLATE IV — letterforms (carried over from the first edition)
  // ================================================================
  var typeS = { track: 0.18, body: 12 };

  var FONTS = [
    ['The Factory', 'Iowan Old Style', '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif',
      'System sans', 'ui-sans-serif,system-ui,"Helvetica Neue",Arial,sans-serif'],
    ['The Ledger', 'Georgia', 'Georgia,"Times New Roman",serif', 'Verdana', 'Verdana,Geneva,sans-serif'],
    ['The Gazette', 'Didot', 'Didot,"Didot LT STD","Bodoni MT",Georgia,serif',
      'Gill Sans', '"Gill Sans","Gill Sans MT",Calibri,sans-serif'],
    ['The Admiralty', 'Baskerville', 'Baskerville,"Baskerville Old Face",Georgia,serif',
      'Optima', 'Optima,Candara,"Segoe UI",sans-serif'],
    ['The Counting-House', 'Hoefler Text', '"Hoefler Text","Book Antiqua",Georgia,serif',
      'Avenir Next', '"Avenir Next",Avenir,"Segoe UI",sans-serif'],
    ['The Registry', 'Palatino', '"Palatino Linotype",Palatino,"Book Antiqua",serif',
      'Segoe UI', '"Segoe UI","Helvetica Neue",sans-serif'],
    ['The Chronicle', 'Times New Roman', '"Times New Roman",Times,serif',
      'Trebuchet MS', '"Trebuchet MS",Tahoma,sans-serif'],
    ['The Bureau', 'Cambria', 'Cambria,Georgia,serif', 'Calibri', 'Calibri,"Segoe UI",sans-serif'],
    ['The Almanac', 'Constantia', 'Constantia,Cambria,Georgia,serif', 'Corbel', 'Corbel,Candara,sans-serif'],
    ['The Foundry', 'Rockwell', 'Rockwell,"Rockwell Nova","Courier Bold",serif',
      'Helvetica Neue', '"Helvetica Neue",Helvetica,Arial,sans-serif'],
    ['The Engraver', 'Copperplate', 'Copperplate,"Copperplate Gothic Light",serif',
      'Palatino', '"Palatino Linotype",Palatino,serif'],
    ['The Observatory', 'Big Caslon', '"Big Caslon","Book Antiqua",Georgia,serif',
      'Seravek', 'Seravek,"Segoe UI",Verdana,sans-serif'],
    ['The Patent Office', 'Garamond', 'Garamond,"EB Garamond","Apple Garamond",Georgia,serif',
      'Tahoma', 'Tahoma,Verdana,sans-serif'],
    ['The Telegraph', 'Georgia', 'Georgia,serif', 'Courier New', '"Courier New",Courier,monospace'],
    ['The Typing Pool', 'Courier New', '"Courier New",Courier,monospace',
      'Courier New', '"Courier New",Courier,monospace'],
    ['The Modern Line', 'Didot', 'Didot,"Bodoni MT","Bodoni 72",Georgia,serif',
      'Helvetica Neue', '"Helvetica Neue",Helvetica,Arial,sans-serif'],
    ['The Institute', 'Optima', 'Optima,Candara,"Gill Sans",sans-serif',
      'Optima', 'Optima,Candara,"Gill Sans",sans-serif'],
    ['The Draughtsman', 'Futura', 'Futura,"Century Gothic","Trebuchet MS",sans-serif',
      'Georgia', 'Georgia,serif'],
    ['The Signal Room', 'Consolas', 'Consolas,Menlo,"Courier New",monospace',
      'Segoe UI', '"Segoe UI","Helvetica Neue",sans-serif'],
    ['The Directors', 'Bodoni 72', '"Bodoni 72","Bodoni MT",Didot,Georgia,serif',
      'Century Gothic', '"Century Gothic",Futura,sans-serif'],
    ['The Old Firm', 'Book Antiqua', '"Book Antiqua","Palatino Linotype",Palatino,serif',
      'Book Antiqua', '"Book Antiqua","Palatino Linotype",Palatino,serif'],
    ['The Librarian', 'Sitka Heading', '"Sitka Heading",Constantia,Georgia,serif',
      'Sitka Text', '"Sitka Text",Constantia,Georgia,serif'],
    ['The Charterhouse', 'Charter', 'Charter,"Bitstream Charter",Cambria,serif',
      'Lucida Grande', '"Lucida Grande","Lucida Sans Unicode",Verdana,sans-serif'],
    ['The Governess', 'Baskerville Old Face', '"Baskerville Old Face",Baskerville,Georgia,serif',
      'Candara', 'Candara,Optima,"Segoe UI",sans-serif'],
    ['The Iron Works', 'Franklin Gothic Medium', '"Franklin Gothic Medium","Arial Narrow",Arial,sans-serif',
      'Franklin Gothic Book', '"Franklin Gothic Book","Segoe UI",Arial,sans-serif'],
    ['The Permanent Way', 'Gill Sans', '"Gill Sans","Gill Sans MT",Calibri,sans-serif',
      'Gill Sans', '"Gill Sans","Gill Sans MT",Calibri,sans-serif'],
    ['The Nightwatch', 'Menlo', 'Menlo,Consolas,"DejaVu Sans Mono",monospace',
      'Avenir Next', '"Avenir Next",Avenir,"Segoe UI",sans-serif'],
    ['The Correspondence', 'Perpetua', 'Perpetua,"Iowan Old Style",Georgia,serif',
      'Segoe UI', '"Segoe UI","Helvetica Neue",sans-serif'],
    ['The Empire Line', 'Cochin', 'Cochin,"Hoefler Text",Georgia,serif', 'Verdana', 'Verdana,Geneva,sans-serif'],
    ['The Astronomer Royal', 'Hoefler Text', '"Hoefler Text",Baskerville,Georgia,serif',
      'Menlo', 'Menlo,Consolas,"Courier New",monospace'],
  ];

  /* document.fonts.check() answers "yes" for fontconfig aliases, so we
     measure instead: a family is present if it sizes text differently
     from both generic fallbacks. */
  var fontCtx = document.createElement('canvas').getContext('2d');
  function fontAvailable(name) {
    try {
      var probe = 'mmMMILliwW10&';
      var differs = false;
      ['monospace', 'sans-serif', 'serif'].forEach(function (generic) {
        fontCtx.font = '32px ' + generic;
        var base = fontCtx.measureText(probe).width;
        fontCtx.font = '32px "' + name + '",' + generic;
        if (Math.abs(fontCtx.measureText(probe).width - base) > 0.5) differs = true;
      });
      return differs;
    } catch (e) { return true; }
  }

  var typeCards = [];
  function buildTypePlate() {
    var grid = document.getElementById('grid-type');
    FONTS.forEach(function (f, i) {
      var el = document.createElement('div');
      el.className = 'card typecard';
      var missing = [];
      if (!fontAvailable(f[1])) missing.push(f[1]);
      // generic system stacks always resolve; only named families can go missing
      if (f[3] !== f[1] && f[3] !== 'System sans' && !fontAvailable(f[3])) missing.push(f[3]);
      el.innerHTML =
        (missing.length ? '<div class="tc-avail">substituted: ' + missing.join(', ') + '</div>' : '') +
        '<div class="tc-word" style="font-family:' + f[2].replace(/"/g, '&quot;') + '">CRUMP &amp; WAINWRIGHT</div>' +
        '<div class="tc-sub" style="font-family:' + f[4].replace(/"/g, '&quot;') + '">INTERSTELLAR FREIGHT SERVICES · EST. 1896</div>' +
        '<div class="tc-memo" style="font-family:' + f[4].replace(/"/g, '&quot;') + '">INTERNAL MEMORANDUM</div>' +
        '<div class="tc-body" style="font-family:' + f[4].replace(/"/g, '&quot;') + '">The Board has approved: one (1) additional freight vessel. ' +
        'Kindly keep the outer colonies in tea and machine parts.</div>' +
        '<div class="tc-hud" style="font-family:' + f[4].replace(/"/g, '&quot;') + '">WK 4 · THU &nbsp;·&nbsp; <b>128</b> consignments &nbsp;·&nbsp; 0123456789</div>' +
        '<div class="cap" style="margin:10px -16px -10px; padding:7px 16px;">' +
        '<span class="no">No. ' + (i + 1) + '</span><span class="nm">' + f[0] + '</span>' +
        '<span class="sub">' + f[1] + ' / ' + f[3] + '</span></div>' +
        '<div class="stamp">APPROVED</div>';
      el.addEventListener('click', function () { select('type', i); });
      grid.appendChild(el);
      typeCards.push(el);
    });
  }

  function applyTypeSettings() {
    var plate = document.getElementById('plate-type');
    plate.style.setProperty('--pb-track', typeS.track + 'em');
    plate.style.setProperty('--pb-body', typeS.body + 'px');
  }

  // ================================================================
  // selection, persistence & the requisition docket
  // ================================================================
  var sel = { cor: null, ship: null, relay: null, type: null };
  var STORE = 'cw_patternbook_v2';

  function select(plate, idx) {
    sel[plate] = (sel[plate] === idx) ? null : idx;
    reflectSelection();
    persist();
  }
  function reflectSelection() {
    cards.forEach(function (cd) {
      cd.el.classList.toggle('selected', sel[cd.plate] === cd.idx);
    });
    typeCards.forEach(function (el, i) {
      el.classList.toggle('selected', sel.type === i);
    });
    function put(id, txt) {
      var el = document.getElementById(id);
      el.textContent = txt || 'unmarked';
      el.classList.toggle('none', !txt);
    }
    put('pick-cor', sel.cor != null ? 'No. ' + (sel.cor + 1) + ' ' + CORRIDORS[sel.cor][0] : null);
    put('pick-ship', sel.ship != null ? 'No. ' + (sel.ship + 1) + ' ' + SHIPS[sel.ship][0] : null);
    put('pick-relay', sel.relay != null ? 'No. ' + (sel.relay + 1) + ' ' + RELAYS[sel.relay][0] : null);
    put('pick-type', sel.type != null ? 'No. ' + (sel.type + 1) + ' ' + FONTS[sel.type][0] : null);
  }

  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        sel: sel, cor: corS, ship: shipS, relay: relS, type: typeS,
      }));
    } catch (e) {}
  }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!s) return;
      ['cor', 'ship', 'relay', 'type'].forEach(function (k) {
        if (s.sel && (typeof s.sel[k] === 'number' || s.sel[k] === null)) sel[k] = s.sel[k];
      });
      function merge(dst, src) {
        if (!src) return;
        Object.keys(dst).forEach(function (k) {
          if (typeof src[k] === typeof dst[k]) dst[k] = src[k];
        });
      }
      merge(corS, s.cor); merge(shipS, s.ship); merge(relS, s.relay); merge(typeS, s.type);
    } catch (e) {}
  }

  function toast(msg) {
    var el = document.getElementById('pb-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function requisition() {
    var doc = {
      docket: 'C&W Pattern Book requisition (2nd ed.)',
      corridor: sel.cor == null ? null : {
        no: sel.cor + 1, name: CORRIDORS[sel.cor][0], settings: corS,
      },
      vessel: sel.ship == null ? null : {
        no: sel.ship + 1, name: SHIPS[sel.ship][0], settings: shipS,
      },
      relay: sel.relay == null ? null : {
        no: sel.relay + 1, name: RELAYS[sel.relay][0], settings: relS,
      },
      letterform: sel.type == null ? null : {
        no: sel.type + 1, name: FONTS[sel.type][0],
        display: FONTS[sel.type][1], displayStack: FONTS[sel.type][2],
        text: FONTS[sel.type][3], textStack: FONTS[sel.type][4],
        settings: typeS,
      },
    };
    var json = JSON.stringify(doc, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function () {
        toast('Requisition copied. Forward it to the Drawing Office.');
      }, function () { window.prompt('The requisition:', json); });
    } else {
      window.prompt('The requisition:', json);
    }
  }

  // ================================================================
  // assembly
  // ================================================================
  restore();

  var ctlCor = document.getElementById('ctl-cor');
  slider(ctlCor, corS, 'weight', 'Weight', 0.4, 2.2, 0.05);
  slider(ctlCor, corS, 'glow', 'Glow', 0, 3, 0.1);
  slider(ctlCor, corS, 'alpha', 'Presence', 0.2, 1, 0.05);
  slider(ctlCor, corS, 'shimmer', 'Shimmer', 0, 3, 0.1);
  slider(ctlCor, corS, 'density', 'Marks', 0.4, 2.5, 0.05);
  swatches(ctlCor, corS);

  var ctlShip = document.getElementById('ctl-ship');
  slider(ctlShip, shipS, 'scale', 'Hull size', 0.6, 1.5, 0.05);
  slider(ctlShip, shipS, 'orbit', 'Orbit radius', 0.6, 1.8, 0.05);
  slider(ctlShip, shipS, 'pace', 'Orbit pace', 0, 2.5, 0.05);
  slider(ctlShip, shipS, 'crate', 'Crate size', 0.6, 1.6, 0.05);
  slider(ctlShip, shipS, 'ring', 'Orbit line', 0, 1, 0.05);
  slider(ctlShip, shipS, 'livery', 'Livery (steel → paint)', 0, 1, 0.05);
  slider(ctlShip, shipS, 'exhaust', 'Engine glow', 0, 2, 0.1);
  swatches(ctlShip, shipS);

  var ctlRelay = document.getElementById('ctl-relay');
  slider(ctlRelay, relS, 'scale', 'Size', 0.6, 1.8, 0.05);
  slider(ctlRelay, relS, 'rate', 'Signal rate', 0.2, 2.5, 0.05);
  slider(ctlRelay, relS, 'bright', 'Lamp brightness', 0.3, 2, 0.05);
  slider(ctlRelay, relS, 'nebula', 'Weather', 0, 1.4, 0.05);
  swatches(ctlRelay, relS);

  var ctlType = document.getElementById('ctl-type');
  slider(ctlType, typeS, 'track', 'Wordmark tracking (em)', 0.02, 0.4, 0.01);
  slider(ctlType, typeS, 'body', 'Text size (px)', 10, 15, 0.5);

  buildCorridorPlate();
  buildShipPlate();
  buildRelayPlate();
  buildTypePlate();
  applyTypeSettings();
  reflectSelection();

  document.getElementById('pb-copy').addEventListener('click', requisition);
  document.getElementById('pb-clear').addEventListener('click', function () {
    sel = { cor: null, ship: null, relay: null, type: null };
    reflectSelection();
    persist();
    toast('All marks withdrawn. The Board remains undecided.');
  });

  requestAnimationFrame(frame);
})();
