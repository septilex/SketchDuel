/* ============================================================
   SKETCH.DUEL cursor trail: chunky BLACK pixel squares that fade
   out behind the pointer. Decorative only - the real cursor stays
   native (zero-lag); this canvas is pointer-events:none.
   - spawns are paced by requestAnimationFrame (not the raw move
     event), so a fast flick can't flood it
   - skips the drawing canvas so sketching stays clean
   - respects prefers-reduced-motion
   ============================================================ */
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var BLACK = "#0a0a08", EDGE = "#8a7500";
  var SIZE = 8;                 // even -> crisp
  var STEP = 10;                // min px moved before a new square
  var FADE = 0.05;              // lower -> longer tail
  var MAX = 28;

  var canvas, ctx, dpr = 1, vw = 0, vh = 0;
  var parts = [];
  var mx = 0, my = 0, lastSpawnX = -999, lastSpawnY = -999, moved = false, overPad = false;
  var raf = null;

  function build() {
    canvas = document.createElement("canvas");
    canvas.id = "cursor-trail";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;z-index:8050;pointer-events:none;image-rendering:pixelated;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    size();
    window.addEventListener("resize", size);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function onMove(e) {
    mx = e.clientX; my = e.clientY; moved = true;
    // don't litter the sketchpad
    var t = e.target;
    overPad = !!(t && (t.id === "pad" || (t.closest && t.closest("#pad"))));
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function spawn(x, y) {
    // snap to a 2px grid for that 8-bit feel
    parts.push({ x: Math.round(x / 2) * 2, y: Math.round(y / 2) * 2, life: 1 });
    if (parts.length > MAX) parts.shift();
  }

  function frame() {
    if (moved && !overPad) {
      var dx = mx - lastSpawnX, dy = my - lastSpawnY;
      if (dx * dx + dy * dy >= STEP * STEP) {
        spawn(mx, my);
        lastSpawnX = mx; lastSpawnY = my;
      }
      moved = false;
    }

    ctx.clearRect(0, 0, vw, vh);
    var alive = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life -= FADE;
      if (p.life <= 0) continue;
      alive++;
      // pixel shrink in 2px steps as it fades
      var shrink = p.life > 0.66 ? 0 : (p.life > 0.33 ? 2 : 4);
      var s = SIZE - shrink;
      var ox = p.x - s / 2, oy = p.y - s / 2;
      ctx.globalAlpha = Math.min(1, p.life * 1.2);
      ctx.fillStyle = EDGE;                    // faint edge -> visible on black too
      ctx.fillRect(ox - 1, oy - 1, s + 2, s + 2);
      ctx.fillStyle = BLACK;                   // the black square itself
      ctx.fillRect(ox, oy, s, s);
    }
    ctx.globalAlpha = 1;

    if (alive > 0 || moved) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = null;
      parts.length = 0;
      ctx.clearRect(0, 0, vw, vh);
    }
  }

  if (document.body) build();
  else window.addEventListener("DOMContentLoaded", build);
})();
