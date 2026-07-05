/* ui.js — DOM layer: HUD, memoranda, the Ship's Manifest, toasts and
   the title block. Everything textual speaks with the company voice. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var $ = function (id) { return document.getElementById(id); };
  var ui = {};
  CW.ui = ui;

  var els = {};
  var toastTimer = new Map();
  var lastHudSig = '';
  var tooltipTimer = null;

  // ------------------------------------------------ tiny icon painter
  function iconCanvas(size, draw) {
    var c = document.createElement('canvas');
    var d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * d; c.height = size * d;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    var g = c.getContext('2d');
    g.scale(d, d);
    draw(g, size);
    return c;
  }

  var ICONS = {
    ship: function (g, s) {
      g.fillStyle = '#e9e0c9';
      g.beginPath();
      g.moveTo(s * 0.95, s * 0.5);          // bow
      g.lineTo(s * 0.68, s * 0.32);
      g.lineTo(s * 0.22, s * 0.32);
      g.lineTo(s * 0.14, s * 0.42);
      g.lineTo(s * 0.14, s * 0.58);
      g.lineTo(s * 0.22, s * 0.68);
      g.lineTo(s * 0.68, s * 0.68);
      g.closePath();
      g.fill();
      // exhaust ticks
      g.fillRect(s * 0.02, s * 0.40, s * 0.08, s * 0.06);
      g.fillRect(s * 0.02, s * 0.54, s * 0.08, s * 0.06);
    },
    pod: function (g, s) {
      g.strokeStyle = '#e9e0c9'; g.lineWidth = 2;
      g.strokeRect(s * 0.2, s * 0.3, s * 0.6, s * 0.45);
      g.beginPath(); g.moveTo(s * 0.2, s * 0.5); g.lineTo(s * 0.8, s * 0.5); g.stroke();
    },
    relay: function (g, s) {
      g.strokeStyle = '#e9e0c9'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.12); g.lineTo(s * 0.82, s * 0.5);
      g.lineTo(s * 0.5, s * 0.88); g.lineTo(s * 0.18, s * 0.5);
      g.closePath(); g.stroke();
      g.fillStyle = '#e9e0c9';
      g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.1, 0, 7); g.fill();
    },
    hub: function (g, s) {
      g.strokeStyle = '#e9e0c9'; g.lineWidth = 2;
      g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.2, 0, 7); g.stroke();
      g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.36, 0, 7); g.stroke();
    },
    crate: function (g, s) {
      g.strokeStyle = '#e9e0c9'; g.lineWidth = 2;
      g.strokeRect(s * 0.18, s * 0.18, s * 0.64, s * 0.64);
      g.beginPath();
      g.moveTo(s * 0.18, s * 0.18); g.lineTo(s * 0.82, s * 0.82);
      g.moveTo(s * 0.82, s * 0.18); g.lineTo(s * 0.18, s * 0.82);
      g.stroke();
    },
    corridor: function (g, s) {
      g.strokeStyle = '#e9e0c9'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(s * 0.15, s * 0.7); g.lineTo(s * 0.5, s * 0.35); g.lineTo(s * 0.85, s * 0.55);
      g.stroke();
    },
  };

  function glyphCanvas(typeId, size, mode) {
    return iconCanvas(size, function (g, s) {
      g.lineWidth = 2;
      CW.drawGlyph(g, typeId, s / 2, s / 2, s * 0.36, mode || 'outline', '#e9e0c9');
    });
  }

  // ------------------------------------------------ init
  ui.init = function () {
    els.toasts = $('toasts');
    els.chips = $('corridor-chips');
    els.inv = $('inventory-chips');
    els.clockDay = $('clock-day');
    els.clockRing = $('clock-ring');
    els.score = $('hud-score-n');
    els.tooltip = $('tooltip');
    els.sector = $('tb-sector');

    $('hud-score').prepend(iconCanvas(14, ICONS.crate));

    // start screen
    $('btn-play').addEventListener('click', function () {
      CW.audio.unlock(); CW.audio.play('ui');
      CW.startGame();
    });
    $('btn-manifest').addEventListener('click', function () {
      CW.audio.unlock(); openManifest();
    });
    $('btn-manifest-close').addEventListener('click', closeManifest);

    // hud buttons
    $('btn-pause').addEventListener('click', function () {
      CW.audio.unlock();
      var game = CW.game;
      if (!game) return;
      if (game.phase === 'playing') { game.phase = 'paused'; showScreen('pause-screen'); }
    });
    $('btn-speed').addEventListener('click', function () {
      CW.audio.unlock();
      var game = CW.game;
      if (!game) return;
      game.speed = game.speed === 1 ? CW.config.fastSpeed : 1;
      $('btn-speed').classList.toggle('active', game.speed !== 1);
      CW.audio.play('ui');
    });
    $('btn-sound').addEventListener('click', function () {
      CW.audio.unlock();
      var m = CW.audio.toggleMute();
      $('btn-sound').classList.toggle('muted', m);
      if (!m) CW.audio.play('ui');
    });
    $('btn-sound').classList.toggle('muted', CW.audio.muted);

    // pause menu
    $('btn-resume').addEventListener('click', function () {
      if (CW.game) CW.game.phase = 'playing';
      hideScreen('pause-screen');
      CW.audio.play('ui');
    });
    $('btn-restart').addEventListener('click', function () {
      hideScreen('pause-screen');
      CW.restartGame();
    });
    $('btn-pause-manifest').addEventListener('click', openManifest);

    // game over
    $('btn-again').addEventListener('click', function () {
      hideScreen('gameover-screen');
      CW.restartGame();
    });

    buildManifest();

    // bus wiring
    CW.bus.on('toast', ui.toast);
    CW.bus.on('review', showReview);
    CW.bus.on('gameover', showGameOver);
    CW.bus.on('sound', function (kind) { CW.audio.play(kind); });

    // rotating tagline on the start screen
    var tag = $('start-tagline');
    var ti = Math.floor(Math.random() * CW.TAGLINES.length);
    tag.textContent = CW.TAGLINES[ti];
    setInterval(function () {
      ti = (ti + 1) % CW.TAGLINES.length;
      tag.style.opacity = 0;
      setTimeout(function () { tag.textContent = CW.TAGLINES[ti]; tag.style.opacity = 0.8; }, 400);
    }, 6000);
  };

  // ------------------------------------------------ screens
  function showScreen(id) { $(id).classList.add('visible'); }
  function hideScreen(id) { $(id).classList.remove('visible'); }
  ui.showStart = function () { showScreen('start-screen'); };
  ui.hideStart = function () { hideScreen('start-screen'); };

  function openManifest() { showScreen('manifest-screen'); CW.audio.play('ui'); }
  function closeManifest() {
    hideScreen('manifest-screen');
    CW.audio.play('ui');
  }

  function buildManifest() {
    var grid = $('manifest-grid');
    CW.TYPES.forEach(function (t) {
      var cell = document.createElement('div');
      cell.className = 'manifest-cell';
      cell.appendChild(glyphCanvas(t.id, 46, 'outline'));
      var name = document.createElement('div');
      name.className = 'manifest-name';
      name.textContent = t.name + (t.common ? '' : ' *');
      var quip = document.createElement('div');
      quip.className = 'manifest-quip';
      quip.textContent = CW.MANIFEST[t.id];
      cell.appendChild(name);
      cell.appendChild(quip);
      grid.appendChild(cell);
    });
  }

  // ------------------------------------------------ toasts
  ui.toast = function (msg) {
    var box = els.toasts;
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 500);
    }, 5200);
  };

  // ------------------------------------------------ HUD
  ui.setSector = function (sector) {
    els.sector.textContent = 'ROUTE CHART · SECTOR ' + sector;
  };

  ui.update = function (game) {
    if (!game) return;
    var cfg = CW.config;

    // clock
    var dayFrac = (game.simTime % cfg.dayLengthSec) / cfg.dayLengthSec;
    var dayIdx = (game.day - 1) % 7;
    var week = Math.floor((game.day - 1) / 7) + 1;
    els.clockDay.textContent = 'WK ' + week + ' · ' + CW.WEEKDAYS[dayIdx];
    els.clockRing.style.background =
      'conic-gradient(#c9a227 ' + Math.round(dayFrac * 360) + 'deg, rgba(233,224,201,0.15) 0)';
    els.score.textContent = game.score.delivered;

    // chips — rebuild only when the signature changes
    var sig = [game.inventory.corridorsUnlocked, game.corridors.map(function (c) {
      return c.colourIdx + ':' + c.ships.length;
    }).join(','), game.inventory.ships, game.inventory.pods, game.inventory.relays,
      game.inventory.hubs, CW.assignMode].join('|');
    if (sig === lastHudSig) return;
    lastHudSig = sig;
    rebuildChips(game);
  };

  function rebuildChips(game) {
    var chips = els.chips;
    chips.innerHTML = '';
    var assign = CW.assignMode;

    for (var i = 0; i < game.inventory.corridorsUnlocked; i++) {
      var cor = game.corridors[i] || null;
      var chip = document.createElement('button');
      chip.className = 'chip corridor-chip';
      if (cor) {
        chip.style.borderColor = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;
        chip.style.background = CW.CORRIDOR_COLOURS[cor.colourIdx].hex;
        chip.title = CW.CORRIDOR_COLOURS[cor.colourIdx].name + ' corridor';
        if (cor.ships.length) {
          var n = document.createElement('span');
          n.className = 'chip-count';
          n.textContent = cor.ships.length;
          chip.appendChild(n);
        }
        if (assign === 'ship' || assign === 'pod') chip.classList.add('target');
        (function (corRef) {
          chip.addEventListener('click', function () {
            CW.audio.unlock();
            if (CW.assignMode === 'ship') { game.assignShip(corRef); CW.setAssignMode(null); }
            else if (CW.assignMode === 'pod') { game.assignPod(corRef); CW.setAssignMode(null); }
          });
        })(cor);
      } else {
        chip.classList.add('empty');
        chip.title = 'Corridor available — drag between colonies';
        chip.addEventListener('click', function () {
          ui.toast(CW.toasts.hintDraw);
        });
      }
      chips.appendChild(chip);
    }

    // inventory
    var inv = els.inv;
    inv.innerHTML = '';
    var defs = [
      ['ship', game.inventory.ships, 'Freight vessel — tap, then tap a corridor'],
      ['pod', game.inventory.pods, 'Cargo pod — tap, then tap a corridor'],
      ['hub', game.inventory.hubs, 'Orbital hub — tap, then tap a colony'],
      ['relay', game.inventory.relays, 'Beacon relays (used automatically at nebulae)'],
    ];
    defs.forEach(function (def) {
      var kind = def[0], count = def[1];
      if (count <= 0 && kind !== 'relay') return;
      var chip = document.createElement('button');
      chip.className = 'chip inv-chip';
      chip.title = def[2];
      chip.appendChild(iconCanvas(16, ICONS[kind]));
      var n = document.createElement('span');
      n.className = 'inv-count';
      n.textContent = count;
      chip.appendChild(n);
      if (kind === 'relay') {
        chip.classList.add('passive');
      } else {
        if (CW.assignMode === kind) chip.classList.add('armed');
        chip.addEventListener('click', function () {
          CW.audio.unlock(); CW.audio.play('ui');
          if (count <= 0) return;
          CW.setAssignMode(CW.assignMode === kind ? null : kind);
        });
      }
      inv.appendChild(chip);
    });
  }

  ui.onAssignModeChange = function () { lastHudSig = ''; };

  // ------------------------------------------------ colony tooltip
  ui.showColonyTooltip = function (colony) {
    var t = els.tooltip;
    var type = CW.TYPE_BY_ID[colony.type];
    var pct = Math.round(colony.reserve * 100);
    t.innerHTML = '<b>' + colony.name + '</b>' +
      (type.common ? '' : ' <span class="tt-special">— designated ' + type.name + ' colony</span>') +
      '<br>Requires ' + type.name.toLowerCase() +
      ' · reserve ' + (colony.starve !== null ? 'EXHAUSTED' : pct + '%');
    var p = CW.worldToScreen(colony.x, colony.y);
    t.style.left = Math.round(p.x) + 'px';
    t.style.top = Math.round(p.y - 30) + 'px';
    t.classList.add('visible');
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(ui.hideTooltip, 2600);
  };
  ui.hideTooltip = function () {
    clearTimeout(tooltipTimer);
    els.tooltip.classList.remove('visible');
  };

  // ------------------------------------------------ weekly review
  function showReview(data) {
    $('review-week').textContent = 'Week ' + data.week + ' concluded';
    ui.toast(CW.toasts.weekShip);
    var box = $('review-options');
    box.innerHTML = '';
    data.options.forEach(function (kind) {
      var card = document.createElement('button');
      card.className = 'review-card';
      var icon = document.createElement('div');
      icon.className = 'review-icon';
      if (kind === 'corridor') {
        var game = CW.game;
        var colour = CW.CORRIDOR_COLOURS[game.nextFreeColourIdx()];
        icon.appendChild(iconCanvas(30, ICONS.corridor));
        card.dataset.colour = colour.name;
      } else {
        icon.appendChild(iconCanvas(30, ICONS[kind === 'relay' ? 'relay' : kind]));
      }
      var title = document.createElement('div');
      title.className = 'review-title';
      title.textContent = CW.UPGRADE_TEXT[kind].title;
      var desc = document.createElement('div');
      desc.className = 'review-desc';
      desc.textContent = CW.UPGRADE_TEXT[kind].desc(card.dataset.colour || '');
      card.appendChild(icon); card.appendChild(title); card.appendChild(desc);
      card.addEventListener('click', function () {
        CW.game.chooseUpgrade(kind);
        hideScreen('review-dialog');
      });
      box.appendChild(card);
    });
    showScreen('review-dialog');
  }

  // ------------------------------------------------ game over
  function showGameOver(data) {
    $('go-memo').textContent = CW.gameOverMemo(data.colony.name, data.resource, data.days, data.delivered);
    $('go-days').textContent = data.days;
    $('go-delivered').textContent = data.delivered;
    $('go-best').textContent = data.best.delivered;
    $('go-signoff').textContent = CW.GAMEOVER_SIGNOFF[Math.floor(Math.random() * CW.GAMEOVER_SIGNOFF.length)];
    showScreen('gameover-screen');
  }
})();
