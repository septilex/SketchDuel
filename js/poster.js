/* ============================================================
   SKETCHDUEL "WANTED" poster: one-click downloadable pixel share
   card. Composites the player's winning sketch as a mugshot with
   WANTED / word / time / score / branding, all in-palette. Pure
   canvas -> PNG, no network. The viral-loop artifact for the pitch.
   ============================================================ */
window.SD = window.SD || {};

SD.poster = (function () {
  var Y = "#ffd400", BLK = "#0a0a08", DIM = "#8a7500", W = "#f2f2e9";
  var CW = 900, CH = 1260;  // portrait poster

  // blocky headline text via the loaded Press Start 2P (falls back to mono)
  function head(ctx, px) { ctx.font = px + "px 'Press Start 2P', monospace"; }
  function body(ctx, px) { ctx.font = px + "px 'VT323', monospace"; }

  function hazardStripe(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = Y; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = BLK;
    var step = 34;
    for (var i = -h; i < w + h; i += step * 2) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.lineTo(x + i + h + step, y + h);
      ctx.lineTo(x + i + step, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function center(ctx, text, y, color) {
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(text, CW / 2, y);
  }

  // build the poster onto an offscreen canvas; returns the canvas
  function build(data) {
    var c = document.createElement("canvas");
    c.width = CW; c.height = CH;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = "alphabetic";

    // background + thick pixel frame
    ctx.fillStyle = BLK; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = Y;
    ctx.fillRect(24, 24, CW - 48, 10);
    ctx.fillRect(24, CH - 34, CW - 48, 10);
    ctx.fillRect(24, 24, 10, CH - 48);
    ctx.fillRect(CW - 34, 24, 10, CH - 48);

    // hazard header + WANTED
    hazardStripe(ctx, 54, 60, CW - 108, 44);
    head(ctx, 86);
    ctx.shadowColor = BLK; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6;
    center(ctx, "WANTED", 210, Y);
    ctx.shadowColor = "transparent"; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    body(ctx, 34);
    center(ctx, "FOR CRIMES AGAINST FINE ART", 258, W);

    // mugshot frame + sketch (yellow ink on charcoal, height-board bg)
    var ms = 540, mx = (CW - ms) / 2, my = 300;
    ctx.fillStyle = "#131310"; ctx.fillRect(mx, my, ms, ms);
    // faint height-chart lines
    ctx.strokeStyle = DIM; ctx.lineWidth = 2;
    for (var gy = my + 40; gy < my + ms; gy += 48) {
      ctx.beginPath(); ctx.moveTo(mx, gy); ctx.lineTo(mx + ms, gy); ctx.stroke();
    }
    var painted = false;
    if (data.sketch && SD.draw && SD.draw.paintInto) {
      painted = SD.draw.paintInto(ctx, data.sketch,
        { x: mx + 24, y: my + 24, w: ms - 48, h: ms - 48 }, { color: Y });
    }
    if (!painted) { body(ctx, 40); center(ctx, "[ EVIDENCE LOST ]", my + ms / 2, DIM); }
    // mugshot border
    ctx.strokeStyle = Y; ctx.lineWidth = 6;
    ctx.strokeRect(mx, my, ms, ms);

    // the charge sheet
    head(ctx, 44);
    center(ctx, '"' + String(data.word || "????").toUpperCase() + '"', my + ms + 78, Y);

    body(ctx, 40);
    var verdict = data.won
      ? "IDENTIFIED IN " + Number(data.time || 0).toFixed(1) + "s"
      : "ESCAPED THE MACHINE";
    center(ctx, verdict, my + ms + 134, W);

    head(ctx, 38);
    center(ctx, "SCORE " + pad(data.score || 0, 4), my + ms + 202, Y);
    if (data.streak && data.streak > 1) {
      body(ctx, 34);
      center(ctx, data.streak + "-ROUND STREAK", my + ms + 246, DIM);
    }

    // branding footer
    hazardStripe(ctx, 54, CH - 148, CW - 108, 18);
    head(ctx, 28);
    center(ctx, "SKETCH.DUEL", CH - 84, Y);
    body(ctx, 28);
    center(ctx, "DRAW. IT GUESSES. NOBODY'S SAFE.", CH - 50, W);

    ctx.textAlign = "left";
    return c;
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }

  return {
    /* returns a dataURL (for preview) */
    dataURL: function (data) { return build(data).toDataURL("image/png"); },

    /* trigger a browser download of the poster PNG */
    download: function (data) {
      var url = build(data).toDataURL("image/png");
      var a = document.createElement("a");
      var slug = String(data.word || "sketch").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.href = url;
      a.download = "sketchduel-wanted-" + slug + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return url;
    }
  };
})();
