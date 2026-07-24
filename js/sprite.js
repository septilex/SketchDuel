/* SKETCH-BOT 9000: pixel-grid sprites rendered as inline SVG.
   Maps: '.' empty, 'y' yellow, 'd' dim yellow, 'w' white, 'b' black. */
window.SD = window.SD || {};

SD.px = (function () {
  var COLORS = { y: "#ffd400", d: "#8a7500", w: "#f2f2e9", b: "#0a0a08" };

  function toSVG(map) {
    var h = map.length, w = map[0].length;
    var out = '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg">';
    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var ch = map[r][c];
        if (ch === ".") continue;
        out += '<rect x="' + c + '" y="' + r + '" width="1" height="1" fill="' + COLORS[ch] + '"/>';
      }
    }
    return out + "</svg>";
  }

  return { toSVG: toSVG };
})();

SD.SPRITES = {
  /* --- SKETCH-BOT 9000, 16x16 --- */
  idle: [
    ".......yy.......",
    ".......yy.......",
    "..yyyyyyyyyyyy..",
    "..y..........y..",
    "..y.ww....ww.y..",
    "..y.ww....ww.y..",
    "..y..........y..",
    "..y.yyyyyyyy.y..",
    "..yyyyyyyyyyyy..",
    ".....yy..yy.....",
    "..yyyyyyyyyyyy..",
    "yy.y...dd...y.yy",
    "yy.y..dddd..y.yy",
    "...y...dd...y...",
    "...yyyyyyyyyy...",
    "....yy....yy...."
  ],
  blink: [
    ".......yy.......",
    ".......yy.......",
    "..yyyyyyyyyyyy..",
    "..y..........y..",
    "..y..........y..",
    "..y.dd....dd.y..",
    "..y..........y..",
    "..y.yyyyyyyy.y..",
    "..yyyyyyyyyyyy..",
    ".....yy..yy.....",
    "..yyyyyyyyyyyy..",
    "yy.y...dd...y.yy",
    "yy.y..dddd..y.yy",
    "...y...dd...y...",
    "...yyyyyyyyyy...",
    "....yy....yy...."
  ],
  scan: [
    ".......yy.......",
    ".......yy.......",
    "..yyyyyyyyyyyy..",
    "..y..........y..",
    "..y..........y..",
    "..y.www..www.y..",
    "..y..........y..",
    "..y..yyyyyy..y..",
    "..yyyyyyyyyyyy..",
    ".....yy..yy.....",
    "..yyyyyyyyyyyy..",
    "yy.y...dd...y.yy",
    "yy.y..dddd..y.yy",
    "...y...dd...y...",
    "...yyyyyyyyyy...",
    "....yy....yy...."
  ],
  confident: [
    ".......yy.......",
    ".......yy.......",
    "..yyyyyyyyyyyy..",
    "..y.ww....ww.y..",
    "..y.wb....bw.y..",
    "..y.ww....ww.y..",
    "..y..........y..",
    "..y.yyyyyyyy.y..",
    "..yyyyyyyyyyyy..",
    ".....yy..yy.....",
    "..yyyyyyyyyyyy..",
    "yy.y...dd...y.yy",
    "yy.y..dddd..y.yy",
    "...y...dd...y...",
    "...yyyyyyyyyy...",
    "....yy....yy...."
  ],
  celebrate: [
    ".......yy.......",
    ".......yy.......",
    "..yyyyyyyyyyyy..",
    "..y.ww....ww.y..",
    "..y.wb....bw.y..",
    "..y.ww....ww.y..",
    "..y..........y..",
    "..y.yyyyyyyy.y..",
    "..yyyyyyyyyyyy..",
    "yy...yy..yy...yy",
    "yyyyyyyyyyyyyyyy",
    "...y...dd...y...",
    "...y..dddd..y...",
    "...y...dd...y...",
    "...yyyyyyyyyy...",
    "....yy....yy...."
  ],
  slump: [
    "................",
    ".......dd.......",
    "..dddddddddddd..",
    "..d..........d..",
    "..d..........d..",
    "..d.dd....dd.d..",
    "..d..........d..",
    "..d..dddddd..d..",
    "..dddddddddddd..",
    ".....dd..dd.....",
    "..dddddddddddd..",
    "...d...dd...d...",
    "dd.d..dddd..d.dd",
    "dd.d...dd...d.dd",
    "...dddddddddd...",
    "....dd....dd...."
  ],
  /* --- trophy, 12x12 --- */
  trophy: [
    ".yyyyyyyyyy.",
    ".ywyyyyyyyy.",
    "y.yyyyyyyy.y",
    "y.yyyyyyyy.y",
    "y.yyyyyyyy.y",
    ".y.yyyyyy.y.",
    "...yyyyyy...",
    "....yyyy....",
    ".....yy.....",
    ".....yy.....",
    "...yyyyyy...",
    "..yyyyyyyy.."
  ]
};

SD.bot = (function () {
  var el = null;
  var base = "idle";
  var pulseTimer = null;
  var blinkTimer = null;
  var showing = "";

  function draw(name) {
    if (!el || showing === name || !SD.SPRITES[name]) return;
    showing = name;
    el.innerHTML = SD.px.toSVG(SD.SPRITES[name]);
  }

  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(function () {
      if (base === "idle" && !pulseTimer) {
        draw("blink");
        setTimeout(function () {
          if (base === "idle" && !pulseTimer) draw("idle");
        }, 160);
      }
      scheduleBlink();
    }, 2600 + Math.random() * 2200);
  }

  return {
    mount: function (target) { el = target; draw("idle"); scheduleBlink(); },
    /* set the persistent expression */
    set: function (name) {
      base = name;
      if (!pulseTimer) draw(name);
    },
    /* temporary expression that reverts to base */
    pulse: function (name, ms) {
      clearTimeout(pulseTimer);
      draw(name);
      pulseTimer = setTimeout(function () {
        pulseTimer = null;
        draw(base);
      }, ms || 1500);
    },
    get expression() { return base; }
  };
})();
