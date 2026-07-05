/* audio.js — a very small synthesiser. The company would not approve
   of anything so vulgar as a soundtrack; these are office noises. */
(function () {
  'use strict';
  window.CW = window.CW || {};

  var ctx = null;
  var master = null;
  var muted = false;
  try { muted = localStorage.getItem('cw_muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return true;
  }

  function note(freq, t0, dur, type, gain, glide) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain || 0.5, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // gentle pentatonic drift so deliveries never get tiresome
  var PENT = [523.25, 587.33, 659.25, 783.99, 880.0];
  var pi = 0;

  var lastPlay = {};

  CW.audio = {
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    get muted() { return muted; },
    toggleMute: function () {
      muted = !muted;
      try { localStorage.setItem('cw_muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    play: function (kind) {
      if (muted || !ensure() || ctx.state !== 'running') return;
      var now = ctx.currentTime;
      var wall = performance.now();
      if (lastPlay[kind] && wall - lastPlay[kind] < 60) return; // de-cluster
      lastPlay[kind] = wall;

      switch (kind) {
        case 'delivery': {
          var f = PENT[pi % PENT.length]; pi++;
          note(f, now, 0.28, 'triangle', 0.32);
          note(f * 2, now + 0.02, 0.18, 'sine', 0.10);
          break;
        }
        case 'pickup':
          note(392, now, 0.07, 'triangle', 0.10);
          break;
        case 'spawn':
          note(587.33, now, 0.2, 'sine', 0.2);
          note(440, now + 0.14, 0.3, 'sine', 0.18);
          break;
        case 'warning':
          note(196, now, 0.35, 'square', 0.10);
          note(185, now + 0.4, 0.35, 'square', 0.10);
          break;
        case 'week':
          note(523.25, now, 0.16, 'triangle', 0.22);
          note(659.25, now + 0.13, 0.16, 'triangle', 0.22);
          note(783.99, now + 0.26, 0.3, 'triangle', 0.24);
          break;
        case 'gameover':
          note(392, now, 0.4, 'triangle', 0.22);
          note(311.13, now + 0.35, 0.45, 'triangle', 0.2);
          note(233.08, now + 0.75, 0.9, 'triangle', 0.2);
          break;
        case 'ui':
          note(880, now, 0.05, 'sine', 0.07);
          break;
      }
    },
  };

  CW.bus && null; // bus wiring happens in main.js after all modules load
})();
