/* SKETCHDUEL 8-bit audio: Web Audio square/triangle blips, no files. */
window.SD = window.SD || {};

SD.audio = (function () {
  var ctx = null;
  var muted = false;

  function ensure() {
    if (muted) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  /* one hard-edged blip */
  function beep(freq, dur, type, vol, delay) {
    var c = ensure();
    if (!c) return;
    type = type || "square";
    vol = (vol == null) ? 0.045 : vol;
    delay = delay || 0;
    var t = c.currentTime + delay;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /* ---- chalk scratch: one persistent looping noise graph, gated by a
     gain node so it only "scratches" while the pen is actually moving ---- */
  var chalkSrc = null, chalkGain = null, chalkBand = null, chalkIdle = null;
  function buildChalk(c) {
    var len = Math.floor(c.sampleRate * 1.0);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // white noise
    chalkSrc = c.createBufferSource();
    chalkSrc.buffer = buf; chalkSrc.loop = true;
    var hp = c.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 1500;
    chalkBand = c.createBiquadFilter();
    chalkBand.type = "bandpass"; chalkBand.frequency.value = 2600; chalkBand.Q.value = 0.8;
    chalkGain = c.createGain(); chalkGain.gain.value = 0.0001;
    chalkSrc.connect(hp); hp.connect(chalkBand); chalkBand.connect(chalkGain);
    chalkGain.connect(c.destination);
    chalkSrc.start();
  }

  return {
    ensure: ensure,
    get muted() { return muted; },
    setMuted: function (m) {
      muted = m;
      if (m) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
        if (chalkGain && ctx) chalkGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
      }
    },

    /* pen down: make sure the chalk graph exists */
    chalkOn: function () {
      var c = ensure();
      if (c && !chalkSrc) buildChalk(c);
    },
    /* pen moving: scratch louder/brighter with speed; auto-duck when it stops */
    chalkMove: function (speed) {
      var c = ensure();
      if (!c) return;
      if (!chalkSrc) buildChalk(c);
      var vol = Math.min(0.11, 0.028 + (speed || 0) * 0.0009);
      chalkGain.gain.setTargetAtTime(vol, c.currentTime, 0.012);
      chalkBand.frequency.setTargetAtTime(2200 + Math.min(speed || 0, 320) * 4, c.currentTime, 0.03);
      clearTimeout(chalkIdle);
      chalkIdle = setTimeout(function () {
        if (chalkGain && ctx) chalkGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      }, 70);
    },
    /* pen up: silence the scratch */
    chalkOff: function () {
      clearTimeout(chalkIdle);
      if (chalkGain && ctx) chalkGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
    },

    /* arcade "select" blip - two quick stepped tones */
    click: function () {
      beep(660, 0.03, "square", 0.035);
      beep(990, 0.045, "square", 0.03, 0.028);
    },
    /* hover tick: one soft short blip - quieter + lower than click so
       sweeping the cursor across the menu sounds like a menu, not a war */
    hover: function () { beep(440, 0.025, "square", 0.02); },
    pop: function () { beep(523, 0.05, "square", 0.04); beep(784, 0.06, "square", 0.04, 0.05); },
    tick: function () { beep(1245, 0.05, "triangle", 0.05); },
    count: function () { beep(330, 0.12, "square", 0.05); },
    go: function () { beep(660, 0.2, "square", 0.05); },
    win: function () {
      beep(523, 0.12, "square", 0.055, 0);
      beep(659, 0.12, "square", 0.055, 0.13);
      beep(784, 0.24, "square", 0.055, 0.26);
      beep(1047, 0.3, "triangle", 0.045, 0.4);
    },
    /* party blast: fanfare run + a downward party-horn glide + confetti pops */
    party: function () {
      var c = ensure();
      if (!c) return;
      var t = c.currentTime;
      [523, 659, 784, 1047, 1319].forEach(function (f, i) {
        beep(f, 0.11, "square", 0.05, i * 0.06);
      });
      // party-horn glide down
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(920, t + 0.34);
      o.frequency.exponentialRampToValueAtTime(170, t + 0.9);
      g.gain.setValueAtTime(0.045, t + 0.34);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.95);
      o.connect(g); g.connect(c.destination);
      o.start(t + 0.34); o.stop(t + 1.0);
      // confetti pops
      for (var i = 0; i < 7; i++) {
        beep(1100 + Math.random() * 900, 0.035, "square", 0.03, 0.36 + i * 0.05);
      }
    },
    lose: function () {
      beep(196, 0.22, "square", 0.05, 0);
      beep(147, 0.4, "square", 0.05, 0.22);
    },
    error: function () { beep(110, 0.15, "square", 0.04); },
    scoreTick: function () { beep(988, 0.03, "triangle", 0.035); }
  };
})();
