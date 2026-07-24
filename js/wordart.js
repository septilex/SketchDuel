/* ============================================================
   SKETCHDUEL word-art: per-word 12x12 pixel sprites + an animated
   tiled background for the secret-word reveal.

   Sprite format: 12 rows of 12 chars.
     #  = main yellow pixel
     o  = dark-amber accent (eye / beak / detail)
     .  = transparent

   Any word resolves to a sprite:
     - LIBRARY[word] if we hand-authored one (iconic words)
     - otherwise a deterministic "invader" critter seeded by the
       word, so every word gets its own stable, distinct pattern.

   Tunables (SD.wordart.settings): scrollSpeed (px/s), spriteScale
   (px per sprite pixel in the background), tileGap, opacity.
   ============================================================ */
window.SD = window.SD || {};

SD.wordart = (function () {
  var YELLOW = "#ffd400";
  var AMBER = "#8a7500";

  /* ---------------- hand-authored library ---------------- */
  /* rough but readable at 12x12; keys are lowercase bank words */
  var LIBRARY = {
    duck: [
      "............",
      "....####....",
      "...#oo##....",
      "..o####.....",
      "...#####....",
      "...######...",
      "..#######...",
      ".#########..",
      ".#########..",
      ".#########..",
      "..#######...",
      "...######..."
    ],
    cat: [
      ".#..........",
      ".##......##.",
      ".#o#....#o#.",
      ".######### .",
      "#o#######o#.",
      "###########.",
      "#o#######o#.",
      ".#########..",
      "..#######...",
      "..#######...",
      ".#.#####.#..",
      ".#..###..#.."
    ],
    dog: [
      "..##....##..",
      ".#oo#..#oo#.",
      ".####..####.",
      "..########..",
      ".##########.",
      "#o########o#",
      "############",
      "##.######.##",
      ".##########.",
      "..########..",
      "..##....##..",
      ".##......##."
    ],
    fish: [
      "............",
      "....####....",
      "..########.#",
      ".#o######.##",
      "#o#######.##",
      "########.###",
      "########.###",
      "#o#######.##",
      ".#o######.##",
      "..########.#",
      "....####....",
      "............"
    ],
    bird: [
      "............",
      "...####.....",
      "..#oo##.....",
      ".o#####.....",
      "..######....",
      "..#######...",
      "..########..",
      "..#######...",
      "..######....",
      "...#..#.....",
      "..#....#....",
      "............"
    ],
    star: [
      ".....##.....",
      ".....##.....",
      "....####....",
      "#############",
      ".##########.",
      "..########..",
      "...######...",
      "...######...",
      "..###..###..",
      ".###....###.",
      ".##......##.",
      "#..........#"
    ].map(function (r) { return r.slice(0, 12); }),
    heart: [
      "............",
      ".##..##.....",
      "####.####...",
      "###########.",
      "###########.",
      "###########.",
      ".#########..",
      ".#########..",
      "..#######...",
      "...#####....",
      "....###.....",
      ".....#......"
    ],
    sun: [
      "....#..#....",
      ".#..#..#..#.",
      "..#.####.#..",
      "...######...",
      "#.########.#",
      "..#o##o#....",
      "..########..",
      "#.########.#",
      "...######...",
      "..#.####.#..",
      ".#..#..#..#.",
      "....#..#...."
    ],
    house: [
      ".....#......",
      "....###.....",
      "...#####....",
      "..#######...",
      ".#########..",
      "###########.",
      ".#o#####o#..",
      ".#o#####o#..",
      ".####.####..",
      ".####.####..",
      ".####.####..",
      ".####.####.."
    ],
    tree: [
      "....###.....",
      "...#####....",
      "..#######...",
      ".#########..",
      "###########.",
      ".#########..",
      "..#######...",
      ".#########..",
      "..###.###...",
      "....###.....",
      "....ooo.....",
      "....ooo....."
    ],
    flower: [
      "....##......",
      "..#.##.#....",
      ".###oo###...",
      ".##oooo##...",
      ".###oo###...",
      "..#.##.#....",
      "....##......",
      "....##......",
      "...####.....",
      "..##.##.....",
      ".##..##.....",
      "#....##....."
    ],
    ghost: [
      "...#####....",
      "..#######...",
      ".#########..",
      ".#oo###oo#..",
      ".#oo###oo#..",
      ".#########..",
      ".#########..",
      ".#########..",
      ".#########..",
      ".#########..",
      ".#.#.#.#.#..",
      "..#...#.#..."
    ],
    robot: [
      "...#...#....",
      "...#...#....",
      ".########...",
      "#.######.#..",
      "#.#oo#oo#.#..".slice(0, 12),
      "#.######.#..",
      "#.######.#..",
      ".########...",
      "..#....#....",
      ".########...",
      ".#.####.#...",
      ".#.#..#.#..."
    ],
    key: [
      "...####.....",
      "..#oo##.....",
      "..#oo##.....",
      "..#oo##.....",
      "...####.....",
      "....##......",
      "....##......",
      "....##......",
      "....###.....",
      "....##......",
      "....###.....",
      "....##......"
    ],
    egg: [
      "....###.....",
      "...#####....",
      "..#######...",
      "..#######...",
      ".#########..",
      ".#########..",
      ".#########..",
      "###########.",
      "###########.",
      ".#########..",
      "..#######...",
      "...#####...."
    ],
    snake: [
      ".######.....",
      "##oooo##....",
      "##o..o##....",
      ".######.....",
      "....###.....",
      "...###......",
      "..###..###..",
      ".###..#####.",
      ".##..##...##",
      ".##.##....##",
      ".#####...##.",
      "..###..###.."
    ],
    cup: [
      "............",
      ".########...",
      ".########.#.",
      ".#oooo##.##.",
      ".#oooo##..#.",
      ".#####.##.#.",
      ".######.##..",
      ".########...",
      ".########...",
      ".########...",
      "##########..",
      "............"
    ],
    balloon: [
      "...#####....",
      "..#######...",
      ".#########..",
      ".#oo######..",
      ".#########..",
      ".#########..",
      "..#######...",
      "...#####....",
      "....###.....",
      ".....#......",
      "....#.......",
      ".....#......"
    ],
    crown: [
      "#...........",
      "#....#....#.",
      "##..###..##.",
      "##.#####.##.",
      "###########.",
      "###########.",
      "#o#o#o#o#o#.",
      "###########.",
      "###########.",
      "............",
      "............",
      "............"
    ],
    apple: [
      ".....##.....",
      ".....#......",
      "...####.....",
      "..######.##.",
      ".########.#.",
      "############",
      "############",
      "############",
      ".##########.",
      ".##########.",
      "..########..",
      "...#....#..."
    ],
    boat: [
      ".....#......",
      ".....##.....",
      ".....#o#....",
      ".....#oo#...",
      ".....#ooo#..",
      ".....#......",
      ".....#......",
      "############",
      ".##########.",
      "..########..",
      "...######...",
      "....####...."
    ],
    rocket: [
      "....##......",
      "...####.....",
      "..#oooo#....",
      "..#oooo#....",
      "..######....",
      "..######....",
      ".########...",
      "#.######.#..",
      "#.######.#..",
      "...#..#.....",
      "..##..##....",
      ".#......#..."
    ],
    ball: [
      "...######...",
      "..###..###..",
      ".##..##..##.",
      "##..####..##",
      "##.##..##.##",
      "###......###",
      "###......###",
      "##.##..##.##",
      "##..####..##",
      ".##..##..##.",
      "..###..###..",
      "...######..."
    ]
  };

  /* fix any authored rows that aren't exactly 12 wide */
  Object.keys(LIBRARY).forEach(function (k) {
    LIBRARY[k] = LIBRARY[k].map(function (row) {
      row = (row + "............").slice(0, 12);
      return row;
    });
    while (LIBRARY[k].length < 12) LIBRARY[k].push("............");
    LIBRARY[k] = LIBRARY[k].slice(0, 12);
  });

  /* ---------------- procedural critter ---------------- */

  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* left-right symmetric "space invader" style, seeded by the word */
  function procedural(word) {
    var rng = mulberry32(hash(word) || 1);
    var grid = [];
    for (var y = 0; y < 12; y++) grid.push(".".repeat(12).split(""));

    var cx = 5.5, cy = 6.0, rx = 4.6, ry = 4.9;
    for (y = 1; y < 12; y++) {
      for (var x = 0; x < 6; x++) {
        var nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;   // outside body ellipse
        // fuller toward the vertical centre, sparser at edges
        var bias = 0.62 - 0.18 * Math.abs(ny);
        if (rng() < bias) {
          grid[y][x] = "#";
          grid[y][11 - x] = "#";
        }
      }
    }
    // guarantee a solid spine so it never looks like scattered dust
    for (y = 3; y < 10; y++) { grid[y][5] = "#"; grid[y][6] = "#"; }
    // eyes: symmetric accent pair on an upper row
    var eyeRow = 3 + Math.floor(rng() * 3);
    var eyeCol = 2 + Math.floor(rng() * 2);
    grid[eyeRow][eyeCol] = "o";
    grid[eyeRow][11 - eyeCol] = "o";

    return grid.map(function (r) { return r.join(""); });
  }

  var cache = {};
  function spriteFor(word) {
    var key = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (cache[key]) return cache[key];
    var g = LIBRARY[key] || procedural(key || "sketch");
    cache[key] = g;
    return g;
  }

  /* ---------------- raster helpers ---------------- */

  /* draw a sprite grid onto a context at (ox,oy), px per cell, optional
     mirror; colors overridable (background uses faded fills) */
  function paint(ctx, grid, ox, oy, px, mirror, main, accent) {
    for (var y = 0; y < 12; y++) {
      for (var x = 0; x < 12; x++) {
        var ch = grid[y][mirror ? 11 - x : x];
        if (ch === ".") continue;
        ctx.fillStyle = ch === "o" ? accent : main;
        ctx.fillRect(ox + x * px, oy + y * px, px, px);
      }
    }
  }

  /* render a sprite to one of the 64px flanking card icons */
  function renderIcon(canvas, grid, mirror) {
    var size = 12;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    paint(ctx, grid, 0, 0, 1, mirror, YELLOW, AMBER);
    // CSS scales the 12px canvas up with pixelated rendering
  }

  /* ---------------- background animation ---------------- */

  var settings = { scrollSpeed: 20, spriteScale: 4, tileGap: 44, opacity: 0.16 };

  var bgCanvas, bgCtx, tile, tileM, tileSize, cellW, cellH, rows, cols;
  var raf = null, running = false, startTime = 0, currentGrid = null;

  function buildTiles(grid) {
    var px = settings.spriteScale;
    tileSize = 12 * px;
    tile = document.createElement("canvas");
    tileM = document.createElement("canvas");
    tile.width = tileM.width = tileSize;
    tile.height = tileM.height = tileSize;
    var a = tile.getContext("2d"), b = tileM.getContext("2d");
    a.imageSmoothingEnabled = b.imageSmoothingEnabled = false;
    paint(a, grid, 0, 0, px, false, YELLOW, AMBER);
    paint(b, grid, 0, 0, px, true, YELLOW, AMBER);
  }

  function resize() {
    if (!bgCanvas) return;
    var r = bgCanvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgCanvas.width = Math.max(1, Math.floor(r.width * dpr));
    bgCanvas.height = Math.max(1, Math.floor(r.height * dpr));
    bgCanvas.style.width = r.width + "px";
    bgCanvas.style.height = r.height + "px";
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.imageSmoothingEnabled = false;
    cellW = tileSize + settings.tileGap;
    cellH = tileSize + settings.tileGap;
    cols = Math.ceil(r.width / cellW) + 3;
    rows = Math.ceil(r.height / cellH) + 3;
    viewW = r.width; viewH = r.height;
  }

  var viewW = 0, viewH = 0;

  function renderAt(t) {
    bgCtx.clearRect(0, 0, viewW, viewH);
    bgCtx.globalAlpha = settings.opacity;

    for (var row = 0; row < rows; row++) {
      var dir = row % 2 === 0 ? 1 : -1;              // alt rows opposite ways
      var mirror = dir < 0;                           // face travel direction
      var shift = dir * settings.scrollSpeed * t;
      // stepped 8-bit bob: snap the sine to 2px increments
      var bob = Math.round(Math.sin(t * 1.6 + row * 0.9) * 2) * 2;
      // wrap the horizontal offset into [0, cellW)
      var offX = ((shift % cellW) + cellW) % cellW;
      var y = row * cellH - cellH + bob;
      for (var col = -1; col < cols; col++) {
        var x = col * cellW + (dir > 0 ? -offX : offX - cellW) + settings.tileGap / 2;
        bgCtx.drawImage(mirror ? tileM : tile, Math.round(x), Math.round(y));
      }
    }
    bgCtx.globalAlpha = 1;
  }

  function drawStatic() { renderAt(0); }

  function frame(now) {
    if (!running) return;
    if (!startTime) startTime = now;
    renderAt((now - startTime) / 1000);
    raf = requestAnimationFrame(frame);
  }

  return {
    settings: settings,

    /* attach the persistent background canvas once */
    mountBackground: function (canvas) {
      bgCanvas = canvas;
      bgCtx = canvas.getContext("2d");
      window.addEventListener("resize", function () {
        if (running) resize();
      });
    },

    sprite: spriteFor,

    /* set the current word: rebuild sprite, both card icons, and the
       whole background pattern, then run the animation */
    setWord: function (word, iconL, iconR) {
      var grid = spriteFor(word);
      currentGrid = grid;
      if (iconL) renderIcon(iconL, grid, false);
      if (iconR) renderIcon(iconR, grid, true);   // right icon mirrored
      if (!bgCanvas) return;
      buildTiles(grid);
      resize();
      cancelAnimationFrame(raf);
      // reduced motion: paint one static frame, skip the loop
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        running = false;
        startTime = performance.now();
        drawStatic();
        return;
      }
      running = true;
      startTime = 0;
      raf = requestAnimationFrame(frame);
    },

    stop: function () {
      running = false;
      cancelAnimationFrame(raf);
    },

    /* ---- independent, faint sprite backdrop for the main menu ---- */
    mountMenu: function (canvas) {
      mCanvas = canvas;
      mCtx = canvas.getContext("2d");
      window.addEventListener("resize", function () { if (mRunning) mResize(); });
    },
    startMenu: function (spriteName, canvasEl) {
      // menu + setup share this animator; only one is on screen at a time,
      // so we just re-point it at whichever backdrop canvas is active
      if (canvasEl && canvasEl !== mCanvas) {
        mCanvas = canvasEl;
        mCtx = canvasEl.getContext("2d");
      }
      if (!mCanvas) return;
      mBuild(spriteFor(spriteName || "robot"));
      mResize();
      cancelAnimationFrame(mRaf);
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) { mRunning = false; mStart = performance.now(); mRender(0); return; }
      mRunning = true; mStart = 0;
      mRaf = requestAnimationFrame(mFrame);
    },
    stopMenu: function () {
      mRunning = false;
      cancelAnimationFrame(mRaf);
    }
  };

  /* menu backdrop state (kept separate from the reveal-screen animator) */
  var mCanvas, mCtx, mTile, mTileM, mTileSize, mCellW, mCellH, mRows, mCols, mW, mH;
  var mRaf = null, mRunning = false, mStart = 0;

  function mBuild(grid) {
    var px = 3;
    mTileSize = 12 * px;
    mTile = document.createElement("canvas");
    mTileM = document.createElement("canvas");
    mTile.width = mTileM.width = mTileSize;
    mTile.height = mTileM.height = mTileSize;
    var a = mTile.getContext("2d"), b = mTileM.getContext("2d");
    a.imageSmoothingEnabled = b.imageSmoothingEnabled = false;
    paint(a, grid, 0, 0, px, false, YELLOW, AMBER);
    paint(b, grid, 0, 0, px, true, YELLOW, AMBER);
  }
  function mResize() {
    if (!mCanvas) return;
    var r = mCanvas.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    mCanvas.width = Math.max(1, Math.floor(r.width * dpr));
    mCanvas.height = Math.max(1, Math.floor(r.height * dpr));
    mCanvas.style.width = r.width + "px";
    mCanvas.style.height = r.height + "px";
    mCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mCtx.imageSmoothingEnabled = false;
    mCellW = mTileSize + 40; mCellH = mTileSize + 40;
    mCols = Math.ceil(r.width / mCellW) + 3;
    mRows = Math.ceil(r.height / mCellH) + 3;
    mW = r.width; mH = r.height;
  }
  function mRender(t) {
    mCtx.clearRect(0, 0, mW, mH);
    mCtx.globalAlpha = 0.09;
    for (var row = 0; row < mRows; row++) {
      var dir = row % 2 === 0 ? 1 : -1, mirror = dir < 0;
      var shift = dir * 9 * t;
      var bob = Math.round(Math.sin(t * 1.0 + row * 0.7) * 2) * 2;
      var offX = ((shift % mCellW) + mCellW) % mCellW;
      var y = row * mCellH - mCellH + bob;
      for (var col = -1; col < mCols; col++) {
        var x = col * mCellW + (dir > 0 ? -offX : offX - mCellW) + 20;
        mCtx.drawImage(mirror ? mTileM : mTile, Math.round(x), Math.round(y));
      }
    }
    mCtx.globalAlpha = 1;
  }
  function mFrame(now) {
    if (!mRunning) return;
    if (!mStart) mStart = now;
    mRender((now - mStart) / 1000);
    mRaf = requestAnimationFrame(mFrame);
  }
})();
