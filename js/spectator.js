/* ============================================================
   SKETCHDUEL spectator QR: at the party results screen, encodes the
   final standings into a URL to the self-contained scoreboard.html
   and renders a scannable QR so the whole table can pull it up on
   their phones. No backend -> this is a final-standings snapshot,
   not a live socket (a static page has no shared state to stream).
   Uses the vendored qrcode-generator (js/vendor/qrcode.js).
   ============================================================ */
window.SD = window.SD || {};

SD.spectator = (function () {
  function b64url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // absolute URL to scoreboard.html (same origin/dir as the game) + data
  function buildURL(players, title) {
    var payload = {
      t: title || "FINAL STANDINGS",
      p: players.map(function (p) { return { n: p.name, s: p.score }; })
    };
    var base = new URL("scoreboard.html", location.href).href;
    return base + "?d=" + b64url(JSON.stringify(payload));
  }

  // paint black modules on a light quiet-zone; highest-contrast = scans best
  function paint(canvas, url) {
    if (typeof qrcode === "undefined") return false;
    var qr = qrcode(0, "M");          // auto version, medium error correction
    qr.addData(url);
    qr.make();
    var n = qr.getModuleCount();
    var margin = 4;                    // required quiet zone
    var total = n + margin * 2;
    var px = Math.max(2, Math.floor((canvas.width) / total));
    var size = px * total;
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#f2f2e9";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#0a0a08";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect((c + margin) * px, (r + margin) * px, px, px);
        }
      }
    }
    return true;
  }

  return {
    url: buildURL,
    render: function (canvas, players, title) {
      var u = buildURL(players, title);
      var ok = paint(canvas, u);
      return ok ? u : null;
    }
  };
})();
