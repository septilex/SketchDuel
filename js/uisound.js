/* ============================================================
   SKETCHDUEL UI sound: one delegated listener that plays the 8-bit
   arcade "select" blip on ANY button/link/control click, across
   every page. Also wakes the AudioContext on the first gesture
   (browser autoplay policy). Safe if SD.audio isn't present.
   ============================================================ */
(function () {
  var SEL = "button, a, .btn, .card, .swatch, .diff, [role='button'], summary";

  document.addEventListener("click", function (ev) {
    if (!window.SD || !SD.audio || !SD.audio.click) return;
    var t = ev.target;
    if (t && t.closest && t.closest(SEL)) SD.audio.click();
  });

  // 8-bit hover tick: fires once when the cursor ENTERS a control -
  // moving around inside the same button doesn't re-trigger, and a
  // small throttle keeps fast sweeps across the menu from machine-gunning
  var lastHover = 0;
  document.addEventListener("mouseover", function (ev) {
    if (!window.SD || !SD.audio || !SD.audio.hover) return;
    var t = ev.target;
    var el = t && t.closest && t.closest(SEL);
    if (!el) return;
    // still inside the same control? (came from one of its children)
    var from = ev.relatedTarget;
    if (from && from.closest && from.closest(SEL) === el) return;
    var now = performance.now();
    if (now - lastHover < 45) return;
    lastHover = now;
    SD.audio.hover();
  });

  // resume audio on the first user gesture, then unhook
  document.addEventListener("pointerdown", function once() {
    if (window.SD && SD.audio && SD.audio.ensure) SD.audio.ensure();
    document.removeEventListener("pointerdown", once);
  });
})();
