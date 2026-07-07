/* patterns.js — The Pattern Book. A specimen catalogue for the Board:
   thirty corridor patterns, thirty vessel & lading arrangements, twenty
   relay beacons and thirty letterform pairings, drawn live so their
   manners can be judged in motion. Selections and adjustments are kept
   in this browser and exported as a requisition docket. Nothing here
   alters the game. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var TH = CW.theme;
  var INK = TH.ink, PARCH = TH.parch, BRASS = TH.brass;
  var COLS = CW.CORRIDOR_COLOURS.map(function (c) { return c.hex; });
  var TINTS = [TH.planet0, TH.planet1, TH.planet2, TH.planet3,
    TH.planet4, TH.planet5, TH.planet6, TH.planet7];
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
  function rngFor(seed) { // small deterministic PRNG per specimen
    var s = seed * 2654435761 % 4294967296;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
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
  function trace(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  }
  // polyline offset by averaged point normals (adequate for gentle bends)
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

  // ------------------------------------------------------------ scenery
  function paintSpace(c, w, h, rnd, starN) {
    c.fillStyle = INK;
    c.fillRect(0, 0, w, h);
    for (var i = 0; i < starN; i++) {
      c.fillStyle = alphaCol(TH.starColour, 0.06 + rnd() * 0.26);
      var r = 0.4 + rnd() * 1.0;
      c.fillRect(rnd() * w, rnd() * h, r, r);
    }
    var g = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }

  function paintPlanet(c, x, y, R, tint, seed, glyphType) {
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
    c.restore();
    c.strokeStyle = 'rgba(220,230,240,0.22)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, R - 0.6, Math.PI * 0.8, Math.PI * 1.75); c.stroke();
    if (glyphType) {
      c.lineWidth = 1.6;
      CW.drawGlyph(c, glyphType, x, y, R * 0.55, 'outline', alphaCol(PARCH, 0.85));
    }
  }

  // parchment consignment chip with a solid cargo glyph — the floating crate
  function chip(c, x, y, s, type, a) {
    c.save();
    c.globalAlpha = a;
    c.fillStyle = dark(0.5);
    rrect(c, x - s / 2 + 1, y - s / 2 + 1.6, s, s, 1.4); c.fill();
    c.fillStyle = PARCH;
    rrect(c, x - s / 2, y - s / 2, s, s, 1.4); c.fill();
    CW.drawGlyph(c, type, x, y, s * 0.4, 'solid', dark(0.92));
    c.restore();
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
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
  // PLATE I — corridors
  // ================================================================
  var corS = { weight: 1, glow: 1, alpha: 0.9, speed: 1, density: 1, colour: -1 };

  /* Each pattern draws between two worlds; x = { c, P, col, t, S, rnd }.
     P is the trimmed path; S the plate settings. */
  var CORRIDORS = [
    ['Hairline', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1.1 * x.S.weight, 0.95);
      x.P.pts.forEach(function (p, i) {
        if (i === 0 || i === x.P.pts.length - 1) {
          x.c.fillStyle = alphaCol(x.col, 0.95);
          x.c.beginPath(); x.c.arc(p.x, p.y, 1.9, 0, 6.29); x.c.fill();
        }
      });
    }],
    ['Twin Rails', function (x) {
      strokePts(x.c, x.P.pts, x.col, 11 * x.S.weight, 0.07 * x.S.glow);
      strokePts(x.c, offset(x.P.pts, 2.3 * x.S.weight), x.col, 1.1 * x.S.weight, 0.9);
      strokePts(x.c, offset(x.P.pts, -2.3 * x.S.weight), x.col, 1.1 * x.S.weight, 0.9);
    }],
    ['Soft Beam', function (x) {
      strokePts(x.c, x.P.pts, x.col, 15 * x.S.weight, 0.05 * x.S.glow);
      strokePts(x.c, x.P.pts, x.col, 8 * x.S.weight, 0.08 * x.S.glow);
      strokePts(x.c, x.P.pts, x.col, 3.5 * x.S.weight, 0.16 * x.S.glow);
      strokePts(x.c, x.P.pts, x.col, 1.5 * x.S.weight, 0.95);
    }],
    ['Gossamer', function (x) {
      strokePts(x.c, x.P.pts, x.col, 18 * x.S.weight, 0.09 * x.S.glow);
      strokePts(x.c, x.P.pts, mix(x.col, PARCH, 0.35), 0.9 * x.S.weight, 1);
    }],
    ['Glass Conduit', function (x) {
      strokePts(x.c, x.P.pts, x.col, 9 * x.S.weight, 0.14);
      strokePts(x.c, x.P.pts, x.col, 9 * x.S.weight, 0.06 * x.S.glow);
      strokePts(x.c, offset(x.P.pts, 4.4 * x.S.weight), x.col, 0.9, 0.6);
      strokePts(x.c, offset(x.P.pts, -4.4 * x.S.weight), x.col, 0.9, 0.6);
    }],
    ['Aurora Ribbon', function (x) {
      var step = 5;
      for (var d = 0; d < x.P.len; d += step) {
        var p0 = x.P.at(d), p1 = x.P.at(Math.min(x.P.len, d + step + 0.5));
        var a = 0.07 + 0.07 * Math.sin(d * 0.06 - x.t * 2.2 * x.S.speed) +
                0.04 * Math.sin(d * 0.021 + x.t * 1.1 * x.S.speed);
        x.c.strokeStyle = alphaCol(x.col, a * x.S.glow + 0.02);
        x.c.lineWidth = 11 * x.S.weight;
        x.c.lineCap = 'butt';
        x.c.beginPath(); x.c.moveTo(p0.x, p0.y); x.c.lineTo(p1.x, p1.y); x.c.stroke();
      }
      strokePts(x.c, x.P.pts, x.col, 1, 0.5);
    }],
    ['Particle Stream', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.13);
      var sp = 9 / x.S.density, n = Math.floor(x.P.len / sp);
      for (var i = 0; i < n; i++) {
        var d = (i * sp + x.t * 34 * x.S.speed) % x.P.len;
        var p = x.P.at(d);
        var a = 0.45 + 0.4 * Math.sin(i * 2.4 + x.t * 3);
        x.c.fillStyle = alphaCol(x.col, 0.12 * x.S.glow);
        x.c.beginPath(); x.c.arc(p.x, p.y, 3 * x.S.weight, 0, 6.29); x.c.fill();
        x.c.fillStyle = alphaCol(x.col, a);
        x.c.beginPath(); x.c.arc(p.x, p.y, 1.3 * x.S.weight, 0, 6.29); x.c.fill();
      }
    }],
    ['Comet Run', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.1);
      for (var k = 0; k < 3; k++) {
        var head = (x.P.len * k / 3 + x.t * 44 * x.S.speed) % x.P.len;
        for (var i = 0; i < 9; i++) {
          var d0 = head - i * 3.2, d1 = head - (i + 1) * 3.2;
          if (d1 < 0) break;
          var f = 1 - i / 9;
          x.c.strokeStyle = alphaCol(x.col, 0.55 * f * f);
          x.c.lineWidth = 2.6 * f * x.S.weight;
          x.c.lineCap = 'round';
          var a0 = x.P.at(d0), a1 = x.P.at(d1);
          x.c.beginPath(); x.c.moveTo(a0.x, a0.y); x.c.lineTo(a1.x, a1.y); x.c.stroke();
        }
        var hp = x.P.at(head);
        x.c.fillStyle = alphaCol(x.col, 0.14 * x.S.glow);
        x.c.beginPath(); x.c.arc(hp.x, hp.y, 5 * x.S.weight, 0, 6.29); x.c.fill();
        x.c.fillStyle = mix(x.col, PARCH, 0.5);
        x.c.beginPath(); x.c.arc(hp.x, hp.y, 1.8 * x.S.weight, 0, 6.29); x.c.fill();
      }
    }],
    ['Firefly Path', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.17);
      var n = Math.round(9 * x.S.density);
      for (var i = 0; i < n; i++) {
        var dir = i % 2 ? 1 : -1;
        var d = ((i * 37.7 + x.t * 11 * x.S.speed * dir) % x.P.len + x.P.len) % x.P.len;
        var p = x.P.at(d);
        var wob = Math.sin(x.t * 1.7 + i * 2.6) * 3;
        var a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(x.t * 2.6 + i * 1.9));
        x.c.fillStyle = alphaCol(x.col, a);
        x.c.beginPath();
        x.c.arc(p.x + p.nx * wob, p.y + p.ny * wob, 1.2 * x.S.weight, 0, 6.29);
        x.c.fill();
      }
    }],
    ['Pearl String', function (x) {
      var sp = 12 / x.S.density, n = Math.floor(x.P.len / sp);
      var lit = Math.floor(x.t * 7 * x.S.speed) % (n + 1);
      for (var i = 0; i <= n; i++) {
        var p = x.P.at(i * sp);
        var isLit = i === lit;
        x.c.fillStyle = alphaCol(x.col, 0.1 * x.S.glow + (isLit ? 0.2 : 0));
        x.c.beginPath(); x.c.arc(p.x, p.y, 4 * x.S.weight, 0, 6.29); x.c.fill();
        x.c.fillStyle = isLit ? mix(x.col, PARCH, 0.6) : alphaCol(x.col, 0.75);
        x.c.beginPath(); x.c.arc(p.x, p.y, 1.7 * x.S.weight, 0, 6.29); x.c.fill();
      }
    }],
    ['Ordnance Dashes', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.12);
      x.c.save();
      x.c.setLineDash([13 / x.S.density, 9 / x.S.density]);
      x.c.lineDashOffset = -x.t * 22 * x.S.speed;
      strokePts(x.c, x.P.pts, x.col, 1.7 * x.S.weight, 0.9);
      x.c.restore();
    }],
    ['Ephemeris Dots', function (x) {
      x.c.save();
      x.c.setLineDash([0.1, 7.5 / x.S.density]);
      x.c.lineDashOffset = -x.t * 6 * x.S.speed;
      strokePts(x.c, x.P.pts, x.col, 2.7 * x.S.weight, 0.9);
      x.c.restore();
    }],
    ['Chevron Flow', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.15);
      var sp = 15 / x.S.density;
      for (var d = (x.t * 26 * x.S.speed) % sp; d < x.P.len; d += sp) {
        var p = x.P.at(d), s = 3.6 * x.S.weight;
        x.c.strokeStyle = alphaCol(x.col, 0.8);
        x.c.lineWidth = 1.3 * x.S.weight;
        x.c.lineCap = 'round';
        x.c.beginPath();
        x.c.moveTo(p.x - p.dx * s + p.nx * s, p.y - p.dy * s + p.ny * s);
        x.c.lineTo(p.x, p.y);
        x.c.lineTo(p.x - p.dx * s - p.nx * s, p.y - p.dy * s - p.ny * s);
        x.c.stroke();
      }
    }],
    ['Survey Ticks', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1.1 * x.S.weight, 0.8);
      var sp = 11 / x.S.density;
      x.c.lineWidth = 0.8;
      x.c.strokeStyle = alphaCol(x.col, 0.5);
      for (var d = sp / 2; d < x.P.len; d += sp) {
        var p = x.P.at(d), s = 2.6 * x.S.weight;
        x.c.beginPath();
        x.c.moveTo(p.x + p.nx * s, p.y + p.ny * s);
        x.c.lineTo(p.x - p.nx * s, p.y - p.ny * s);
        x.c.stroke();
      }
      [0, x.P.len].forEach(function (d) {
        var p = x.P.at(d);
        x.c.beginPath(); x.c.arc(p.x, p.y, 3.4, 0, 6.29);
        x.c.strokeStyle = alphaCol(x.col, 0.9); x.c.lineWidth = 1.1; x.c.stroke();
      });
    }],
    ['Braided Filament', function (x) {
      [0, Math.PI].forEach(function (ph) {
        x.c.strokeStyle = alphaCol(x.col, 0.75);
        x.c.lineWidth = 1.05 * x.S.weight;
        x.c.lineJoin = 'round';
        x.c.beginPath();
        for (var d = 0; d <= x.P.len; d += 3) {
          var p = x.P.at(d);
          var o = Math.sin(d * 0.11 * x.S.density + x.t * 2.2 * x.S.speed + ph) * 3.1 * x.S.weight;
          if (d === 0) x.c.moveTo(p.x + p.nx * o, p.y + p.ny * o);
          else x.c.lineTo(p.x + p.nx * o, p.y + p.ny * o);
        }
        x.c.stroke();
      });
      strokePts(x.c, x.P.pts, x.col, 8 * x.S.weight, 0.05 * x.S.glow);
    }],
    ['Standing Wave', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1.4 * x.S.weight, 0.75);
      x.c.strokeStyle = alphaCol(x.col, 0.35);
      x.c.lineWidth = 1 * x.S.weight;
      x.c.beginPath();
      for (var d = 0; d <= x.P.len; d += 3) {
        var p = x.P.at(d);
        var o = Math.sin(d * 0.09 * x.S.density - x.t * 3 * x.S.speed) * 2.6 *
                Math.sin(Math.PI * d / x.P.len);
        if (d === 0) x.c.moveTo(p.x + p.nx * o, p.y + p.ny * o);
        else x.c.lineTo(p.x + p.nx * o, p.y + p.ny * o);
      }
      x.c.stroke();
    }],
    ['Heartbeat Pulse', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1.2 * x.S.weight, 0.22);
      var head = ((x.t * 0.55 * x.S.speed) % 1) * (x.P.len + 40);
      for (var i = 0; i < 12; i++) {
        var d0 = head - i * 3, d1 = head - (i + 1) * 3;
        if (d1 < 0 || d0 > x.P.len) continue;
        var f = 1 - i / 12;
        var a0 = x.P.at(Math.min(d0, x.P.len)), a1 = x.P.at(Math.max(0, d1));
        x.c.strokeStyle = alphaCol(mix(x.col, PARCH, 0.3 * f), 0.9 * f);
        x.c.lineWidth = (1 + 1.6 * f) * x.S.weight;
        x.c.lineCap = 'round';
        x.c.beginPath(); x.c.moveTo(a0.x, a0.y); x.c.lineTo(a1.x, a1.y); x.c.stroke();
      }
      if (head <= x.P.len) {
        var hp = x.P.at(head);
        x.c.fillStyle = alphaCol(x.col, 0.2 * x.S.glow);
        x.c.beginPath(); x.c.arc(hp.x, hp.y, 6 * x.S.weight, 0, 6.29); x.c.fill();
      }
    }],
    ['Slipstream', function (x) {
      var sway = Math.sin(x.t * 1.3 * x.S.speed) * 0.8;
      strokePts(x.c, offset(x.P.pts, (2.6 + sway) * x.S.weight), x.col, 1.8 * x.S.weight, 0.16);
      strokePts(x.c, offset(x.P.pts, (-2.6 + sway) * x.S.weight), x.col, 1.8 * x.S.weight, 0.16);
      strokePts(x.c, x.P.pts, x.col, 1.9 * x.S.weight, 0.6);
    }],
    ['Ink Shadow', function (x) {
      strokePts(x.c, x.P.pts, INK, 7.5 * x.S.weight, 0.85);
      strokePts(x.c, x.P.pts, x.col, 1.7 * x.S.weight, 0.95);
    }],
    ['Counterflow', function (x) {
      x.c.save();
      x.c.setLineDash([8 / x.S.density, 8 / x.S.density]);
      x.c.lineDashOffset = -x.t * 20 * x.S.speed;
      strokePts(x.c, offset(x.P.pts, 2.6 * x.S.weight), x.col, 1.2 * x.S.weight, 0.8);
      x.c.lineDashOffset = x.t * 20 * x.S.speed;
      strokePts(x.c, offset(x.P.pts, -2.6 * x.S.weight), x.col, 1.2 * x.S.weight, 0.8);
      x.c.restore();
    }],
    ['Waystations', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.3);
      var sp = 21 / x.S.density, n = Math.floor(x.P.len / sp);
      for (var i = 0; i <= n; i++) {
        var p = x.P.at(i * sp), s = 2.6 * x.S.weight;
        var blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(x.t * 2 * x.S.speed - i * 0.9));
        x.c.save();
        x.c.translate(p.x, p.y);
        x.c.rotate(Math.atan2(p.dy, p.dx) + Math.PI / 4);
        x.c.fillStyle = alphaCol(x.col, blink);
        x.c.fillRect(-s / 2, -s / 2, s, s);
        x.c.strokeStyle = alphaCol(PARCH, 0.5);
        x.c.lineWidth = 0.7;
        x.c.strokeRect(-s / 2, -s / 2, s, s);
        x.c.restore();
      }
    }],
    ['Approach Lights', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.08);
      var sp = 9.5 / x.S.density, n = Math.floor(x.P.len / sp);
      for (var i = 0; i <= n; i++) {
        var p = x.P.at(i * sp);
        var ph = ((i * 0.09 - x.t * 0.9 * x.S.speed) % 1 + 1) % 1;
        var a = 0.12 + 0.85 * Math.pow(Math.max(0, 1 - ph * 3), 2);
        x.c.fillStyle = alphaCol(x.col, a);
        x.c.beginPath(); x.c.arc(p.x, p.y, 1.6 * x.S.weight, 0, 6.29); x.c.fill();
      }
    }],
    ['Tapered Spans', function (x) {
      var up = [], down = [];
      for (var d = 0; d <= x.P.len; d += 4) {
        var p = x.P.at(d);
        var hw = Math.pow(Math.sin(Math.PI * d / x.P.len), 0.65) * 3.4 * x.S.weight + 0.3;
        up.push({ x: p.x + p.nx * hw, y: p.y + p.ny * hw });
        down.push({ x: p.x - p.nx * hw, y: p.y - p.ny * hw });
      }
      x.c.fillStyle = alphaCol(x.col, 0.7);
      x.c.beginPath();
      x.c.moveTo(up[0].x, up[0].y);
      up.forEach(function (p) { x.c.lineTo(p.x, p.y); });
      down.reverse().forEach(function (p) { x.c.lineTo(p.x, p.y); });
      x.c.closePath();
      x.c.fill();
      strokePts(x.c, x.P.pts, x.col, 9 * x.S.weight, 0.05 * x.S.glow);
    }],
    ['Anchor Rings', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1.25 * x.S.weight, 0.85);
      x.P.pts.forEach(function (p) {
        x.c.strokeStyle = alphaCol(mix(x.col, PARCH, 0.3), 0.9);
        x.c.lineWidth = 1.2;
        x.c.beginPath(); x.c.arc(p.x, p.y, 4.4 * x.S.weight, 0, 6.29); x.c.stroke();
      });
    }],
    ['Silk Gradient', function (x) {
      var p0 = x.P.pts[0], p1 = x.P.pts[x.P.pts.length - 1];
      var g = x.c.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      g.addColorStop(0, alphaCol(x.col, 0.95));
      g.addColorStop(0.5, alphaCol(mix(x.col, PARCH, 0.55), 0.85));
      g.addColorStop(1, alphaCol(x.col, 0.95));
      x.c.strokeStyle = g;
      x.c.lineWidth = 1.9 * x.S.weight;
      x.c.lineJoin = 'round'; x.c.lineCap = 'round';
      trace(x.c, x.P.pts);
      x.c.stroke();
    }],
    ['Star Sparkle', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1.2 * x.S.weight, 0.7);
      for (var i = 0; i < 4; i++) {
        var d = x.P.len * (0.14 + 0.24 * i) + Math.sin(i * 5.2) * 8;
        var p = x.P.at(d);
        var a = Math.pow(Math.max(0, Math.sin(x.t * 1.5 * x.S.speed + i * 1.8)), 3);
        var s = 3.6 * x.S.weight * (0.6 + a);
        x.c.strokeStyle = alphaCol(mix(x.col, PARCH, 0.5), a * 0.95);
        x.c.lineWidth = 0.9;
        x.c.beginPath();
        x.c.moveTo(p.x - s, p.y); x.c.lineTo(p.x + s, p.y);
        x.c.moveTo(p.x, p.y - s); x.c.lineTo(p.x, p.y + s);
        x.c.stroke();
      }
    }],
    ['Contrail', function (x) {
      for (var d = 0; d < x.P.len; d += 6) {
        var p0 = x.P.at(d), p1 = x.P.at(Math.min(x.P.len, d + 6.5));
        var n = 0.5 + 0.5 * Math.sin(d * 0.13 + x.t * 0.6 * x.S.speed) *
                Math.sin(d * 0.031 - x.t * 0.4 * x.S.speed);
        x.c.strokeStyle = alphaCol(x.col, (0.08 + 0.1 * n) * x.S.glow);
        x.c.lineWidth = (4 + 5 * n) * x.S.weight;
        x.c.lineCap = 'butt';
        x.c.beginPath(); x.c.moveTo(p0.x, p0.y); x.c.lineTo(p1.x, p1.y); x.c.stroke();
      }
      strokePts(x.c, x.P.pts, x.col, 1, 0.4);
    }],
    ['Morse Signal', function (x) {
      strokePts(x.c, x.P.pts, x.col, 1, 0.12);
      x.c.save();
      x.c.setLineDash([9 / x.S.density, 5 / x.S.density, 2.5 / x.S.density,
        5 / x.S.density, 2.5 / x.S.density, 12 / x.S.density]);
      x.c.lineDashOffset = -x.t * 18 * x.S.speed;
      strokePts(x.c, x.P.pts, x.col, 1.6 * x.S.weight, 0.9);
      x.c.restore();
    }],
    ['Rails & Sleepers', function (x) {
      strokePts(x.c, x.P.pts, x.col, 10 * x.S.weight, 0.06 * x.S.glow);
      strokePts(x.c, offset(x.P.pts, 2.4 * x.S.weight), x.col, 1 * x.S.weight, 0.85);
      strokePts(x.c, offset(x.P.pts, -2.4 * x.S.weight), x.col, 1 * x.S.weight, 0.85);
      var sp = 8.5 / x.S.density;
      x.c.strokeStyle = alphaCol(x.col, 0.26);
      x.c.lineWidth = 0.9;
      for (var d = sp / 2; d < x.P.len; d += sp) {
        var p = x.P.at(d), s = 2.9 * x.S.weight;
        x.c.beginPath();
        x.c.moveTo(p.x + p.nx * s, p.y + p.ny * s);
        x.c.lineTo(p.x - p.nx * s, p.y - p.ny * s);
        x.c.stroke();
      }
    }],
    ['Gilded Edge', function (x) {
      strokePts(x.c, offset(x.P.pts, 1.3), INK, 2.4 * x.S.weight, 0.8);
      strokePts(x.c, x.P.pts, x.col, 2.2 * x.S.weight, 0.95);
      strokePts(x.c, offset(x.P.pts, -0.8 * x.S.weight), mix(x.col, PARCH, 0.55), 0.7, 0.85);
    }],
  ];

  function buildCorridorPlate() {
    var grid = document.getElementById('grid-cor');
    var W = 340, H = 150;
    CORRIDORS.forEach(function (def, i) {
      var rnd0 = rngFor(100 + i);
      var stars = [];
      for (var s = 0; s < 42; s++) stars.push([rnd0() * W, rnd0() * H, 0.4 + rnd0(), 0.05 + rnd0() * 0.25]);
      var pA = { x: 32, y: 105, r: 12 }, pB = { x: 310, y: 86, r: 9 }, bend = { x: 172, y: 42 };
      function trim(p, toward, by) {
        var dx = toward.x - p.x, dy = toward.y - p.y, l = Math.sqrt(dx * dx + dy * dy);
        return { x: p.x + dx / l * by, y: p.y + dy / l * by };
      }
      var P = makePath([trim(pA, bend, pA.r + 5), bend, trim(pB, bend, pB.r + 5)]);

      addCard(grid, 'cor', i, i + 1, def[0], null, W, H, function (c, w, h, t) {
        c.fillStyle = INK; c.fillRect(0, 0, w, h);
        stars.forEach(function (st) {
          c.fillStyle = alphaCol(TH.starColour, st[3]);
          c.fillRect(st[0], st[1], st[2], st[2]);
        });
        var col = colFor(corS, i);
        c.save();
        c.globalAlpha = corS.alpha;
        def[1]({ c: c, P: P, col: col, t: t, S: corS, rnd: rnd0 });
        c.restore();
        paintPlanet(c, pA.x, pA.y, pA.r, TINTS[i % 8], 100 + i, 'water');
        paintPlanet(c, pB.x, pB.y, pB.r, TINTS[(i + 3) % 8], 200 + i, 'energy');
        // a vessel in service, so traffic legibility can be judged
        var period = 2 * P.len / 24;
        var ph = (t % period) / period * 2;
        var dir = ph < 1 ? 1 : -1;
        var d = (ph < 1 ? ph : 2 - ph) * P.len;
        var p = P.at(d);
        c.save();
        c.translate(p.x, p.y);
        c.rotate(Math.atan2(p.dy * dir, p.dx * dir));
        c.fillStyle = dark(0.7);
        c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -3.4); c.lineTo(-4, 0); c.lineTo(-6, 3.4); c.closePath(); c.fill();
        c.fillStyle = col;
        c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -2.8); c.lineTo(-3.4, 0); c.lineTo(-5, 2.8); c.closePath(); c.fill();
        c.strokeStyle = alphaCol(PARCH, 0.8); c.lineWidth = 0.7; c.stroke();
        c.restore();
      });
    });
  }

  // ================================================================
  // PLATE II — vessels & pods
  // ================================================================
  var shipS = { scale: 1, orbit: 1, pace: 1, crate: 1, ring: 0.4, livery: 0.5, exhaust: 1, colour: -1 };

  /* Hull painters: draw at origin, bow toward +x. (c, L, W, hull, acc) */
  function hullFinish(c, build, fill) {
    c.save(); c.translate(1.2, 2.2);
    c.beginPath(); build(c); c.fillStyle = dark(0.45); c.fill();
    c.restore();
    c.beginPath(); build(c); c.fillStyle = fill; c.fill();
    c.strokeStyle = alphaCol(PARCH, 0.75); c.lineWidth = 0.9;
    c.beginPath(); build(c); c.stroke();
  }
  var HULLS = [
    ['Clipper', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.moveTo(L / 2, 0);
        c.quadraticCurveTo(L * 0.08, -W * 0.66, -L / 2, -W * 0.16);
        c.lineTo(-L / 2, W * 0.16);
        c.quadraticCurveTo(L * 0.08, W * 0.66, L / 2, 0);
      }, hull);
      c.strokeStyle = alphaCol(PARCH, 0.3); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(L * 0.42, 0); c.lineTo(-L * 0.46, 0); c.stroke();
      c.fillStyle = acc;
      c.beginPath(); c.arc(L * 0.2, 0, W * 0.13, 0, 6.29); c.fill();
    }],
    ['Packet', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.moveTo(L / 2 + 4, 0);
        c.lineTo(L / 2 - 3, -W * 0.34); c.lineTo(L * 0.16, -W * 0.5);
        c.lineTo(-L / 2 + 3, -W * 0.5); c.lineTo(-L / 2, -W * 0.3);
        c.lineTo(-L / 2, W * 0.3); c.lineTo(-L / 2 + 3, W * 0.5);
        c.lineTo(L * 0.16, W * 0.5); c.lineTo(L / 2 - 3, W * 0.34);
        c.closePath();
      }, hull);
      c.fillStyle = mix(hull, INK, 0.4);
      rrect(c, -L / 2 - 0.5, -W * 0.3, 3.2, W * 0.6, 1); c.fill();
      c.fillStyle = alphaCol(acc, 0.9);
      c.beginPath(); c.arc(L / 2 - 1, 0, 1.6, 0, 6.29); c.fill();
    }],
    ['Dart', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.moveTo(L / 2, 0);
        c.lineTo(-L / 2, -W * 0.58); c.lineTo(-L * 0.28, 0); c.lineTo(-L / 2, W * 0.58);
        c.closePath();
      }, hull);
      c.strokeStyle = alphaCol(acc, 0.85); c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(L * 0.3, 0); c.lineTo(-L * 0.2, 0); c.stroke();
    }],
    ['Whale-back', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.moveTo(L / 2, 0);
        c.bezierCurveTo(L * 0.42, -W * 0.72, -L * 0.05, -W * 0.6, -L * 0.36, -W * 0.14);
        c.lineTo(-L / 2, -W * 0.4);
        c.lineTo(-L * 0.42, 0);
        c.lineTo(-L / 2, W * 0.4);
        c.lineTo(-L * 0.36, W * 0.14);
        c.bezierCurveTo(-L * 0.05, W * 0.6, L * 0.42, W * 0.72, L / 2, 0);
      }, hull);
      c.fillStyle = alphaCol(acc, 0.8);
      c.beginPath(); c.arc(L * 0.26, 0, W * 0.11, 0, 6.29); c.fill();
    }],
    ['Dirigible', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.ellipse(0, 0, L / 2, W * 0.5, 0, 0, 6.29);
      }, hull);
      [-1, 1].forEach(function (s) {
        c.fillStyle = mix(hull, INK, 0.35);
        c.beginPath();
        c.moveTo(-L * 0.34, s * W * 0.32);
        c.lineTo(-L * 0.58, s * W * 0.72);
        c.lineTo(-L * 0.46, s * W * 0.22);
        c.closePath(); c.fill();
      });
      c.strokeStyle = alphaCol(PARCH, 0.35); c.lineWidth = 0.7;
      for (var i = -2; i <= 2; i++) {
        var xx = i * L * 0.16;
        var yy = W * 0.5 * Math.sqrt(Math.max(0, 1 - (xx / (L / 2)) * (xx / (L / 2))));
        c.beginPath(); c.moveTo(xx, -yy); c.lineTo(xx, yy); c.stroke();
      }
      c.fillStyle = acc;
      rrect(c, -L * 0.14, -W * 0.1, L * 0.28, W * 0.2, 2); c.fill();
    }],
    ['Catamaran', function (c, L, W, hull, acc) {
      c.fillStyle = mix(hull, INK, 0.3);
      rrect(c, -L * 0.18, -W * 0.62, L * 0.36, W * 1.24, 2.5); c.fill();
      c.strokeStyle = alphaCol(PARCH, 0.5); c.lineWidth = 0.8;
      rrect(c, -L * 0.18, -W * 0.62, L * 0.36, W * 1.24, 2.5); c.stroke();
      [-1, 1].forEach(function (s) {
        hullFinish(c, function () {
          c.moveTo(L * 0.46, s * W * 0.55);
          c.quadraticCurveTo(L * 0.05, s * W * 0.87, -L * 0.44, s * W * 0.62);
          c.quadraticCurveTo(L * 0.05, s * W * 0.35, L * 0.46, s * W * 0.55);
        }, hull);
      });
      c.fillStyle = acc;
      c.beginPath(); c.arc(0, 0, W * 0.14, 0, 6.29); c.fill();
    }],
    ['Annulus', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        rrect(c, -L / 2, -W * 0.14, L, W * 0.28, W * 0.14);
      }, hull);
      c.save(); c.translate(1.2, 2.2);
      c.strokeStyle = dark(0.45); c.lineWidth = W * 0.3;
      c.beginPath(); c.arc(0, 0, W * 0.85, 0, 6.29); c.stroke();
      c.restore();
      c.strokeStyle = hull; c.lineWidth = W * 0.3;
      c.beginPath(); c.arc(0, 0, W * 0.85, 0, 6.29); c.stroke();
      c.strokeStyle = alphaCol(PARCH, 0.7); c.lineWidth = 0.8;
      c.beginPath(); c.arc(0, 0, W * 0.85 + W * 0.15, 0, 6.29); c.stroke();
      c.beginPath(); c.arc(0, 0, W * 0.85 - W * 0.15, 0, 6.29); c.stroke();
      c.fillStyle = acc;
      c.beginPath(); c.arc(L / 2 - W * 0.12, 0, W * 0.12, 0, 6.29); c.fill();
    }],
    ['Manta', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.moveTo(L / 2, 0);
        c.quadraticCurveTo(L * 0.05, -W * 1.0, -L * 0.42, -W * 0.62);
        c.quadraticCurveTo(-L * 0.18, -W * 0.18, -L * 0.34, 0);
        c.quadraticCurveTo(-L * 0.18, W * 0.18, -L * 0.42, W * 0.62);
        c.quadraticCurveTo(L * 0.05, W * 1.0, L / 2, 0);
      }, hull);
      c.strokeStyle = alphaCol(acc, 0.75); c.lineWidth = 1;
      c.beginPath();
      c.moveTo(L * 0.34, 0);
      c.quadraticCurveTo(-L * 0.05, -W * 0.4, -L * 0.3, -W * 0.5);
      c.moveTo(L * 0.34, 0);
      c.quadraticCurveTo(-L * 0.05, W * 0.4, -L * 0.3, W * 0.5);
      c.stroke();
    }],
    ['Longliner', function (c, L, W, hull, acc) {
      var LL = L * 1.18;
      hullFinish(c, function () {
        c.moveTo(LL / 2 + 5, 0);
        c.lineTo(LL / 2 - 4, -W * 0.3);
        c.lineTo(-LL / 2 + 2, -W * 0.3);
        c.lineTo(-LL / 2, 0);
        c.lineTo(-LL / 2 + 2, W * 0.3);
        c.lineTo(LL / 2 - 4, W * 0.3);
        c.closePath();
      }, hull);
      c.strokeStyle = alphaCol(PARCH, 0.28); c.lineWidth = 0.7;
      for (var i = 1; i <= 4; i++) {
        var xx = LL / 2 - 4 - i * LL * 0.19;
        c.beginPath(); c.moveTo(xx, -W * 0.3); c.lineTo(xx, W * 0.3); c.stroke();
      }
      c.fillStyle = acc;
      c.beginPath(); c.arc(LL * 0.36, 0, W * 0.12, 0, 6.29); c.fill();
    }],
    ['Harbour Tug', function (c, L, W, hull, acc) {
      hullFinish(c, function () {
        c.moveTo(L * 0.22, -W * 0.55);
        c.arc(L * 0.22, 0, W * 0.55, -Math.PI / 2, Math.PI / 2);
        c.lineTo(-L / 2 + 2, W * 0.38);
        c.lineTo(-L / 2, 0);
        c.lineTo(-L / 2 + 2, -W * 0.38);
        c.closePath();
      }, hull);
      c.save();
      c.setLineDash([2.5, 2.5]);
      c.strokeStyle = alphaCol(PARCH, 0.55); c.lineWidth = 1.6;
      c.beginPath(); c.arc(L * 0.22, 0, W * 0.55 + 1.4, -Math.PI / 2, Math.PI / 2); c.stroke();
      c.restore();
      c.fillStyle = mix(hull, INK, 0.4);
      rrect(c, -L * 0.42, -W * 0.28, L * 0.2, W * 0.56, 1.5); c.fill();
      c.fillStyle = acc;
      c.beginPath(); c.arc(L * 0.22, 0, W * 0.13, 0, 6.29); c.fill();
    }],
  ];
  var LADINGS = ['carousel lading', 'halo lading', 'stern-ring lading'];
  var SHIP_CARGO = ['water', 'minerals', 'machinery', 'medicine', 'energy'];
  var POD_CARGO = ['food', 'luxuries', 'biology'];

  function orbitPositions(style, n, cx, cy, L, R, t, pace) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var ph = t * 0.9 * pace + i * Math.PI * 2 / n;
      var p;
      if (style === 0) {        // carousel: equatorial ellipse about the hull
        p = { x: cx + Math.cos(ph) * R, y: cy + Math.sin(ph) * R * 0.36,
              depth: Math.sin(ph), scale: 0.82 + 0.24 * Math.max(0, Math.sin(ph)) };
      } else if (style === 1) { // halo: a flat ring in the plane of travel
        p = { x: cx + Math.cos(ph) * R * 0.8, y: cy + Math.sin(ph) * R * 0.8,
              depth: 1, scale: 1 };
      } else {                  // stern ring: consignments follow astern
        p = { x: cx - L * 0.62 + Math.cos(ph) * R * 0.55, y: cy + Math.sin(ph) * R * 0.34,
              depth: Math.sin(ph), scale: 0.8 + 0.22 * Math.max(0, Math.sin(ph)) };
      }
      out.push(p);
    }
    return out;
  }
  function orbitRing(c, style, cx, cy, L, R, col) {
    if (shipS.ring <= 0.02) return;
    c.save();
    c.setLineDash([2.5, 3.5]);
    c.strokeStyle = alphaCol(col, 0.4 * shipS.ring);
    c.lineWidth = 0.8;
    c.beginPath();
    if (style === 0) c.ellipse(cx, cy, R, R * 0.36, 0, 0, 6.29);
    else if (style === 1) c.arc(cx, cy, R * 0.8, 0, 6.29);
    else c.ellipse(cx - L * 0.62, cy, R * 0.55, R * 0.34, 0, 0, 6.29);
    c.stroke();
    c.restore();
  }

  function buildShipPlate() {
    var grid = document.getElementById('grid-ship');
    var W = 340, H = 180;
    for (var no = 0; no < 30; no++) {
      (function (no) {
        var hullIdx = Math.floor(no / 3), style = no % 3;
        var hull = HULLS[hullIdx];
        var rnd0 = rngFor(500 + no);
        var stars = [];
        for (var s = 0; s < 40; s++) stars.push([rnd0() * W, rnd0() * H, 0.4 + rnd0(), 0.05 + rnd0() * 0.25]);

        addCard(grid, 'ship', no, no + 1, hull[0], LADINGS[style], W, H, function (c, w, h, t) {
          c.fillStyle = INK; c.fillRect(0, 0, w, h);
          stars.forEach(function (st) {
            c.fillStyle = alphaCol(TH.starColour, st[3]);
            c.fillRect(st[0], st[1], st[2], st[2]);
          });
          var col = colFor(shipS, no);
          var cy = h * 0.52;
          c.strokeStyle = alphaCol(col, 0.14); // the corridor it serves, faintly
          c.lineWidth = 1;
          c.beginPath(); c.moveTo(0, cy); c.lineTo(w, cy); c.stroke();

          var sc = shipS.scale;
          var L = 62 * sc, Wd = 19 * sc;
          var R = 30 * sc * shipS.orbit;
          var span = w + 240;
          var cx = -120 + ((t * 26 + no * 53) % span); // desynchronised per specimen
          var steel = mix('#3d4654', PARCH, 0.08);
          var hullCol = mix(steel, col, shipS.livery);

          // pod barge astern, with its own small orbit
          var podX = cx - (L * 0.95 + (style === 2 ? R * 0.9 : 0) + 40 * sc);
          var podL = L * 0.42, podR = R * 0.5;
          c.strokeStyle = alphaCol(col, 0.55); // tether
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(cx - L * 0.5, cy);
          c.quadraticCurveTo((cx - L * 0.5 + podX) / 2, cy + 3.5, podX + podL * 0.5, cy);
          c.stroke();
          var podOrbit = orbitPositions(style, 3, podX, cy, podL, podR, t * 1.25 + 2, shipS.pace);
          orbitRing(c, style, podX, cy, podL, podR, col);
          podOrbit.forEach(function (p, i) {
            if (p.depth < 0) chip(c, p.x, p.y, 6.4 * shipS.crate * p.scale, POD_CARGO[i], 0.6);
          });
          c.save();
          c.translate(podX, cy);
          hull[1](c, podL, Wd * 0.5, hullCol, col);
          c.restore();
          podOrbit.forEach(function (p, i) {
            if (p.depth >= 0) chip(c, p.x, p.y, 6.4 * shipS.crate * p.scale, POD_CARGO[i], 0.95);
          });

          // exhaust & engine trail
          if (shipS.exhaust > 0) {
            var lick = (6 + 3 * Math.sin(t * 19)) * shipS.exhaust * sc;
            c.fillStyle = 'rgba(255,214,140,' + Math.min(1, 0.45 * shipS.exhaust) + ')';
            c.beginPath();
            c.moveTo(cx - L * 0.5, cy - 1.7 * sc);
            c.lineTo(cx - L * 0.5 - lick, cy);
            c.lineTo(cx - L * 0.5, cy + 1.7 * sc);
            c.closePath(); c.fill();
          }

          // the vessel with its lading in open orbit
          var pos = orbitPositions(style, 5, cx, cy, L, R, t, shipS.pace);
          orbitRing(c, style, cx, cy, L, R, col);
          pos.forEach(function (p, i) {
            if (p.depth < 0) chip(c, p.x, p.y, 8.2 * shipS.crate * p.scale, SHIP_CARGO[i], 0.6);
          });
          c.save();
          c.translate(cx, cy);
          hull[1](c, L, Wd, hullCol, col);
          c.restore();
          pos.forEach(function (p, i) {
            if (p.depth >= 0) chip(c, p.x, p.y, 8.2 * shipS.crate * p.scale, SHIP_CARGO[i], 0.95);
          });
        });
      })(no);
    }
  }

  // ================================================================
  // PLATE III — relay beacons
  // ================================================================
  var relS = { scale: 1, rate: 1, bright: 1, nebula: 1, colour: -1 };

  /* Each pattern draws at the origin. y = { c, r, col, t, S } where r is
     the base radius (~13 × scale) and t is already rate-adjusted. */
  function lamp(c, x, y, r, col, a, glow) {
    if (glow) {
      c.fillStyle = alphaCol(col, 0.16 * a * relS.bright);
      c.beginPath(); c.arc(x, y, r * 3, 0, 6.29); c.fill();
    }
    c.fillStyle = alphaCol(col, Math.min(1, a * relS.bright));
    c.beginPath(); c.arc(x, y, r, 0, 6.29); c.fill();
  }
  var RELAYS = [
    ['Pylon Mk I', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(0, -r * 0.75); c.lineTo(r * 0.55, 0); c.lineTo(0, r * 0.75); c.lineTo(-r * 0.55, 0);
      c.closePath(); c.stroke();
      lamp(c, 0, 0, 2.6, y.col, 0.35 + 0.65 * (Math.sin(y.t * 3) > 0 ? 1 : 0.15), true);
      var ph = (y.t * 0.7) % 1;
      c.strokeStyle = alphaCol(y.col, (1 - ph) * 0.4 * relS.bright);
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, r * 0.6 + ph * r * 1.3, 0, 6.29); c.stroke();
    }],
    ['Pharos', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-r * 0.3, r * 0.8); c.lineTo(-r * 0.14, -r * 0.55);
      c.lineTo(r * 0.14, -r * 0.55); c.lineTo(r * 0.3, r * 0.8);
      c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-r * 0.34, r * 0.8); c.lineTo(r * 0.34, r * 0.8); c.stroke();
      var a = y.t * 1.1;
      [0, Math.PI].forEach(function (o) {
        var g = c.createLinearGradient(0, 0, Math.cos(a + o) * r * 2.6, Math.sin(a + o) * r * 2.6);
        g.addColorStop(0, alphaCol(y.col, 0.4 * relS.bright));
        g.addColorStop(1, alphaCol(y.col, 0));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, -r * 0.62);
        c.lineTo(Math.cos(a + o - 0.16) * r * 2.6, -r * 0.62 + Math.sin(a + o - 0.16) * r * 2.6);
        c.lineTo(Math.cos(a + o + 0.16) * r * 2.6, -r * 0.62 + Math.sin(a + o + 0.16) * r * 2.6);
        c.closePath(); c.fill();
      });
      lamp(c, 0, -r * 0.62, 2.2, y.col, 0.95, true);
    }],
    ['Bell Buoy', function (y) {
      var c = y.c, r = y.r, bob = Math.sin(y.t * 1.4) * 1.5;
      c.save(); c.translate(0, bob);
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-r * 0.5, r * 0.35);
      c.quadraticCurveTo(-r * 0.5, -r * 0.6, 0, -r * 0.6);
      c.quadraticCurveTo(r * 0.5, -r * 0.6, r * 0.5, r * 0.35);
      c.closePath(); c.stroke();
      lamp(c, 0, -r * 0.75, 2, y.col, 0.5 + 0.5 * Math.sin(y.t * 2.4), true);
      c.restore();
      c.strokeStyle = alphaCol(PARCH, 0.3); c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, r * 0.55, r * 0.85, r * 0.2, 0, 0, 6.29); c.stroke();
    }],
    ['Channel Gates', function (y) {
      var c = y.c, r = y.r;
      [-1, 1].forEach(function (s, i) {
        var on = Math.sin(y.t * 2.2 + i * Math.PI) > 0;
        c.strokeStyle = alphaCol(PARCH, 0.85); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(s * r * 1.05, -r * 0.55); c.lineTo(s * r * 1.05, r * 0.55); c.stroke();
        c.beginPath(); c.moveTo(s * r * 1.05 - 3, r * 0.55); c.lineTo(s * r * 1.05 + 3, r * 0.55); c.stroke();
        lamp(c, s * r * 1.05, -r * 0.68, 2, y.col, on ? 0.95 : 0.15, on);
      });
    }],
    ['Lantern', function (y) {
      var c = y.c, r = y.r;
      var flick = 0.75 + 0.25 * Math.sin(y.t * 7.3) * Math.sin(y.t * 3.1);
      c.fillStyle = alphaCol(y.col, 0.2 * flick * relS.bright);
      c.beginPath(); c.arc(0, 0, r * 1.5, 0, 6.29); c.fill();
      lamp(c, 0, 0, r * 0.34, y.col, 0.85 * flick, false);
      c.strokeStyle = alphaCol(PARCH, 0.95); c.lineWidth = 1.4;
      c.beginPath();
      for (var i = 0; i <= 6; i++) {
        var a = i / 6 * Math.PI * 2 - Math.PI / 2;
        var px = Math.cos(a) * r * 0.72, py = Math.sin(a) * r * 0.72;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); c.stroke();
      c.beginPath(); c.arc(0, -r * 0.95, r * 0.2, 0, 6.29); c.stroke();
    }],
    ['Gyre', function (y) {
      var c = y.c, r = y.r;
      var squash = Math.sin(y.t * 1.3) * 0.85;
      c.strokeStyle = alphaCol(PARCH, 0.85); c.lineWidth = 1.3;
      c.beginPath(); c.ellipse(0, 0, r, Math.abs(squash) * r + 1, 0, 0, 6.29); c.stroke();
      lamp(c, r, 0, 1.8, y.col, 0.9, true);
      lamp(c, -r, 0, 1.8, y.col, 0.9, false);
      lamp(c, 0, 0, 2, y.col, 0.5 + 0.4 * Math.sin(y.t * 2), false);
    }],
    ['Obelisk', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-r * 0.16, r * 0.85); c.lineTo(-r * 0.08, -r * 0.85);
      c.lineTo(r * 0.08, -r * 0.85); c.lineTo(r * 0.16, r * 0.85);
      c.closePath(); c.stroke();
      var pulse = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(y.t * 2.6), 2);
      lamp(c, 0, -r * 1.05, 2.2, y.col, pulse, true);
    }],
    ['Dish Array', function (y) {
      var c = y.c, r = y.r;
      var a = Math.sin(y.t * 0.9) * 0.7 - Math.PI / 2;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-r * 0.5, r * 0.8); c.lineTo(0, 0); c.lineTo(r * 0.5, r * 0.8); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.62, a - 0.85, a + 0.85); c.stroke();
      lamp(c, 0, 0, 1.8, y.col, 0.85, false);
      var ph = (y.t * 0.8) % 1;
      c.strokeStyle = alphaCol(y.col, (1 - ph) * 0.5 * relS.bright);
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, r * 0.7 + ph * r * 1.6, a - 0.5, a + 0.5); c.stroke();
    }],
    ['Firefly Cage', function (y) {
      var c = y.c, r = y.r;
      lamp(c, 0, 0, 2, y.col, 0.4 + 0.2 * Math.sin(y.t * 1.7), true);
      for (var i = 0; i < 5; i++) {
        var a = y.t * (0.7 + i * 0.13) + i * 2.4;
        var rr = r * (0.55 + (i % 3) * 0.28);
        lamp(c, Math.cos(a) * rr, Math.sin(a) * rr * 0.8, 1.3,
          y.col, 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(y.t * 3 + i * 2)), false);
      }
    }],
    ['Star Fort', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.85); c.lineWidth = 1.3;
      var corners = [];
      c.beginPath();
      for (var i = 0; i <= 6; i++) {
        var a = i / 6 * Math.PI * 2 - Math.PI / 2;
        var px = Math.cos(a) * r * 0.85, py = Math.sin(a) * r * 0.85;
        corners.push([px, py]);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      var lit = Math.floor(y.t * 2.4) % 6;
      for (var k = 0; k < 6; k++) {
        lamp(c, corners[k][0], corners[k][1], 1.6, y.col, k === lit ? 1 : 0.18, k === lit);
      }
    }],
    ['Astrolabe', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.8); c.lineWidth = 1.2;
      c.save(); c.rotate(y.t * 0.5);
      c.beginPath(); c.ellipse(0, 0, r, r * 0.4, 0, 0, 6.29); c.stroke();
      c.restore();
      c.save(); c.rotate(-y.t * 0.35 + 1.1);
      c.beginPath(); c.ellipse(0, 0, r * 0.85, r * 0.32, 0, 0, 6.29); c.stroke();
      c.restore();
      lamp(c, 0, 0, 2.2, y.col, 0.8 + 0.2 * Math.sin(y.t * 2.2), true);
    }],
    ['Mooring Mast', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, r * 0.9); c.lineTo(0, -r * 0.9); c.stroke();
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, -r * 0.9); c.lineTo(-r * 0.55, r * 0.9); c.stroke();
      c.beginPath(); c.moveTo(0, -r * 0.9); c.lineTo(r * 0.55, r * 0.9); c.stroke();
      var seq = Math.floor(y.t * 2.6) % 3;
      for (var i = 0; i < 3; i++) {
        lamp(c, 0, -r * 0.75 + i * r * 0.55, 1.7, y.col, i === seq ? 1 : 0.22, i === seq);
      }
    }],
    ['Semaphore', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, r * 0.9); c.lineTo(0, -r * 0.75); c.stroke();
      var step = Math.floor(y.t * 0.7) % 3;
      var target = [-0.5, -1.1, 0.2][step];
      var wob = Math.sin(y.t * 6) * 0.03;
      [1, -1].forEach(function (s, i) {
        var a = target * s + (i ? 0.5 : 0) + wob;
        var ax = Math.cos(a) * r * 0.72, ay = -r * 0.45 + Math.sin(a) * r * 0.72;
        c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(0, -r * 0.45); c.lineTo(ax, ay); c.stroke();
        lamp(c, ax, ay, 1.6, y.col, 0.9, false);
      });
    }],
    ['Heliograph', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.4;
      c.beginPath(); c.arc(0, 0, r * 0.4, 0, 6.29); c.stroke();
      c.beginPath(); c.moveTo(-r * 0.45, r * 0.85); c.lineTo(0, r * 0.35); c.lineTo(r * 0.45, r * 0.85); c.stroke();
      var f = Math.pow(Math.max(0, Math.sin(y.t * 1.8)), 8);
      lamp(c, 0, 0, r * 0.22, y.col, 0.3 + 0.7 * f, f > 0.3);
      if (f > 0.05) {
        c.strokeStyle = alphaCol(mix(y.col, PARCH, 0.6), f * 0.95);
        c.lineWidth = 1;
        var s = r * (0.7 + f * 1.1);
        c.beginPath();
        c.moveTo(-s, 0); c.lineTo(s, 0); c.moveTo(0, -s); c.lineTo(0, s);
        c.stroke();
      }
    }],
    ['Compass Rose', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.6); c.lineWidth = 1;
      c.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        var rr = i % 2 ? r * 0.45 : r * 0.95;
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.stroke();
      var lit = Math.floor(y.t * 1.8) % 4;
      for (var k = 0; k < 4; k++) {
        var ka = k / 4 * Math.PI * 2;
        lamp(c, Math.cos(ka) * r * 0.95, Math.sin(ka) * r * 0.95, 1.6, y.col, k === lit ? 1 : 0.2, k === lit);
      }
    }],
    ['Twin Pontoons', function (y) {
      var c = y.c, r = y.r;
      var rot = Math.sin(y.t * 0.6) * 0.3;
      c.save(); c.rotate(rot);
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(-r * 0.75, 0); c.lineTo(r * 0.75, 0); c.stroke();
      c.beginPath(); c.arc(-r * 0.85, 0, r * 0.3, 0, 6.29); c.stroke();
      c.beginPath(); c.arc(r * 0.85, 0, r * 0.3, 0, 6.29); c.stroke();
      var left = Math.sin(y.t * 2.4) > 0;
      lamp(c, -r * 0.85, 0, 1.6, y.col, left ? 0.95 : 0.18, left);
      lamp(c, r * 0.85, 0, 1.6, y.col, left ? 0.18 : 0.95, !left);
      c.restore();
    }],
    ['Candle Spire', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-r * 0.3, r * 0.85); c.lineTo(0, -r * 0.55); c.lineTo(r * 0.3, r * 0.85);
      c.stroke();
      var sway = Math.sin(y.t * 2.1) * r * 0.08;
      var g = c.createRadialGradient(sway, -r * 0.85, 0.5, sway, -r * 0.85, r * 0.75);
      g.addColorStop(0, alphaCol(mix(y.col, PARCH, 0.4), 0.85 * relS.bright));
      g.addColorStop(1, alphaCol(y.col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(sway, -r * 0.85, r * 0.32, r * 0.5, 0, 0, 6.29);
      c.fill();
    }],
    ['Orrery', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.85); c.lineWidth = 1.3;
      c.beginPath(); c.arc(0, 0, r * 0.34, 0, 6.29); c.stroke();
      c.save();
      c.setLineDash([1.5, 3]);
      c.strokeStyle = alphaCol(PARCH, 0.35); c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(0, 0, r * 0.95, r * 0.55, 0, 0, 6.29); c.stroke();
      c.restore();
      var a = y.t * 1.4;
      lamp(c, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.55, 1.8, y.col, 0.95, true);
    }],
    ['Anchor Light', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -r * 0.55); c.lineTo(0, r * 0.6); c.stroke();
      c.beginPath(); c.moveTo(-r * 0.42, -r * 0.28); c.lineTo(r * 0.42, -r * 0.28); c.stroke();
      c.beginPath(); c.arc(0, r * 0.28, r * 0.5, 0.35, Math.PI - 0.35); c.stroke();
      c.beginPath(); c.arc(0, -r * 0.72, r * 0.16, 0, 6.29); c.stroke();
      var pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(y.t * 1.8));
      c.strokeStyle = alphaCol(y.col, pulse * 0.55 * relS.bright);
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, r * 1.15, 0, 6.29); c.stroke();
      lamp(c, 0, -r * 0.72, 1.5, y.col, pulse, false);
    }],
    ['Ion Fountain', function (y) {
      var c = y.c, r = y.r;
      c.strokeStyle = alphaCol(PARCH, 0.9); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-r * 0.45, r * 0.65); c.lineTo(r * 0.45, r * 0.65); c.stroke();
      lamp(c, 0, r * 0.5, 1.8, y.col, 0.8, true);
      for (var i = 0; i < 8; i++) {
        var ph = ((y.t * 0.55 + i / 8) % 1);
        var px = Math.sin(i * 5.1) * r * 0.4 * ph;
        var py = r * 0.5 - ph * r * 1.5;
        lamp(c, px, py, 1.1, y.col, (1 - ph) * 0.85, false);
      }
    }],
  ];

  function buildRelayPlate() {
    var grid = document.getElementById('grid-relay');
    var W = 250, H = 170;
    RELAYS.forEach(function (def, i) {
      var rnd0 = rngFor(900 + i);
      var stars = [];
      for (var s = 0; s < 30; s++) stars.push([rnd0() * W, rnd0() * H, 0.4 + rnd0(), 0.05 + rnd0() * 0.25]);
      var blobs = [];
      for (var b = 0; b < 3; b++) {
        blobs.push([W / 2 + (rnd0() - 0.5) * 90, H / 2 + (rnd0() - 0.5) * 50, 42 + rnd0() * 30]);
      }
      addCard(grid, 'relay', i, i + 1, def[0], null, W, H, function (c, w, h, t) {
        c.fillStyle = INK; c.fillRect(0, 0, w, h);
        stars.forEach(function (st) {
          c.fillStyle = alphaCol(TH.starColour, st[3]);
          c.fillRect(st[0], st[1], st[2], st[2]);
        });
        if (relS.nebula > 0.02) {
          blobs.forEach(function (bl) {
            var g = c.createRadialGradient(bl[0], bl[1], 4, bl[0], bl[1], bl[2]);
            g.addColorStop(0, 'hsla(268,55%,60%,' + 0.18 * relS.nebula + ')');
            g.addColorStop(1, 'hsla(268,55%,60%,0)');
            c.fillStyle = g;
            c.beginPath(); c.arc(bl[0], bl[1], bl[2], 0, 6.29); c.fill();
          });
        }
        var col = colFor(relS, i);
        c.strokeStyle = alphaCol(col, 0.3); // the corridor on its way through
        c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0, h * 0.55); c.lineTo(w, h * 0.5); c.stroke();
        c.save();
        c.translate(w / 2, h * 0.52);
        var sc = relS.scale;
        c.scale(sc, sc);
        def[1]({ c: c, r: 14, col: col, t: t * relS.rate, S: relS });
        c.restore();
      });
    });
  }

  // ================================================================
  // PLATE IV — letterforms
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
  var typeCards = [];

  function applyTypeSettings() {
    var plate = document.getElementById('plate-type');
    plate.style.setProperty('--pb-track', typeS.track + 'em');
    plate.style.setProperty('--pb-body', typeS.body + 'px');
  }

  // ================================================================
  // selection, persistence & the requisition docket
  // ================================================================
  var sel = { cor: null, ship: null, relay: null, type: null };
  var STORE = 'cw_patternbook_v1';

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
    put('pick-ship', sel.ship != null ? 'No. ' + (sel.ship + 1) + ' ' + HULLS[Math.floor(sel.ship / 3)][0] +
      ' · ' + LADINGS[sel.ship % 3] : null);
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
      docket: 'C&W Pattern Book requisition',
      corridor: sel.cor == null ? null : {
        no: sel.cor + 1, name: CORRIDORS[sel.cor][0], settings: corS,
      },
      vessel: sel.ship == null ? null : {
        no: sel.ship + 1, hull: HULLS[Math.floor(sel.ship / 3)][0],
        lading: LADINGS[sel.ship % 3], settings: shipS,
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
  slider(ctlCor, corS, 'weight', 'Weight', 0.4, 3, 0.05);
  slider(ctlCor, corS, 'glow', 'Glow', 0, 3, 0.1);
  slider(ctlCor, corS, 'alpha', 'Presence', 0.2, 1, 0.05);
  slider(ctlCor, corS, 'speed', 'Flow', 0, 3, 0.1);
  slider(ctlCor, corS, 'density', 'Density', 0.4, 2.5, 0.05);
  swatches(ctlCor, corS);

  var ctlShip = document.getElementById('ctl-ship');
  slider(ctlShip, shipS, 'scale', 'Hull size', 0.6, 1.6, 0.05);
  slider(ctlShip, shipS, 'orbit', 'Orbit radius', 0.6, 1.8, 0.05);
  slider(ctlShip, shipS, 'pace', 'Orbit pace', 0, 2.5, 0.05);
  slider(ctlShip, shipS, 'crate', 'Crate size', 0.6, 1.6, 0.05);
  slider(ctlShip, shipS, 'ring', 'Orbit line', 0, 1, 0.05);
  slider(ctlShip, shipS, 'livery', 'Livery (steel → paint)', 0, 1, 0.05);
  slider(ctlShip, shipS, 'exhaust', 'Exhaust', 0, 2, 0.1);
  swatches(ctlShip, shipS);

  var ctlRelay = document.getElementById('ctl-relay');
  slider(ctlRelay, relS, 'scale', 'Size', 0.6, 2, 0.05);
  slider(ctlRelay, relS, 'rate', 'Signal rate', 0.2, 2.5, 0.05);
  slider(ctlRelay, relS, 'bright', 'Lamp brightness', 0.3, 2, 0.05);
  slider(ctlRelay, relS, 'nebula', 'Weather', 0, 1, 0.05);
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
