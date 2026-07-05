/* input.js — pointer gestures for corridor editing, in the Mini Metro
   idiom, tuned for both mouse and small touchscreens:

   - drag colony → colony ............ open a new corridor
   - drag a corridor's end nub ....... extend / retract / close a loop
   - drag mid-segment onto a colony .. insert that colony en route
   - drag mid-segment to empty space . break a loop (loops only)
   - long-press a stop, then drag .... reroute or remove that stop
   - long-press an unserved colony ... consult the colony's particulars
*/
(function () {
  'use strict';
  window.CW = window.CW || {};

  var getGame = null;
  var canvas = null;
  var drag = null;
  var pending = null;        // pressed on a colony, undecided yet
  var longTimer = null;
  var activePointer = null;
  var lastRelayToast = 0;
  var hoverTimer = null;

  CW.input = { drag: null };
  CW.assignMode = null;
  CW.setAssignMode = function (mode) {
    CW.assignMode = mode;
    if (CW.ui && CW.ui.onAssignModeChange) CW.ui.onAssignModeChange(mode);
  };

  // ------------------------------------------------- hit testing
  function toWorld(ev) {
    var r = canvas.getBoundingClientRect();
    return CW.screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
  }

  function colonyAt(w, extra) {
    var game = getGame();
    var tol = Math.max(24 / CW.camera.scale, 20) + (extra || 0);
    var best = null, bd = Infinity;
    game.colonies.forEach(function (c) {
      var R = (CW.TYPE_BY_ID[c.type].common ? CW.SIZES.colonyR : CW.SIZES.specialR);
      var t = Math.max(tol, R + 8);
      var dx = c.x - w.x, dy = c.y - w.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < t && d < bd) { bd = d; best = c; }
    });
    return best;
  }

  function nubAt(w) {
    var game = getGame();
    var tol = Math.max(18 / CW.camera.scale, 14);
    for (var i = game.corridors.length - 1; i >= 0; i--) {
      var cor = game.corridors[i];
      var nubs = cor._nubs || [];
      for (var j = 0; j < nubs.length; j++) {
        var dx = nubs[j].x - w.x, dy = nubs[j].y - w.y;
        if (Math.sqrt(dx * dx + dy * dy) < tol) return { corridor: cor, end: nubs[j].end };
      }
    }
    return null;
  }

  function segAt(w) {
    var game = getGame();
    var tol = Math.max(12 / CW.camera.scale, 9);
    for (var i = game.corridors.length - 1; i >= 0; i--) {
      var cor = game.corridors[i];
      var pts = cor.path || [];
      var n = pts.length, count = cor.loop ? n : n - 1;
      for (var s = 0; s < count; s++) {
        var p0 = pts[s], p1 = pts[(s + 1) % n];
        var pr = projSeg(w, p0, p1);
        if (pr.d < tol && pr.t > 0.12 && pr.t < 0.88) return { corridor: cor, segIdx: s };
      }
    }
    return null;
  }

  function projSeg(w, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy || 1;
    var t = Math.max(0, Math.min(1, ((w.x - a.x) * dx + (w.y - a.y) * dy) / len2));
    var x = a.x + t * dx, y = a.y + t * dy;
    return { d: Math.hypot(w.x - x, w.y - y), t: t };
  }

  // ------------------------------------------------- drag bookkeeping
  function termId() { return drag.end === 'head' ? drag.stops[0] : drag.stops[drag.stops.length - 1]; }
  function prevId() { return drag.end === 'head' ? drag.stops[1] : drag.stops[drag.stops.length - 2]; }
  function otherEndId() { return drag.end === 'head' ? drag.stops[drag.stops.length - 1] : drag.stops[0]; }
  function appendStop(id) { if (drag.end === 'head') drag.stops.unshift(id); else drag.stops.push(id); }
  function retractStop() { if (drag.end === 'head') drag.stops.shift(); else drag.stops.pop(); }

  function committedCost() {
    var game = getGame();
    return drag.corridor ? game.stopsCost(drag.corridor.stops, drag.corridor.loop) : 0;
  }
  function relaysAvailable() {
    var game = getGame();
    return game.inventory.relays + committedCost() - game.stopsCost(drag.stops, drag.loop);
  }
  function segCost(aId, bId) {
    var game = getGame();
    return game.segCrossCost(game.colonyById(aId), game.colonyById(bId));
  }
  function segCostToPoint(aId, pt) {
    var game = getGame();
    return game.segCrossCost(game.colonyById(aId), pt);
  }

  function relayRefusal() {
    var now = performance.now();
    if (now - lastRelayToast < 2500) return;
    lastRelayToast = now;
    var game = getGame();
    CW.bus.emit('toast', game.inventory.relays > 0 ? CW.toasts.needRelay : CW.toasts.noRelay);
  }

  // ------------------------------------------------- preview geometry
  function refreshPreview(w) {
    var game = getGame();
    drag.px = w.x; drag.py = w.y;
    var pts, elastics = [];
    if (drag.mode === 'new' || drag.mode === 'extend') {
      pts = drag.stops.map(function (id) { var c = game.colonyById(id); return { x: c.x, y: c.y }; });
      var term = game.colonyById(termId());
      var blocked = segCostToPoint(termId(), w) > relaysAvailable();
      elastics.push({ x0: term.x, y0: term.y, x1: w.x, y1: w.y, blocked: blocked });
      drag.renderStops = pts;
      drag.renderLoop = drag.loop;
    } else if (drag.mode === 'insert') {
      var stops = drag.corridor.stops, n = stops.length;
      var a = drag.segIdx, b = (drag.segIdx + 1) % n;
      pts = [];
      for (var i = 0; i <= a; i++) { var c1 = game.colonyById(stops[i]); pts.push({ x: c1.x, y: c1.y }); }
      pts.push({ x: w.x, y: w.y });
      for (var j = b; j < n; j++) { var c2 = game.colonyById(stops[j]); pts.push({ x: c2.x, y: c2.y }); }
      drag.renderStops = pts;
      drag.renderLoop = drag.corridor.loop;
    } else if (drag.mode === 'bypass') {
      var st = drag.corridor.stops;
      pts = st.map(function (id, idx) {
        if (idx === drag.stopIdx) return { x: w.x, y: w.y };
        var c3 = game.colonyById(id); return { x: c3.x, y: c3.y };
      });
      drag.renderStops = pts;
      drag.renderLoop = drag.corridor.loop;
    }
    drag.elastics = elastics;
  }

  // ------------------------------------------------- drag handlers
  function startNewCorridor(colony, w) {
    var game = getGame();
    if (!game.canStartCorridor()) { CW.bus.emit('toast', CW.toasts.noCorridor); return false; }
    drag = {
      mode: 'new', corridor: null, end: 'tail',
      stops: [colony.id], loop: false,
      colourIdx: game.nextFreeColourIdx(),
    };
    CW.input.drag = drag;
    CW.inputActive = true;
    refreshPreview(w);
    return true;
  }

  function startExtend(hit, w) {
    drag = {
      mode: 'extend', corridor: hit.corridor, end: hit.end,
      stops: hit.corridor.stops.slice(), loop: false,
      colourIdx: hit.corridor.colourIdx,
    };
    CW.input.drag = drag;
    CW.inputActive = true;
    refreshPreview(w);
  }

  function startInsert(hit, w) {
    drag = {
      mode: 'insert', corridor: hit.corridor, segIdx: hit.segIdx,
      stops: hit.corridor.stops.slice(), loop: hit.corridor.loop,
      colourIdx: hit.corridor.colourIdx, candidate: null,
    };
    CW.input.drag = drag;
    CW.inputActive = true;
    refreshPreview(w);
  }

  function startBypass(colony, w) {
    var game = getGame();
    var owner = null, stopIdx = -1;
    for (var i = game.corridors.length - 1; i >= 0 && !owner; i--) {
      var idx = game.corridors[i].stops.indexOf(colony.id);
      if (idx >= 0) { owner = game.corridors[i]; stopIdx = idx; }
    }
    if (!owner) return false;
    drag = {
      mode: 'bypass', corridor: owner, stopIdx: stopIdx,
      stops: owner.stops.slice(), loop: owner.loop,
      colourIdx: owner.colourIdx, candidate: null, origin: colony,
    };
    CW.input.drag = drag;
    CW.inputActive = true;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    refreshPreview(w);
    return true;
  }

  function moveDrag(w) {
    var game = getGame();
    if (drag.mode === 'new' || drag.mode === 'extend') {
      var c = colonyAt(w);
      if (c) {
        if (c.id === termId()) { /* resting on terminus */ }
        else if (drag.stops.length >= 2 && c.id === prevId()) {
          retractStop();          // dragging back retracts
        } else if (drag.stops.length >= 3 && c.id === otherEndId() && !drag.loop) {
          // close the loop and finish immediately
          if (segCost(termId(), c.id) <= relaysAvailable()) {
            drag.loop = true;
            finishDrag();
            return;
          } else relayRefusal();
        } else if (drag.stops.indexOf(c.id) === -1) {
          var wouldBe = drag.stops.slice();
          if (drag.end === 'head') wouldBe.unshift(c.id); else wouldBe.push(c.id);
          var need = game.stopsCost(wouldBe, false) - committedCost();
          if (need <= game.inventory.relays) appendStop(c.id);
          else relayRefusal();
        }
      }
    } else if (drag.mode === 'insert') {
      var cand = colonyAt(w);
      if (cand && drag.corridor.stops.indexOf(cand.id) !== -1) cand = null;
      if (cand) {
        var stops = drag.corridor.stops, n = stops.length;
        var a = stops[drag.segIdx], b = stops[(drag.segIdx + 1) % n];
        var need2 = segCost(a, cand.id) + segCost(cand.id, b) - segCost(a, b);
        if (need2 > game.inventory.relays) { relayRefusal(); cand = null; }
      }
      drag.candidate = cand;
    } else if (drag.mode === 'bypass') {
      var cand2 = colonyAt(w);
      if (cand2 && (cand2.id === drag.origin.id || drag.corridor.stops.indexOf(cand2.id) !== -1)) cand2 = null;
      if (cand2) {
        var trial = drag.corridor.stops.slice();
        trial[drag.stopIdx] = cand2.id;
        var need3 = game.stopsCost(trial, drag.corridor.loop) - committedCost();
        if (need3 > game.inventory.relays) { relayRefusal(); cand2 = null; }
      }
      drag.candidate = cand2;
    }
    refreshPreview(w);
  }

  function finishDrag() {
    var game = getGame();
    var d = drag;
    drag = null;
    CW.input.drag = null;
    CW.inputActive = false;
    if (!d) return;

    if (d.mode === 'new') {
      if (d.stops.length >= 2) game.commitCorridorEdit(null, d.stops, d.loop);
    } else if (d.mode === 'extend') {
      game.commitCorridorEdit(d.corridor, d.stops, d.loop || d.corridor.loop && d.stops.length >= 3);
    } else if (d.mode === 'insert') {
      if (d.candidate) {
        var stops = d.corridor.stops.slice();
        stops.splice(d.segIdx + 1, 0, d.candidate.id);
        game.commitCorridorEdit(d.corridor, stops, d.corridor.loop);
      } else if (d.corridor.loop) {
        // released on empty space: break the loop at this segment
        var st = d.corridor.stops, n = st.length;
        var reordered = [];
        for (var i = 0; i < n; i++) reordered.push(st[(d.segIdx + 1 + i) % n]);
        game.commitCorridorEdit(d.corridor, reordered, false);
      }
    } else if (d.mode === 'bypass') {
      if (d.candidate) {
        var s2 = d.corridor.stops.slice();
        s2[d.stopIdx] = d.candidate.id;
        game.commitCorridorEdit(d.corridor, s2, d.corridor.loop);
      } else {
        // far from home = remove the stop; near home = never mind
        var dx = d.px - d.origin.x, dy = d.py - d.origin.y;
        if (Math.hypot(dx, dy) > Math.max(34, 30 / CW.camera.scale)) {
          var s3 = d.corridor.stops.slice();
          s3.splice(d.stopIdx, 1);
          var keepLoop = d.corridor.loop && s3.length >= 3;
          game.commitCorridorEdit(d.corridor, s3, keepLoop);
        }
      }
    }
  }

  function cancelDrag() {
    drag = null;
    CW.input.drag = null;
    CW.inputActive = false;
  }

  // ------------------------------------------------- assign-mode taps
  function handleAssignTap(w) {
    var game = getGame();
    var mode = CW.assignMode;
    if (mode === 'hub') {
      var c = colonyAt(w, 6);
      if (c && game.placeHub(c)) { CW.setAssignMode(null); return true; }
      CW.setAssignMode(null);
      return true;
    }
    if (mode === 'ship' || mode === 'pod') {
      var hit = segAt(w) || (function () {
        // also accept a tap near any stop of a corridor
        var c2 = colonyAt(w);
        if (!c2) return null;
        for (var i = game.corridors.length - 1; i >= 0; i--) {
          if (game.corridors[i].stops.indexOf(c2.id) !== -1) return { corridor: game.corridors[i] };
        }
        return null;
      })();
      if (hit) {
        if (mode === 'ship') game.assignShip(hit.corridor);
        else game.assignPod(hit.corridor);
      }
      CW.setAssignMode(null);
      return true;
    }
    return false;
  }

  // ------------------------------------------------- events
  function onDown(ev) {
    var game = getGame();
    if (!game || game.phase !== 'playing') return;
    if (activePointer !== null) return;      // one finger drives the chart
    activePointer = ev.pointerId;
    canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
    if (CW.ui && CW.ui.hideTooltip) CW.ui.hideTooltip();

    var w = toWorld(ev);

    if (CW.assignMode) { handleAssignTap(w); return; }

    var nub = nubAt(w);
    if (nub) { startExtend(nub, w); return; }

    var colony = colonyAt(w);
    if (colony) {
      pending = { colony: colony, sx: ev.clientX, sy: ev.clientY, w: w, alt: ev.altKey || ev.button === 2 };
      if (pending.alt) { pending = null; startBypass(colony, w) || startNewCorridor(colony, w); return; }
      longTimer = setTimeout(function () {
        if (!pending) return;
        var p = pending; pending = null;
        if (!startBypass(p.colony, p.w)) {
          if (CW.ui && CW.ui.showColonyTooltip) CW.ui.showColonyTooltip(p.colony);
        }
      }, 430);
      return;
    }

    var seg = segAt(w);
    if (seg) { startInsert(seg, w); return; }
  }

  function onMove(ev) {
    if (ev.pointerId !== activePointer) {
      // idle hover → colony particulars tooltip (desktop nicety)
      if (activePointer === null && ev.pointerType === 'mouse' && getGame() && getGame().phase === 'playing') {
        clearTimeout(hoverTimer);
        var w0 = toWorld(ev);
        hoverTimer = setTimeout(function () {
          var c = colonyAt(w0);
          if (c && CW.ui && CW.ui.showColonyTooltip && !drag) CW.ui.showColonyTooltip(c);
          else if (CW.ui && CW.ui.hideTooltip) CW.ui.hideTooltip();
        }, 300);
      }
      return;
    }
    var w = toWorld(ev);
    if (pending) {
      var moved = Math.hypot(ev.clientX - pending.sx, ev.clientY - pending.sy);
      if (moved > 8) {
        var p = pending; pending = null;
        clearTimeout(longTimer);
        startNewCorridor(p.colony, w);
      }
    }
    if (drag) moveDrag(w);
  }

  function onUp(ev) {
    if (ev.pointerId !== activePointer) return;
    activePointer = null;
    clearTimeout(longTimer);
    pending = null;
    if (drag) finishDrag();
  }

  function onCancel(ev) {
    if (ev.pointerId !== activePointer) return;
    activePointer = null;
    clearTimeout(longTimer);
    pending = null;
    cancelDrag();
  }

  CW.initInput = function (canvasEl, gameGetter) {
    canvas = canvasEl;
    getGame = gameGetter;
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        cancelDrag();
        CW.setAssignMode(null);
      }
    });
  };

  CW.cancelInput = function () { cancelDrag(); pending = null; activePointer = null; };
})();
