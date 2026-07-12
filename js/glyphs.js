/* glyphs.js — the ten cargo glyphs, drawn as canvas vector paths.
   Each glyph is defined in a unit space of radius 1 and scaled at draw
   time. Shape does the identification work, never colour: colonies are
   large OUTLINED glyphs, crates are small SOLID glyphs. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  // Each builder traces a path into ctx for a glyph of nominal radius r,
  // centred on (0,0). Caller handles translate/stroke/fill.
  var P = {};

  P.water = function (ctx, r) { // droplet
    var w = r * 0.72, h = r * 1.05;
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w * 0.16, -h * 0.5, w, -h * 0.18, w, h * 0.28);
    ctx.arc(0, h * 0.28, w, 0, Math.PI, false);
    ctx.bezierCurveTo(-w, -h * 0.18, -w * 0.16, -h * 0.5, 0, -h);
    ctx.closePath();
  };

  // slim pointed lozenge from (x0,y0) to (x1,y1), half-width w
  function grain(ctx, x0, y0, x1, y1, w) {
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = -dy / len * w, py = dx / len * w;
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx + px, my + py, x1, y1);
    ctx.quadraticCurveTo(mx - px, my - py, x0, y0);
    ctx.closePath();
  }

  P.food = function (ctx, r) { // ear of wheat (solid form: chunky sheaf)
    // stem
    ctx.moveTo(-r * 0.06, r * 1.05);
    ctx.lineTo(-r * 0.06, 0);
    ctx.lineTo(r * 0.06, 0);
    ctx.lineTo(r * 0.06, r * 1.05);
    ctx.closePath();
    // grain pairs, well separated so they never merge into a blob
    for (var i = 0; i < 3; i++) {
      var yb = 0.30 * r - i * 0.45 * r;
      grain(ctx, -r * 0.06, yb, -r * 0.62, yb - r * 0.42, r * 0.20);
      grain(ctx, r * 0.06, yb, r * 0.62, yb - r * 0.42, r * 0.20);
    }
    // crowning grain
    grain(ctx, 0, -r * 0.62, 0, -r * 1.1, r * 0.18);
  };

  // line-art variant used at colony scale, where stroked lozenges
  // would fuse under the outline width
  P.foodLines = function (ctx, r) {
    ctx.moveTo(0, r * 1.05);
    ctx.lineTo(0, -r * 0.55);
    for (var i = 0; i < 3; i++) {
      var yb = 0.30 * r - i * 0.45 * r;
      ctx.moveTo(0, yb);
      ctx.lineTo(-r * 0.60, yb - r * 0.45);
      ctx.moveTo(0, yb);
      ctx.lineTo(r * 0.60, yb - r * 0.45);
    }
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(0, -r * 1.08);
  };

  P.energy = function (ctx, r) { // lightning bolt
    var s = r * 1.1;
    ctx.moveTo(s * 0.32, -s);
    ctx.lineTo(-s * 0.42, s * 0.12);
    ctx.lineTo(-s * 0.04, s * 0.12);
    ctx.lineTo(-s * 0.32, s);
    ctx.lineTo(s * 0.42, -s * 0.14);
    ctx.lineTo(s * 0.04, -s * 0.14);
    ctx.closePath();
  };

  P.minerals = function (ctx, r) { // flat ingot hexagon
    var w = r * 1.05, h = r * 0.72;
    ctx.moveTo(-w * 0.55, -h);
    ctx.lineTo(w * 0.55, -h);
    ctx.lineTo(w, 0);
    ctx.lineTo(w * 0.55, h);
    ctx.lineTo(-w * 0.55, h);
    ctx.lineTo(-w, 0);
    ctx.closePath();
  };

  P.machinery = function (ctx, r) { // gear: 8 teeth + centre hole
    var teeth = 8, ro = r * 1.06, ri = r * 0.76, half = Math.PI / teeth * 0.52;
    for (var i = 0; i < teeth; i++) {
      var a = (i / teeth) * Math.PI * 2;
      var a0 = a - half, a1 = a + half;
      var b0 = a + Math.PI / teeth - half, b1 = a + Math.PI / teeth + half;
      if (i === 0) ctx.moveTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
      ctx.lineTo(Math.cos(a1) * ro, Math.sin(a1) * ro);
      ctx.lineTo(Math.cos(b0) * ri, Math.sin(b0) * ri);
      ctx.lineTo(Math.cos(b1) * ri, Math.sin(b1) * ri);
      var n0 = a + 2 * Math.PI / teeth - half;
      ctx.lineTo(Math.cos(n0) * ro, Math.sin(n0) * ro);
    }
    ctx.closePath();
    // centre hole (evenodd)
    ctx.moveTo(r * 0.34, 0);
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2, true);
    ctx.closePath();
  };

  P.medicine = function (ctx, r) { // cross
    var a = r * 0.36, b = r * 1.0;
    ctx.moveTo(-a, -b); ctx.lineTo(a, -b); ctx.lineTo(a, -a);
    ctx.lineTo(b, -a); ctx.lineTo(b, a); ctx.lineTo(a, a);
    ctx.lineTo(a, b); ctx.lineTo(-a, b); ctx.lineTo(-a, a);
    ctx.lineTo(-b, a); ctx.lineTo(-b, -a); ctx.lineTo(-a, -a);
    ctx.closePath();
  };

  P.knowledge = function (ctx, r) { // open book
    var w = r * 1.08, h = r * 0.78, sag = r * 0.22;
    ctx.moveTo(0, -h * 0.55);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.95, w, -h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.quadraticCurveTo(w * 0.5, h * 0.15, 0, h * 0.55 + sag * 0.2);
    ctx.quadraticCurveTo(-w * 0.5, h * 0.15, -w, h * 0.55);
    ctx.lineTo(-w, -h * 0.55);
    ctx.quadraticCurveTo(-w * 0.5, -h * 0.95, 0, -h * 0.55);
    ctx.closePath();
  };

  P.culture = function (ctx, r) { // theatre mask, simplified: oval + two eye holes
    var w = r * 0.82, h = r * 1.02;
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(w, -h, w, h * 0.4, 0, h);
    ctx.bezierCurveTo(-w, h * 0.4, -w, -h, 0, -h);
    ctx.closePath();
    // eye holes (evenodd)
    var ey = -h * 0.22, ew = w * 0.30, eh = h * 0.16, ex = w * 0.42;
    [-1, 1].forEach(function (s) {
      ctx.moveTo(s * ex + ew, ey);
      ctx.ellipse(s * ex, ey, ew, eh, 0, 0, Math.PI * 2);
      ctx.closePath();
    });
    // mouth slot
    ctx.moveTo(w * 0.30, h * 0.42);
    ctx.ellipse(0, h * 0.42, w * 0.30, h * 0.13, 0, 0, Math.PI * 2);
    ctx.closePath();
  };

  P.biology = function (ctx, r) { // seed with a single sprout leaf
    var w = r * 0.62, h = r * 0.55;
    // seed body (fat teardrop lying low)
    ctx.moveTo(-w, h * 0.5);
    ctx.bezierCurveTo(-w, -h * 0.7, w * 0.9, -h * 0.9, w, h * 0.1);
    ctx.bezierCurveTo(w, h * 1.0, -w * 0.4, h * 1.15, -w, h * 0.5);
    ctx.closePath();
    // sprout: stem + leaf
    ctx.moveTo(-r * 0.02, -h * 0.55);
    ctx.quadraticCurveTo(r * 0.08, -r * 0.75, r * 0.02, -r * 1.02);
    ctx.quadraticCurveTo(r * 0.5, -r * 1.0, r * 0.55, -r * 0.62);
    ctx.quadraticCurveTo(r * 0.22, -r * 0.5, r * 0.12, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.14, -r * 0.6, r * 0.12, -h * 0.55);
    ctx.closePath();
  };

  P.luxuries = function (ctx, r) { // faceted gem: table + pavilion
    var w = r * 1.0, h = r * 0.95;
    ctx.moveTo(-w * 0.55, -h * 0.55);
    ctx.lineTo(w * 0.55, -h * 0.55);
    ctx.lineTo(w, -h * 0.05);
    ctx.lineTo(0, h);
    ctx.lineTo(-w, -h * 0.05);
    ctx.closePath();
  };

  CW.GLYPH_PATHS = P;

  /* Draw a glyph.
     mode 'outline' -> colony node (stroked)
     mode 'solid'   -> crate (filled, evenodd so holes read); optional
                       bold strokes the fill outward to fatten it      */
  CW.drawGlyph = function (ctx, typeId, x, y, r, mode, style, bold) {
    var fn = P[typeId];
    if (typeId === 'food' && mode !== 'solid') fn = P.foodLines;
    if (!fn) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    fn(ctx, r);
    if (mode === 'solid') {
      ctx.fillStyle = style;
      ctx.fill('evenodd');
      if (bold > 0) {
        ctx.strokeStyle = style;
        ctx.lineWidth = bold;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = style;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  };

  // Facet detail lines for the gem / spine for the book, drawn only at
  // colony scale where they can actually be seen.
  CW.drawGlyphDetail = function (ctx, typeId, x, y, r, style) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = style;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.beginPath();
    if (typeId === 'luxuries') {
      var w = r * 1.0, h = r * 0.95;
      ctx.moveTo(-w * 0.55, -h * 0.55); ctx.lineTo(-w * 0.3, -h * 0.05);
      ctx.lineTo(0, h);
      ctx.moveTo(w * 0.55, -h * 0.55); ctx.lineTo(w * 0.3, -h * 0.05);
      ctx.lineTo(0, h);
      ctx.moveTo(-w, -h * 0.05); ctx.lineTo(w, -h * 0.05);
    } else if (typeId === 'knowledge') {
      ctx.moveTo(0, -r * 0.43); ctx.lineTo(0, r * 0.6);
    } else {
      ctx.restore();
      return;
    }
    ctx.stroke();
    ctx.restore();
  };
})();
