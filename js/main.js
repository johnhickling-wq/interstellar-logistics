/* main.js — assembly and the main loop. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var canvas;
  var lastT = 0;

  function newGame() {
    CW.game = CW.createGame();
    CW.game.phase = 'paused';
    CW.resetCamera();
    CW.remakeStars();
    CW.cancelInput && CW.cancelInput();
    CW.setAssignMode(null);
    CW.ui.setSector(CW.game.sector);
    return CW.game;
  }

  CW.startGame = function () {
    CW.ui.hideStart();
    CW.game.phase = 'playing';
  };

  CW.restartGame = function () {
    newGame();
    CW.game.phase = 'playing';
  };

  function loop(t) {
    var dt = Math.min((t - lastT) / 1000, 0.1) || 0.016;
    lastT = t;
    var game = CW.game;
    if (game) {
      try {
        game.update(dt);
        CW.renderFrame(game, dt, t / 1000);
        CW.ui.update(game);
      } catch (err) {
        // one bad frame must never stop the service
        if (window.console) console.error(err);
      }
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', function () {
    canvas = document.getElementById('game');
    CW.initRenderer(canvas);
    CW.ui.init();
    CW.initInput(canvas, function () { return CW.game; });
    CW.initDevPanel(document.getElementById('brand-mark'));

    newGame();
    CW.ui.showStart();

    window.addEventListener('resize', CW.resizeRenderer);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && CW.game && CW.game.phase === 'playing') {
        CW.game.phase = 'paused';
        document.getElementById('pause-screen').classList.add('visible');
      }
    });
    // keyboard conveniences
    window.addEventListener('keydown', function (e) {
      if (!CW.game) return;
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        var g = CW.game;
        if (g.phase === 'playing') { g.phase = 'paused'; document.getElementById('pause-screen').classList.add('visible'); }
        else if (g.phase === 'paused') { g.phase = 'playing'; document.getElementById('pause-screen').classList.remove('visible'); }
      }
    });

    requestAnimationFrame(loop);
  });

  // ---------------------------------------------------------------
  // Debug hooks — used by automated smoke tests and the Tuning Office.
  CW.debug = {
    colonyScreen: function (i) {
      var c = CW.game.colonies[i];
      var r = canvas.getBoundingClientRect();
      var p = CW.worldToScreen(c.x, c.y);
      return { x: p.x + r.left, y: p.y + r.top, id: c.id, type: c.type };
    },
    nubScreen: function (corIdx, end) {
      var cor = CW.game.corridors[corIdx];
      var nub = (cor._nubs || []).filter(function (n) { return n.end === end; })[0];
      if (!nub) return null;
      var r = canvas.getBoundingClientRect();
      var p = CW.worldToScreen(nub.x, nub.y);
      return { x: p.x + r.left, y: p.y + r.top };
    },
    setTimeScale: function (v) { CW.game.cheatTimeScale = v; },
  };
})();
