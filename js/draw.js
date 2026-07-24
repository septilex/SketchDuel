/* SKETCHDUEL drawing engine.
   Smooth ink: pointer events + coalesced points, quadratic curves
   through midpoints, incremental segment rendering (zero-lag feel).
   Strokes are kept as data so we can re-render at any resolution:
   the on-screen pad is dark, but snapshots for the AI are always
   re-composited as black ink on a white 512px square. */
window.SD = window.SD || {};

SD.draw = (function () {
  var canvas, ctx, wrap;
  var dpr = 1;
  var cssW = 0, cssH = 0;

  var strokes = [];        // {color, size, eraser, pts:[{x,y}]}
  var cur = null;
  var drawing = false;
  var enabled = false;
  var revision = 0;        // bumped on every visible change (the "hash")
  var onChange = null;     // notified so the UI can toggle hints

  var BG = "#131310";

  /* ---------- sizing ---------- */

  function resize() {
    if (!canvas || !wrap) return;
    var r = wrap.getBoundingClientRect();
    cssW = Math.max(1, Math.floor(r.width));
    cssH = Math.max(1, Math.floor(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  /* ---------- rendering ---------- */

  function strokeStyle(c, s) {
    c.lineCap = "round";
    c.lineJoin = "round";
    c.lineWidth = s.size;
    if (s.eraser) {
      c.globalCompositeOperation = "destination-out";
      c.strokeStyle = "#000";
      c.fillStyle = "#000";
    } else {
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = s.color;
      c.fillStyle = s.color;
    }
  }

  function renderStroke(c, s) {
    var p = s.pts;
    if (!p.length) return;
    strokeStyle(c, s);
    if (p.length < 3) {
      c.beginPath();
      c.arc(p[0].x, p[0].y, s.size / 2, 0, Math.PI * 2);
      c.fill();
      if (p.length === 2) {
        c.beginPath();
        c.moveTo(p[0].x, p[0].y);
        c.lineTo(p[1].x, p[1].y);
        c.stroke();
      }
      c.globalCompositeOperation = "source-over";
      return;
    }
    c.beginPath();
    c.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < p.length - 1; i++) {
      var mx = (p[i].x + p[i + 1].x) / 2;
      var my = (p[i].y + p[i + 1].y) / 2;
      c.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    c.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    c.stroke();
    c.globalCompositeOperation = "source-over";
  }

  function redraw() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, cssW, cssH);
    for (var i = 0; i < strokes.length; i++) renderStroke(ctx, strokes[i]);
    ctx.restore();
  }

  /* incremental segment while the pen is down: curve from the
     midpoint of (a,b) to the midpoint of (b,c) with b as control */
  function renderLiveSegment() {
    var p = cur.pts;
    var n = p.length;
    strokeStyle(ctx, cur);
    if (n === 1) {
      ctx.beginPath();
      ctx.arc(p[0].x, p[0].y, cur.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (n === 2) {
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      ctx.stroke();
    } else {
      var a = p[n - 3], b = p[n - 2], c = p[n - 1];
      ctx.beginPath();
      ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function changed() {
    revision++;
    if (onChange) onChange();
  }

  /* ---------- pointer handlers ---------- */

  function pos(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function down(ev) {
    if (!enabled || ev.button > 0) return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    drawing = true;
    cur = {
      color: SD.draw.ink,
      size: SD.draw.size,
      eraser: SD.draw.eraser,
      pts: [pos(ev)]
    };
    if (SD.audio && SD.audio.chalkOn) SD.audio.chalkOn();
    renderLiveSegment();
    changed();
  }

  function move(ev) {
    if (!drawing || !cur) return;
    ev.preventDefault();
    var events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    if (!events.length) events = [ev];
    var moved = 0;
    for (var i = 0; i < events.length; i++) {
      var p = pos(events[i]);
      var last = cur.pts[cur.pts.length - 1];
      var dx = p.x - last.x, dy = p.y - last.y;
      if (Math.abs(dx) < 0.7 && Math.abs(dy) < 0.7) continue;
      moved += Math.sqrt(dx * dx + dy * dy);
      cur.pts.push(p);
      renderLiveSegment();
    }
    // chalk scratch reacts to how fast the pen is moving
    if (moved > 0 && SD.audio && SD.audio.chalkMove) SD.audio.chalkMove(moved);
    changed();
  }

  function up(ev) {
    if (!drawing) return;
    drawing = false;
    if (SD.audio && SD.audio.chalkOff) SD.audio.chalkOff();
    if (cur && cur.pts.length) {
      strokes.push(cur);
      redraw(); // settle the full smooth curve
    }
    cur = null;
    changed();
  }

  /* ---------- snapshot pipeline (for the AI) ---------- */

  var snapCanvas = null;

  /* black ink on white 512px square, drawing centered + fitted */
  function snapshot() {
    if (!snapCanvas) {
      snapCanvas = document.createElement("canvas");
      snapCanvas.width = 512;
      snapCanvas.height = 512;
    }
    var sc = snapCanvas.getContext("2d");
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = "source-over";
    sc.fillStyle = "#ffffff";
    sc.fillRect(0, 0, 512, 512);

    var scale = 512 / Math.max(cssW, cssH);
    var ox = (512 - cssW * scale) / 2;
    var oy = (512 - cssH * scale) / 2;
    sc.setTransform(scale, 0, 0, scale, ox, oy);

    var all = drawing && cur ? strokes.concat([cur]) : strokes;
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      // normalize: real ink -> black, eraser -> white paint
      var norm = {
        color: s.eraser ? "#ffffff" : "#000000",
        size: Math.max(s.size, 2.5),
        eraser: false,
        pts: s.pts
      };
      renderStroke(sc, norm);
    }
    sc.setTransform(1, 0, 0, 1, 0, 0);

    // ink presence check: sample the snapshot for non-white pixels
    var ink = false;
    try {
      var img = sc.getImageData(0, 0, 512, 512).data;
      for (var p = 0; p < img.length; p += 64) { // every 16th pixel
        if (img[p] < 240) { ink = true; break; }
      }
    } catch (e) { ink = strokes.length > 0; }

    var dataUrl = snapCanvas.toDataURL("image/png");
    return {
      base64: dataUrl.split(",")[1],
      hasInk: ink,
      revision: revision
    };
  }

  /* ---------- public API ---------- */

  return {
    ink: "#ffd400",
    size: 6,
    eraser: false,

    init: function (canvasEl, wrapEl, changeCb) {
      canvas = canvasEl;
      wrap = wrapEl;
      ctx = canvas.getContext("2d");
      onChange = changeCb || null;
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      if (window.ResizeObserver) {
        new ResizeObserver(resize).observe(wrap);
      } else {
        window.addEventListener("resize", resize);
      }
      resize();
    },

    setEnabled: function (v) {
      enabled = v;
      if (!v && drawing) up({});
    },

    undo: function () {
      if (drawing || !strokes.length) return;
      strokes.pop();
      redraw();
      changed();
    },

    clear: function () {
      if (!strokes.length && !drawing) return;
      strokes = [];
      cur = null;
      drawing = false;
      redraw();
      changed();
    },

    isEmpty: function () { return strokes.length === 0 && !drawing; },
    hasVisibleInk: function () {
      for (var i = 0; i < strokes.length; i++) {
        if (!strokes[i].eraser) return true;
      }
      return false;
    },

    get revision() { return revision; },
    snapshot: snapshot,

    /* deep copy of strokes for the results replay */
    exportStrokes: function () {
      return {
        w: cssW, h: cssH,
        strokes: JSON.parse(JSON.stringify(strokes))
      };
    },

    /* static paint of an exported sketch into a box on any context.
       box = {x,y,w,h}; opts.color forces a single ink (mugshot look). */
    paintInto: function (tctx, data, box, opts) {
      opts = opts || {};
      if (!data || !data.strokes || !data.strokes.length) return false;
      var scale = Math.min(box.w / data.w, box.h / data.h);
      var ox = box.x + (box.w - data.w * scale) / 2;
      var oy = box.y + (box.h - data.h * scale) / 2;
      tctx.save();
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.translate(ox, oy);
      tctx.scale(scale, scale);
      for (var i = 0; i < data.strokes.length; i++) {
        var s = data.strokes[i];
        if (s.eraser) { renderStroke(tctx, s); continue; }
        renderStroke(tctx, opts.color ? {
          color: opts.color, size: s.size, eraser: false, pts: s.pts
        } : s);
      }
      tctx.restore();
      tctx.globalCompositeOperation = "source-over";
      return true;
    },

    /* animated replay of an exported sketch onto another canvas */
    replay: function (target, data, opts) {
      opts = opts || {};
      var tctx = target.getContext("2d");
      var tw = target.width, th = target.height;
      var scale = Math.min(tw / data.w, th / data.h);
      var ox = (tw - data.w * scale) / 2;
      var oy = (th - data.h * scale) / 2;
      var total = 0;
      data.strokes.forEach(function (s) { total += Math.max(s.pts.length, 1); });
      if (!total) return { stop: function () {} };

      var duration = opts.duration || 2800;
      var start = performance.now();
      var raf = null, loopTimer = null;

      function frame(now) {
        var t = Math.min((now - start) / duration, 1);
        var budget = Math.floor(t * total);
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        tctx.globalCompositeOperation = "source-over";
        tctx.fillStyle = "#0a0a08";
        tctx.fillRect(0, 0, tw, th);
        tctx.setTransform(scale, 0, 0, scale, ox, oy);
        for (var i = 0; i < data.strokes.length && budget > 0; i++) {
          var s = data.strokes[i];
          var n = Math.min(s.pts.length, budget);
          budget -= s.pts.length;
          renderStroke(tctx, {
            color: s.eraser ? s.color : s.color,
            size: s.size,
            eraser: s.eraser,
            pts: s.pts.slice(0, Math.max(n, 1))
          });
        }
        tctx.setTransform(1, 0, 0, 1, 0, 0);
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else if (opts.loop) {
          loopTimer = setTimeout(function () {
            start = performance.now();
            raf = requestAnimationFrame(frame);
          }, 1200);
        }
      }
      raf = requestAnimationFrame(frame);
      return {
        stop: function () {
          cancelAnimationFrame(raf);
          clearTimeout(loopTimer);
        }
      };
    }
  };
})();
