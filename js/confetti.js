/* ============================================================
   SKETCHDUEL confetti: chunky in-palette PIXEL confetti (no round
   particles, no blur - stays on-brand). Fires a burst from the
   centre on a correct guess. Self-contained full-screen canvas.
   Respects prefers-reduced-motion (skips the burst).
   ============================================================ */
window.SD = window.SD || {};

SD.confetti = (function () {
  var COLORS = ["#ffd400", "#f2f2e9", "#8a7500"];
  var canvas, ctx, raf = null, parts = [], w = 0, h = 0, dpr = 1;

  function ensure() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "confetti-layer";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;z-index:8200;pointer-events:none;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    window.addEventListener("resize", size);
    size();
  }

  function size() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function spawn(n) {
    var cx = w / 2, cy = h * 0.42;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 4 + Math.random() * 11;
      var px = 4 + Math.floor(Math.random() * 4) * 2;  // 4-10px, even sizes
      parts.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 6,          // biased upward on burst
        size: px,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
        spin: Math.random() < 0.5,            // squashes W/H to fake tumble
        flip: 0
      });
    }
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    var alive = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.life <= 0) continue;
      alive++;
      p.vy += 0.45;               // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.012;
      p.flip = (p.flip + 1) % 8;
      // stepped tumble: alternate a thin/full square (8-bit spin)
      var sw = p.spin && p.flip < 4 ? Math.max(2, p.size / 2) : p.size;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      ctx.fillStyle = p.color;
      // snap to whole pixels so it reads crisp
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sw, p.size);
    }
    ctx.globalAlpha = 1;
    if (alive > 0 && parts.length < 4000) {
      raf = requestAnimationFrame(frame);
    } else {
      parts.length = 0;
      ctx.clearRect(0, 0, w, h);
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  return {
    burst: function () {
      var reduce = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;
      ensure();
      size();
      spawn(160);
      // second wave for a fuller blast
      setTimeout(function () { spawn(90); }, 130);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    clear: function () {
      parts.length = 0;
      if (ctx) ctx.clearRect(0, 0, w, h);
      cancelAnimationFrame(raf);
      raf = null;
    }
  };
})();
