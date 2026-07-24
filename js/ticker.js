/* ============================================================
   SKETCHDUEL bottom ticker: solid yellow bar, black Press Start 2P
   text scrolling left forever, stuck to the bottom of EVERY page.
   Self-injecting (style + DOM) so one <script> tag is the whole
   integration. Seamless loop: track holds the line twice and
   animates translateX 0 -> -50%.
   ============================================================ */
(function () {
  var LINE =
    "YOUR OPPONENT NEVER SLEEPS ◆ " +
    "LAST GAME: 'SAD LIZARD' (IT WAS A DRAGON) ◆ " +
    "HI-SCORE: PIX_4200 ◆ " +
    "HARD MODE FREE THIS WEEK ◆ ";

  function build() {
    // on the game cabinet (100vh flex column, #app) the ticker joins the
    // flex flow so it never covers the toolbar; on scrolling pages
    // (landing) it pins fixed to the viewport bottom
    var inApp = !!document.getElementById("app");

    var style = document.createElement("style");
    style.textContent =
      "#sd-ticker{" +
        (inApp ? "flex:0 0 auto;position:relative;"
               : "position:fixed;left:0;right:0;bottom:0;") +
        "z-index:7900;background:#ffd400;overflow:hidden;" +
        "border-top:3px solid #000;white-space:nowrap;" +
        "padding:9px 0 8px 0;user-select:none;pointer-events:none;}" +
      "#sd-ticker-track{display:inline-block;white-space:nowrap;" +
        "font-family:'Press Start 2P',monospace;font-size:11px;" +
        "letter-spacing:1px;color:#000;" +
        "animation:sd-ticker-scroll 32s linear infinite;will-change:transform;}" +
      "@keyframes sd-ticker-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}" +
      "@media (prefers-reduced-motion: reduce){#sd-ticker-track{animation:none}}" +
      (inApp ? "" : "body{padding-bottom:42px;}"); // don't hide page content
    document.head.appendChild(style);

    var bar = document.createElement("div");
    bar.id = "sd-ticker";
    bar.setAttribute("aria-hidden", "true");
    var track = document.createElement("div");
    track.id = "sd-ticker-track";
    track.textContent = LINE + LINE; // duplicated -> -50% loops seamlessly
    bar.appendChild(track);
    document.body.appendChild(bar);
  }

  if (document.body) build();
  else window.addEventListener("DOMContentLoaded", build);
})();
