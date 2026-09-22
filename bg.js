/* Greenwich Works — the moving ground.
   -----------------------------------------------------------------------
   Contour lines, the way a survey sheet draws ground it has walked over.
   That is the picture the programme is actually making: a hundred and
   seventy-two teams, each on its own patch of Karachi, and the lines only
   mean something once somebody has been out there.

   It is one canvas, a few dozen strokes a frame, and it stops the moment
   nobody is looking at it. No library, no images, no network.

   It refuses to run at all when:
     · the reader has asked their device for less motion
     · the connection reports itself as 2g/slow-2g, or data saver is on
     · the device has very few cores, which on a phone means a cheap phone
   In every one of those cases the band is still painted, still the right
   colour, just still.                                                     */
(function () {
  'use strict';

  var LINES = 15;          // contours across the band
  var STEP = 14;           // px between sample points along a line
  var FPS = 30;            // plenty for something this slow

  function calm() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) {
        if (c.saveData) return true;
        if (/^(slow-)?2g$/.test(c.effectiveType || '')) return true;
      }
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return true;
    } catch (e) { /* if we cannot tell, assume it is fine */ }
    return false;
  }

  /* One field, sampled by every line, so the whole band moves as one piece
     of ground rather than as fifteen unrelated ribbons. */
  function height(x, y, t) {
    return Math.sin(x * 0.0071 + t * 0.19 + y * 0.9) * 15
         + Math.sin(x * 0.0130 - t * 0.13 + y * 1.7) * 8
         + Math.sin(x * 0.0032 + t * 0.28 - y * 2.3) * 21
         + Math.sin(x * 0.0210 + t * 0.09) * 4;
  }

  function attach(host, opts) {
    opts = opts || {};
    var dark = opts.dark !== false;
    var still = calm();

    var cv = document.createElement('canvas');
    cv.className = 'bgc';
    cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild);
    var ctx = cv.getContext('2d', { alpha: true });

    var w = 0, h = 0, dpr = 1, raf = 0, last = 0, t = Math.random() * 400, alive = true;

    function size() {
      var r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function paint() {
      ctx.clearRect(0, 0, w, h);

      /* two soft pools of light, drifting at different speeds */
      var glow = [
        [w * (0.24 + 0.13 * Math.sin(t * 0.11)), h * (0.34 + 0.20 * Math.cos(t * 0.09)), Math.max(w, h) * 0.42],
        [w * (0.79 + 0.10 * Math.cos(t * 0.07)), h * (0.66 + 0.16 * Math.sin(t * 0.12)), Math.max(w, h) * 0.34]
      ];
      for (var g = 0; g < glow.length; g++) {
        var rg = ctx.createRadialGradient(glow[g][0], glow[g][1], 0, glow[g][0], glow[g][1], glow[g][2]);
        rg.addColorStop(0, dark ? 'rgba(46,138,126,0.30)' : 'rgba(30,107,99,0.14)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }

      /* the contours */
      var gap = h / (LINES - 1);
      ctx.lineWidth = 1;
      for (var i = 0; i < LINES; i++) {
        var yn = i / (LINES - 1);
        var base = yn * h;
        /* lines nearer the middle of the band read strongest */
        var near = 1 - Math.abs(yn - 0.5) * 1.5;
        var a = (dark ? 0.34 : 0.20) * Math.max(0.12, near);
        ctx.strokeStyle = dark ? 'rgba(120,205,192,' + a.toFixed(3) + ')'
                               : 'rgba(30,107,99,' + a.toFixed(3) + ')';
        ctx.beginPath();
        for (var x = -STEP; x <= w + STEP; x += STEP) {
          var y = base + height(x, yn, t) * (0.55 + near * 0.75);
          if (x <= 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      /* a scatter of survey marks sitting on the ground */
      var marks = Math.min(26, Math.round(w / 46));
      for (var m = 0; m < marks; m++) {
        var mx = ((m * 137.5) % 100) / 100 * w;
        var myn = ((m * 61.8) % 100) / 100;
        var my = myn * h + height(mx, myn, t) * 0.9;
        var pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + m);
        ctx.fillStyle = dark ? 'rgba(160,222,211,' + (0.10 + pulse * 0.30).toFixed(3) + ')'
                             : 'rgba(30,107,99,' + (0.08 + pulse * 0.20).toFixed(3) + ')';
        ctx.fillRect(mx - 1, my - 1, 2.4, 2.4);
      }
    }

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      t += (now - last) / 1000;
      last = now;
      paint();
    }

    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function go() { if (!raf && !still && alive) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    size(); paint();
    if (!still) go();

    var ro = window.ResizeObserver ? new ResizeObserver(function () { size(); paint(); }) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', function () { size(); paint(); });

    /* a tab nobody is looking at should not be drawing */
    function vis() { if (document.hidden) stop(); else go(); }
    document.addEventListener('visibilitychange', vis);

    return {
      destroy: function () {
        alive = false; stop();
        document.removeEventListener('visibilitychange', vis);
        if (ro) ro.disconnect();
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      }
    };
  }

  window.GW_BG = { attach: attach, calm: calm };
})();
