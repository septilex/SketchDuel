/* SKETCHDUEL game shell: screens, rounds, scoring, party/practice,
   settings, keyboard, and all cabinet wiring. */
window.SD = window.SD || {};

(function () {
  "use strict";

  /* ================= DOM ================= */

  function $(id) { return document.getElementById(id); }

  var el = {
    hud: $("hud"), hudPlayer: $("hud-player"), hudRound: $("hud-round"),
    hudScore: $("hud-score"), hudStreak: $("hud-streak"),
    btnMute: $("btn-mute"), btnSettings: $("btn-settings"),
    coreStatus: $("core-status"),
    menuBg: $("menu-bg"), menuBot: $("menu-bot"),
    setupBg: $("setup-bg"), setupBot: $("setup-bot"),
    screens: {
      menu: $("screen-menu"), setup: $("screen-setup"),
      party: $("screen-party"), pass: $("screen-pass"),
      word: $("screen-word"), game: $("screen-game"), results: $("screen-results")
    },
    partyNames: $("party-names"),
    passName: $("pass-name"),
    wordRoundLabel: $("word-round-label").querySelector(".hz-label"),
    wordDisplay: $("word-display"),
    wordBg: $("word-bg"), wordIconL: $("word-icon-l"), wordIconR: $("word-icon-r"),
    timerRow: $("timer-row"), timerBlocks: $("timer-blocks"), timerNum: $("timer-num"),
    canvasWrap: $("canvas-wrap"), pad: $("pad"), canvasHint: $("canvas-hint"),
    stamp: $("stamp"), stampTitle: $("stamp-title"), stampSub: $("stamp-sub"),
    stampPts: $("stamp-pts"), stampHint: $("stamp-hint"), stampTaunt: $("stamp-taunt"),
    confirmbar: $("confirmbar"), confirmText: $("confirm-text"),
    botSprite: $("bot-sprite"), botStatus: $("bot-status"), radar: $("radar"),
    feed: $("feed"),
    targetLabel: $("target-label"), targetWord: $("target-word"), btnGiveUp: $("btn-give-up"),
    resultsTitle: $("results-title").querySelector(".hz-label"),
    resultsTrophy: $("results-trophy"), resultsTotal: $("results-total"),
    resultsList: $("results-list"), replayLabel: $("replay-label"),
    replayCanvas: $("replay-canvas"), rematchLabel: $("rematch-label"),
    btnPoster: $("btn-poster"),
    spectator: $("spectator"), spectatorQr: $("spectator-qr"),
    settings: $("settings"), inpKey: $("inp-key"), keyStatus: $("key-status"),
    voiceCurrent: $("voice-current"), voiceList: $("voice-list"),
    countdown: $("countdown"), countdownNum: $("countdown-num"),
    attract: $("attract"), attractCanvas: $("attract-canvas"),
    attractGuess: $("attract-guess"),
    flicker: $("flicker")
  };

  var TIMER_SECONDS = 60;
  var TIMER_BLOCKS = 20;

  /* ================= match state ================= */

  var M = {
    mode: null,               // 'duel' | 'practice' | 'party'
    difficulty: "easy",
    roundsChoice: 5,          // duel length picked on the setup screen
    players: [],              // {name, score, streak, rounds:[]}
    cur: 0,
    roundsPerPlayer: 5,
    cycle: 1,                 // party: which round-of-each-player
    word: null,
    usedWords: new Set(),
    roundActive: false,
    roundSeconds: TIMER_SECONDS,  // per-round clock (sudden death shrinks it)
    suddenDeath: false,
    roundStartAt: 0,
    wrongGuesses: [],
    timerId: null,
    lastTickSec: -1,
    pendingConfirm: null,     // {guess, time}
    advance: null             // what [ENTER] does right now
  };

  function player() { return M.players[M.cur]; }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }

  /* ================= screens ================= */

  function showScreen(name) {
    Object.keys(el.screens).forEach(function (k) {
      el.screens[k].classList.toggle("hidden", k !== name);
    });
    el.hud.classList.toggle("hidden", name !== "game" || M.mode === "practice");
    if (name === "game") SD.draw.setEnabled(M.roundActive || M.mode === "practice");
    // the word-reveal background animation only runs on its own screen
    if (name !== "word" && SD.wordart) SD.wordart.stop();
    // the menu/setup backdrop only animates on those screens
    if (SD.wordart) {
      if (name === "menu") SD.wordart.startMenu("robot", el.menuBg);
      else if (name === "setup") SD.wordart.startMenu("robot", el.setupBg);
      else SD.wordart.stopMenu();
    }
    // attract mode: arm the idle timer on the menu, kill it everywhere else
    if (typeof armIdle === "function") {
      if (name === "menu") armIdle();
      else { exitAttract(); clearTimeout(idleTimer); }
    }
  }

  /* ================= effects ================= */

  function flicker() {
    el.flicker.classList.remove("zap");
    void el.flicker.offsetWidth;
    el.flicker.classList.add("zap");
  }

  function shake() {
    document.body.classList.remove("shake");
    void document.body.offsetWidth;
    document.body.classList.add("shake");
    setTimeout(function () { document.body.classList.remove("shake"); }, 320);
  }

  function animateNumber(node, from, to, fmt, done) {
    var steps = 8, i = 0;
    var iv = setInterval(function () {
      i++;
      var v = Math.round(from + (to - from) * (i / steps));
      node.textContent = fmt(v);
      SD.audio.scoreTick();
      if (i >= steps) { clearInterval(iv); if (done) done(); }
    }, 55);
  }

  /* ================= HUD ================= */

  function renderHUD() {
    if (!player()) return;
    var p = player();
    el.hudPlayer.textContent = p.name;
    if (M.mode === "party") {
      el.hudRound.textContent = "ROUND " + pad(M.cycle) + "/" + pad(M.roundsPerPlayer);
    } else {
      el.hudRound.textContent = "ROUND " + pad(p.rounds.length + (M.roundActive ? 1 : 0) || 1) + "/" + pad(M.roundsPerPlayer);
    }
    el.hudScore.textContent = "SCORE " + pad(p.score, 4);
    if (p.streak >= 2) {
      el.hudStreak.textContent = "STREAK x" + p.streak;
      el.hudStreak.classList.remove("hidden");
    } else {
      el.hudStreak.classList.add("hidden");
    }
  }

  /* ================= bot status ================= */

  var lastStatus = "";

  function setBotStatus(kind, extra) {
    var key = kind + JSON.stringify(extra || "");
    if (key === lastStatus) return;
    lastStatus = key;
    el.botStatus.className = "";
    el.radar.classList.add("hidden");
    switch (kind) {
      case "offline":
        el.botStatus.textContent = "AI STATUS: OFFLINE"; break;
      case "standby":
        el.botStatus.textContent = "AI STATUS: STANDBY"; break;
      case "waiting":
        el.botStatus.textContent = "AI STATUS: AWAITING INK";
        SD.bot.set("idle");
        break;
      case "scanning":
        el.botStatus.textContent = "AI STATUS: SCANNING...";
        el.botStatus.classList.add("status-hot");
        el.radar.classList.remove("hidden");
        SD.bot.set("scan");
        break;
      case "thinking":
        el.botStatus.textContent = "AI STATUS: PROCESSING...";
        el.botStatus.classList.add("status-hot");
        el.radar.classList.remove("hidden");
        SD.bot.set("scan");
        break;
      case "lost":
        el.botStatus.textContent = "SIGNAL LOST - RETRY " + extra.retryIn + "s";
        el.botStatus.classList.add("status-err");
        // technical detail goes to the console, the player gets arcade flavor
        console.warn("SKETCHDUEL: Gemini request failed" + (extra.status ? " (HTTP " + extra.status + ")" : "") + ", retrying in " + extra.retryIn + "s");
        sysline("* SIGNAL LOST - RECONNECTING... *", true);
        SD.audio.error();
        break;
      case "unavailable":
        el.botStatus.textContent = "AI STATUS: UNAVAILABLE";
        SD.bot.set("slump");
        break;
    }
    updateCanvasHint();
  }

  function updateCanvasHint() {
    var show = (M.roundActive || M.mode === "practice") &&
      el.screens.game && !el.screens.game.classList.contains("hidden") &&
      !SD.draw.hasVisibleInk();
    el.canvasHint.classList.toggle("hidden", !show);
  }

  /* ================= guess feed ================= */

  function sysline(text, isErr) {
    var d = document.createElement("div");
    d.className = "sysline" + (isErr ? " err" : "");
    d.textContent = text;
    el.feed.insertBefore(d, el.feed.firstChild);
    trimFeed();
  }

  function bubble(parsed, isWinner) {
    var b = document.createElement("div");
    b.className = "bubble" + (isWinner ? " winner" : "");
    var r = document.createElement("div");
    r.className = "reaction";
    r.textContent = parsed.reaction || "...";
    var g = document.createElement("div");
    g.className = "guessline";
    g.textContent = "> " + parsed.guess.toUpperCase() + "?";
    var c = document.createElement("div");
    c.className = "conf";
    var on = Math.round(parsed.confidence * 5);
    for (var i = 0; i < 5; i++) {
      var seg = document.createElement("i");
      if (i < on) seg.className = "on";
      c.appendChild(seg);
    }
    b.appendChild(r); b.appendChild(g); b.appendChild(c);
    el.feed.insertBefore(b, el.feed.firstChild);
    trimFeed();
    SD.audio.pop();
    return b;
  }

  function trimFeed() {
    while (el.feed.children.length > 40) el.feed.removeChild(el.feed.lastChild);
  }

  function clearFeed() { el.feed.innerHTML = ""; }

  /* ================= AI loop hookup ================= */

  function startAiLoop() {
    SD.ai.start({
      prevGuesses: function () { return M.wrongGuesses.slice(-18); },
      onStatus: setBotStatus,
      onGuess: onGuess
    });
  }

  function onGuess(parsed) {
    if (!M.roundActive && M.mode !== "practice") return;

    var isWin = false, verdict = "no";
    if (M.mode !== "practice" && M.word) {
      verdict = SD.match.compare(parsed.guess, M.word);
      isWin = verdict === "exact";
    }

    bubble(parsed, isWin);

    // speech: reaction usually contains the guess; avoid stuttering it twice
    var line = parsed.reaction || "";
    if (line.toLowerCase().indexOf(parsed.guess.toLowerCase()) === -1) {
      line = (line ? line + " ... " : "") + parsed.guess + "?";
    }
    SD.voice.speak(line, parsed.confidence);

    if (parsed.isGivingUp) {
      sysline("* BOT DECLARES YOUR ART UNREADABLE. IT GUESSES ANYWAY. *");
      SD.bot.pulse("slump", 1400);
    } else if (parsed.confidence >= 0.75) {
      SD.bot.pulse("confident", 1600);
    }

    if (M.mode === "practice" || !M.word) return;

    if (isWin) {
      winRound(parsed.guess);
    } else if (verdict === "close" && !M.pendingConfirm) {
      M.pendingConfirm = {
        guess: parsed.guess,
        time: (performance.now() - M.roundStartAt) / 1000
      };
      el.confirmText.textContent =
        'CLOSE CALL: "' + parsed.guess.toUpperCase() + '" ~ "' + M.word.toUpperCase() + '"?';
      el.confirmbar.classList.remove("hidden");
    } else {
      var n = SD.match.norm(parsed.guess);
      if (M.wrongGuesses.indexOf(n) === -1) M.wrongGuesses.push(n);
    }
  }

  function resolveConfirm(accept) {
    if (!M.pendingConfirm) return;
    var pc = M.pendingConfirm;
    M.pendingConfirm = null;
    el.confirmbar.classList.add("hidden");
    if (accept) {
      winRound(pc.guess, pc.time);
    } else {
      var n = SD.match.norm(pc.guess);
      if (M.wrongGuesses.indexOf(n) === -1) M.wrongGuesses.push(n);
      sysline("* REJECTED. THE DUEL CONTINUES. *");
    }
  }

  /* ================= timer ================= */

  function buildTimerBlocks() {
    el.timerBlocks.innerHTML = "";
    for (var i = 0; i < TIMER_BLOCKS; i++) {
      var b = document.createElement("div");
      b.className = "tblock";
      el.timerBlocks.appendChild(b);
    }
  }

  function startTimer() {
    stopTimer();
    M.lastTickSec = -1;
    el.timerRow.classList.remove("notimer");
    renderTimer(M.roundSeconds);
    M.timerId = setInterval(function () {
      var remaining = M.roundSeconds - (performance.now() - M.roundStartAt) / 1000;
      if (remaining <= 0) {
        renderTimer(0);
        loseRound(false);
        return;
      }
      renderTimer(remaining);
    }, 120);
  }

  function stopTimer() {
    clearInterval(M.timerId);
    M.timerId = null;
  }

  function renderTimer(remaining) {
    var danger = remaining <= 10 && remaining > 0;
    var blocks = el.timerBlocks.children;
    var on = Math.ceil(remaining / (M.roundSeconds / TIMER_BLOCKS));
    for (var i = 0; i < blocks.length; i++) {
      blocks[i].className = "tblock" +
        (i < on ? (danger ? " danger" : "") : " off");
    }
    el.timerBlocks.classList.toggle("danger-blink", danger);
    el.timerNum.textContent = Math.ceil(remaining);
    el.timerNum.classList.toggle("danger", danger);
    var sec = Math.floor(remaining);
    if (danger && sec !== M.lastTickSec) {
      M.lastTickSec = sec;
      SD.audio.tick();
    }
  }

  function setTimerFreestyle() {
    el.timerRow.classList.add("notimer");
    var blocks = el.timerBlocks.children;
    for (var i = 0; i < blocks.length; i++) blocks[i].className = "tblock off";
    el.timerNum.textContent = "--";
    el.timerNum.classList.remove("danger");
  }

  /* ================= round flow ================= */

  function startMatch(mode) {
    // never block the player on configuration - the show goes on,
    // and engageAI() degrades gracefully if the key is absent
    M.mode = mode;
    M.usedWords = new Set();
    M.cycle = 1;
    M.cur = 0;
    if (mode === "duel") {
      M.roundsPerPlayer = M.roundsChoice || 5;
      M.players = [{ name: "P1", score: 0, streak: 0, rounds: [] }];
      beginRoundFlow();
    } else if (mode === "practice") {
      M.players = [{ name: "P1", score: 0, streak: 0, rounds: [] }];
      startPractice();
    }
    // party is started from its setup screen via startPartyMatch()
  }

  function startPartyMatch(names) {
    M.mode = "party";
    M.roundsPerPlayer = 3;
    M.usedWords = new Set();
    M.cycle = 1;
    M.cur = 0;
    M.players = names.map(function (n) {
      return { name: n, score: 0, streak: 0, rounds: [] };
    });
    beginRoundFlow();
  }

  function beginRoundFlow() {
    M.word = null;
    if (M.mode === "party" && M.players.length > 1) {
      el.passName.textContent = player().name;
      M.advance = showWordReveal;
      showScreen("pass");
    } else {
      showWordReveal();
    }
  }

  function renderWordScreen() {
    el.wordDisplay.textContent = M.word.toUpperCase();
    // rebuild the sprite icons + the entire animated background pattern
    SD.wordart.setWord(M.word, el.wordIconL, el.wordIconR);
  }

  function showWordReveal() {
    // SUDDEN DEATH: the final duel round is a 20s, hard-word, double-or-nothing
    // finale with red-pulsing edges. Party mode keeps its normal cadence.
    var isFinal = M.mode === "duel" &&
      player().rounds.length === M.roundsPerPlayer - 1;
    M.suddenDeath = isFinal;
    M.roundSeconds = isFinal ? 20 : TIMER_SECONDS;
    M.word = SD.pickWord(isFinal ? "hard" : M.difficulty, M.usedWords);

    var label = M.mode === "party"
      ? player().name + " - ROUND " + pad(M.cycle) + "/" + pad(M.roundsPerPlayer)
      : "ROUND " + pad(player().rounds.length + 1) + "/" + pad(M.roundsPerPlayer);
    el.wordRoundLabel.textContent = isFinal ? "SUDDEN DEATH - FINAL ROUND" : label;
    el.screens.word.classList.toggle("sudden", isFinal);
    el.screens.game.classList.toggle("sudden", isFinal);
    M.advance = startCountdown;
    showScreen("word");
    renderWordScreen();
  }

  /* [TAB] on the reveal screen: swap the secret word (and its whole
     pattern) without leaving the screen */
  function skipWord() {
    if (el.screens.word.classList.contains("hidden")) return;
    M.word = SD.pickWord(M.difficulty, M.usedWords);
    renderWordScreen();
    SD.audio.click();
  }

  function startCountdown() {
    M.advance = null;
    showScreen("game");
    resetRoundBoard();
    el.countdown.classList.remove("hidden");
    var seq = ["3", "2", "1", "DRAW!"];
    var i = 0;
    function step() {
      if (i < seq.length) {
        el.countdownNum.textContent = seq[i];
        if (seq[i] === "DRAW!") SD.audio.go(); else SD.audio.count();
        i++;
        setTimeout(step, i === seq.length ? 550 : 750);
      } else {
        el.countdown.classList.add("hidden");
        startRound();
      }
    }
    step();
  }

  function resetRoundBoard() {
    SD.draw.clear();
    SD.confetti.clear();
    if (el.stampTaunt) { el.stampTaunt.textContent = ""; el.stampTaunt.classList.remove("thinking"); }
    clearFeed();
    M.wrongGuesses = [];
    M.pendingConfirm = null;
    el.confirmbar.classList.add("hidden");
    el.stamp.classList.add("hidden");
    el.targetLabel.textContent = "TARGET";
    el.targetWord.textContent = M.word ? M.word.toUpperCase() : "????";
    el.btnGiveUp.textContent = "FORFEIT";
    setBotStatus("standby");
    SD.bot.set("idle");
    renderHUD();
  }

  /* start the guessing engine, or degrade gracefully: the player
     never sees anything technical, developers get the console */
  function engageAI() {
    if (SD.ai.hasKey()) {
      startAiLoop();
      return true;
    }
    console.error("SKETCHDUEL: no Gemini API key found in js/config.js - AI guessing is disabled for this session.");
    setBotStatus("unavailable");
    sysline("* THE AI IS TEMPORARILY UNAVAILABLE. *", true);
    sysline("* YOUR DRAWING STILL WORKS. IT JUST WON'T BE JUDGED. *");
    return false;
  }

  function startRound() {
    M.roundActive = true;
    M.roundStartAt = performance.now();
    SD.draw.setEnabled(true);
    startTimer();
    if (engageAI()) sysline("* ROUND START. THE MACHINE IS WATCHING. *");
    renderHUD();
    updateCanvasHint();
  }

  function haltRound() {
    M.roundActive = false;
    stopTimer();
    SD.ai.stop();               // aborts in-flight fetch + cancels speech
    SD.draw.setEnabled(false);
    M.pendingConfirm = null;
    el.confirmbar.classList.add("hidden");
    el.canvasHint.classList.add("hidden");
  }

  // TAUNT ENGINE: fetch a between-rounds jab from the real round data and
  // drop it on the stamp + speak it hyped. Never blocks advancing.
  function showTaunt(data) {
    var t = el.stampTaunt;
    t.classList.add("thinking");
    t.textContent = "SKETCH-BOT IS TYPING...";
    var token = (M.tauntToken = (M.tauntToken || 0) + 1);
    SD.ai.taunt(data).then(function (line) {
      if (token !== M.tauntToken) return;      // a newer round already moved on
      t.classList.remove("thinking");
      t.textContent = line;
      SD.voice.speak(line, 0.9);               // hot-mic: taunts land excited
    });
  }

  function winRound(guess, timeOverride) {
    if (!M.roundActive) return;
    var elapsed = timeOverride != null
      ? timeOverride
      : (performance.now() - M.roundStartAt) / 1000;
    elapsed = Math.min(elapsed, M.roundSeconds);
    haltRound();

    var p = player();
    p.streak++;
    var base = Math.max(10, 100 - Math.round(elapsed));
    var bonus = (p.streak - 1) * 15;
    var pts = base + bonus;
    if (M.suddenDeath) pts *= 2;   // SUDDEN DEATH: double or nothing
    var oldScore = p.score;
    p.score += pts;
    p.rounds.push({
      word: M.word, won: true, time: elapsed, pts: pts,
      sketch: SD.draw.exportStrokes()
    });

    SD.bot.set("celebrate");
    setBotStatus("standby");
    el.botStatus.textContent = "AI STATUS: VICTORIOUS";
    SD.audio.win();
    SD.audio.party();
    SD.confetti.burst();
    flicker();
    shake();

    el.stamp.classList.remove("hidden", "lost");
    el.stampTitle.textContent = "IT GUESSED IT!";
    el.stampSub.textContent = M.word.toUpperCase() + " - " + elapsed.toFixed(1) + "s";
    el.stampPts.textContent = M.suddenDeath
      ? "+" + pts + " PTS - SUDDEN DEATH x2!"
      : "+" + base + " PTS" + (bonus ? " / STREAK x" + p.streak + " +" + bonus : "");
    el.stampHint.textContent = "PRESS [ENTER]";
    animateNumber(el.hudScore, oldScore, p.score, function (v) { return "SCORE " + pad(v, 4); });
    renderHUD();
    el.hudScore.textContent = "SCORE " + pad(oldScore, 4); // let the tick-up run

    showTaunt({
      word: M.word, difficulty: M.difficulty, won: true, timeSec: elapsed,
      streak: p.streak, roundNum: p.rounds.length, totalRounds: M.roundsPerPlayer,
      suddenDeath: !!M.suddenDeath
    });
    M.advance = advanceAfterRound;
  }

  function loseRound(forfeit) {
    if (!M.roundActive) return;
    haltRound();
    var p = player();
    p.streak = 0;
    p.rounds.push({
      word: M.word, won: false, time: M.roundSeconds, pts: 0,
      sketch: SD.draw.exportStrokes()
    });

    SD.bot.set("slump");
    el.botStatus.textContent = forfeit ? "AI STATUS: OPPONENT FLED" : "AI STATUS: OUT OF TIME";
    SD.audio.lose();

    el.stamp.classList.remove("hidden");
    el.stamp.classList.add("lost");
    el.stampTitle.textContent = forfeit ? "SIGNAL TERMINATED" : "TIME'S UP!";
    el.stampSub.textContent = "THE WORD WAS: " + M.word.toUpperCase();
    el.stampPts.textContent = "NO POINTS";
    el.stampHint.textContent = "PRESS [ENTER]";
    renderHUD();

    showTaunt({
      word: M.word, difficulty: M.difficulty, won: false, timeSec: M.roundSeconds,
      streak: 0, roundNum: p.rounds.length, totalRounds: M.roundsPerPlayer,
      forfeit: !!forfeit, suddenDeath: !!M.suddenDeath
    });
    M.advance = advanceAfterRound;
  }

  function advanceAfterRound() {
    M.advance = null;
    el.stamp.classList.add("hidden");

    if (M.mode === "party") {
      M.cur++;
      if (M.cur >= M.players.length) {
        M.cur = 0;
        M.cycle++;
      }
      if (M.cycle > M.roundsPerPlayer) { showResults(); return; }
      beginRoundFlow();
    } else {
      if (player().rounds.length >= M.roundsPerPlayer) { showResults(); return; }
      beginRoundFlow();
    }
  }

  /* ================= practice ================= */

  function startPractice() {
    showScreen("game");
    M.word = null;
    resetRoundBoard();
    setTimerFreestyle();
    el.targetLabel.textContent = "MODE";
    el.targetWord.textContent = "FREESTYLE";
    el.btnGiveUp.textContent = "END SESSION";
    SD.draw.setEnabled(true);
    if (engageAI()) sysline("* FREESTYLE. DRAW ANYTHING. IT WILL HAVE OPINIONS. *");
    updateCanvasHint();
  }

  function endPractice() {
    SD.ai.stop();
    SD.draw.setEnabled(false);
    M.mode = null;
    showScreen("menu");
  }

  /* ================= results ================= */

  var replayHandle = null;

  function showResults() {
    haltRound();
    showScreen("results");
    SD.audio.win();
    flicker();

    el.resultsTrophy.innerHTML = SD.px.toSVG(SD.SPRITES.trophy);
    var best = null, bestOwner = null;

    if (M.mode === "party") {
      el.resultsTitle.textContent = "FINAL STANDINGS";
      var ranked = M.players.slice().sort(function (a, b) { return b.score - a.score; });
      el.resultsList.innerHTML = "";
      ranked.forEach(function (p, i) {
        var row = document.createElement("div");
        row.className = "rrow" + (i === 0 ? " champ" : "");
        row.innerHTML =
          '<span class="rr-label">' + (i + 1) + '.</span>' +
          '<span class="rr-word"></span><span class="rr-dots"></span>' +
          '<span class="rr-pts"></span>';
        row.querySelector(".rr-word").textContent = p.name + (i === 0 ? " - CHAMPION" : "");
        row.querySelector(".rr-dots").textContent = ".".repeat(30);
        row.querySelector(".rr-pts").textContent = pad(p.score, 4) + " PTS";
        el.resultsList.appendChild(row);
      });
      el.resultsTotal.textContent = "WINNER: " + ranked[0].name;
      M.players.forEach(function (p) {
        p.rounds.forEach(function (r) {
          if (r.won && (!best || r.time < best.time)) { best = r; bestOwner = p; }
        });
      });
    } else {
      var p = player();
      el.resultsTitle.textContent = "MATCH COMPLETE";
      el.resultsTotal.textContent = "TOTAL: " + pad(p.score, 4);
      el.resultsList.innerHTML = "";
      p.rounds.forEach(function (r, i) {
        var row = document.createElement("div");
        row.className = "rrow" + (r.won ? "" : " miss");
        row.innerHTML =
          '<span class="rr-label">R' + (i + 1) + '</span>' +
          '<span class="rr-word"></span><span class="rr-dots"></span>' +
          '<span class="rr-time"></span><span class="rr-pts"></span>';
        row.querySelector(".rr-word").textContent = r.word.toUpperCase();
        row.querySelector(".rr-dots").textContent = ".".repeat(24);
        row.querySelector(".rr-time").textContent = r.won ? r.time.toFixed(1) + "s" : "MISS";
        row.querySelector(".rr-pts").textContent = r.won ? "+" + r.pts : "+0";
        el.resultsList.appendChild(row);
        if (r.won && (!best || r.time < best.time)) { best = r; bestOwner = p; }
      });
    }

    if (replayHandle) replayHandle.stop();
    var rc = el.replayCanvas.getContext("2d");
    rc.fillStyle = "#0a0a08";
    rc.fillRect(0, 0, el.replayCanvas.width, el.replayCanvas.height);

    var wins = M.players.some(function (p) {
      return p.rounds.some(function (r) { return r.won; });
    });
    SD.bot.set(wins ? "celebrate" : "slump");

    if (best) {
      el.replayLabel.textContent = "BEST SKETCH: " +
        (M.mode === "party" ? bestOwner.name + "'S " : "") +
        best.word.toUpperCase() + " - " + best.time.toFixed(1) + "s";
      replayHandle = SD.draw.replay(el.replayCanvas, best.sketch, { loop: true });
    } else {
      el.replayLabel.textContent = "NOTHING GOT PAST THE BOT. IT REMAINS UNDEFEATED.";
      var fallback = null;
      M.players.forEach(function (p) {
        p.rounds.forEach(function (r) { if (r.sketch.strokes.length) fallback = r; });
      });
      if (fallback) replayHandle = SD.draw.replay(el.replayCanvas, fallback.sketch, { loop: true });
    }

    // WANTED POSTER payload: hero the best win (or the fullest sketch drawn)
    var star = best, owner = bestOwner || player();
    if (!star) {
      M.players.forEach(function (p) {
        p.rounds.forEach(function (r) {
          if (r.sketch && r.sketch.strokes.length) { star = r; owner = p; }
        });
      });
    }
    M.poster = star ? {
      word: star.word, won: !!star.won, time: star.time || 0,
      score: owner.score, streak: (star.won ? owner.streak : 0), sketch: star.sketch
    } : null;
    el.btnPoster.classList.toggle("hidden", !M.poster);

    // SPECTATOR QR: party mode only - scan to open the standings on a phone
    var showQR = M.mode === "party" && SD.spectator;
    if (showQR) {
      showQR = !!SD.spectator.render(el.spectatorQr, M.players, "FINAL STANDINGS");
    }
    el.spectator.classList.toggle("hidden", !showQR);

    M.advance = null;
  }

  function rematch() {
    if (replayHandle) { replayHandle.stop(); replayHandle = null; }
    M.players.forEach(function (p) { p.score = 0; p.streak = 0; p.rounds = []; });
    M.usedWords = new Set();
    M.cycle = 1;
    M.cur = 0;
    beginRoundFlow();
  }

  function toMenu() {
    if (replayHandle) { replayHandle.stop(); replayHandle = null; }
    haltRound();
    M.mode = null;
    SD.bot.set("idle");
    showScreen("menu");
  }

  /* ================= settings ================= */

  var keyFromConfig = false;

  /* the config drawer is a developer tool: hidden in demos, reachable
     only via ?dev=true or Ctrl+Shift+D */
  var DEV = /^(1|true)$/i.test(new URLSearchParams(location.search).get("dev") || "");

  function enterDevMode() {
    DEV = true;
    el.btnSettings.classList.remove("hidden");
  }

  function openSettings(msg) {
    el.settings.classList.remove("closed");
    if (msg) {
      el.keyStatus.textContent = msg;
      el.keyStatus.className = "cfg-status bad";
    } else if (keyFromConfig && SD.ai.hasKey()) {
      el.keyStatus.textContent = "KEY AUTO-LOADED FROM js/config.js.";
      el.keyStatus.className = "cfg-status ok";
    }
    setTimeout(function () { el.inpKey.focus(); }, 200);
  }

  function closeSettings() {
    el.settings.classList.add("closed");
    el.voiceList.classList.add("hidden");
    renderCoreStatus();
  }

  function settingsOpen() { return !el.settings.classList.contains("closed"); }

  function renderCoreStatus() {
    // the menu no longer surfaces AI status to players (demo-clean).
    // kept as a no-op-safe hook for the dev config drawer.
    if (!el.coreStatus) return;
    if (SD.ai.hasKey()) {
      el.coreStatus.textContent = "LINKED. READY TO JUDGE YOU.";
      el.coreStatus.className = "core-ok";
    } else {
      el.coreStatus.textContent = "TEMPORARILY UNAVAILABLE";
      el.coreStatus.className = "core-bad";
    }
  }

  /* custom voice picker: hover a row and the voice introduces itself */
  var chosenVoiceURI = "";
  var previewTimer = null;

  function cleanVoiceName(name) {
    var n = String(name).replace(/microsoft|google|desktop|online|natural/gi, "");
    n = n.split(/[-(,]/)[0].trim();
    return n || name;
  }

  function populateVoices() {
    var voices = SD.voice.list().filter(function (v) {
      return /^en/i.test(v.lang || "");
    });
    if (!voices.length) voices = SD.voice.list();
    el.voiceList.innerHTML = "";
    if (!voices.length) return;
    if (!chosenVoiceURI) {
      chosenVoiceURI = voices[0].voiceURI;
      SD.voice.setVoice(chosenVoiceURI);
      el.voiceCurrent.textContent = voices[0].name.toUpperCase().slice(0, 30);
    }
    voices.forEach(function (v) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "voice-row" + (v.voiceURI === chosenVoiceURI ? " sel" : "");
      row.textContent = v.name.toUpperCase().slice(0, 38);
      row.addEventListener("mouseenter", function () {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(function () {
          SD.voice.preview(v, "Hi! I am " + cleanVoiceName(v.name) + ".");
        }, 160);
      });
      row.addEventListener("mouseleave", function () {
        clearTimeout(previewTimer);
      });
      row.addEventListener("click", function () {
        chosenVoiceURI = v.voiceURI;
        SD.voice.setVoice(v.voiceURI);
        el.voiceCurrent.textContent = v.name.toUpperCase().slice(0, 30);
        el.voiceList.classList.add("hidden");
        populateVoices(); // refresh the > marker
        SD.voice.preview(v, "Voice locked in. Let's duel.");
      });
      el.voiceList.appendChild(row);
    });
  }

  /* ================= party setup ================= */

  var partyCount = 2;

  function renderPartyInputs() {
    el.partyNames.innerHTML = "";
    for (var i = 0; i < partyCount; i++) {
      var row = document.createElement("div");
      row.className = "pname-row";
      var lab = document.createElement("span");
      lab.className = "pname-label";
      lab.textContent = "P" + (i + 1);
      var inp = document.createElement("input");
      inp.type = "text";
      inp.maxLength = 10;
      inp.placeholder = "PLAYER " + (i + 1);
      inp.autocomplete = "off";
      row.appendChild(lab); row.appendChild(inp);
      el.partyNames.appendChild(row);
    }
  }

  function partyStart() {
    var names = Array.prototype.map.call(
      el.partyNames.querySelectorAll("input"),
      function (inp, i) {
        return (inp.value.trim() || "PLAYER " + (i + 1)).toUpperCase().slice(0, 10);
      });
    startPartyMatch(names);
  }

  /* ================= attract marquee ================= */

  var ATTRACT = [
    "INSERT BRAIN TO CONTINUE",
    "YOUR OPPONENT NEVER SLEEPS",
    "IT HAS SEEN 10,000 BAD DRAWINGS - YOURS IS NEXT",
    "SKETCH-BOT 9000 IS UNDEFEATED... SO FAR",
    "NO REFUNDS ON LOST DUELS",
    "DRAW FAST. IT ROASTS FASTER."
  ];
  (function buildMarquee() {
    var track = $("attract-track");
    if (!track) return;
    var line = ATTRACT.join("   ◆   ") + "   ◆   ";
    // duplicated so the -50% translate loops seamlessly
    track.textContent = line + line;
  })();

  /* menu/setup mascot: occasional blink so it feels alive */
  function blinkMascot(botEl, screenEl) {
    if (!botEl || screenEl.classList.contains("hidden")) return;
    botEl.innerHTML = SD.px.toSVG(SD.SPRITES.blink);
    setTimeout(function () {
      if (!screenEl.classList.contains("hidden")) {
        botEl.innerHTML = SD.px.toSVG(SD.SPRITES.idle);
      }
    }, 170);
  }
  setInterval(function () {
    blinkMascot(el.menuBot, el.screens.menu);
    blinkMascot(el.setupBot, el.screens.setup);
  }, 3400);

  /* ================= attract mode ================= */
  /* idle 30s on the menu -> a self-playing demo cabinet: ghost replays of
     sample sketches cycle with the bot "guessing" them + a blinking prompt.
     Any input drops back to the menu. */

  function YSTROKE(pts) { return { color: "#ffd400", size: 5, eraser: false, pts: pts }; }
  function ARC(cx, cy, r, d0, d1, n) {
    var a = [];
    for (var i = 0; i <= n; i++) {
      var t = (d0 + (d1 - d0) * (i / n)) * Math.PI / 180;
      a.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
    }
    return a;
  }
  function STAR(cx, cy, R, r, pk) {
    var a = [];
    for (var i = 0; i <= pk * 2; i++) {
      var t = i / (pk * 2) * Math.PI * 2 - Math.PI / 2;
      var rad = i % 2 ? r : R;
      a.push({ x: cx + Math.cos(t) * rad, y: cy + Math.sin(t) * rad });
    }
    return a;
  }
  var ATTRACT_SKETCHES = [
    { word: "house", data: { w: 520, h: 380, strokes: [
      YSTROKE([{x:170,y:230},{x:170,y:310},{x:350,y:310},{x:350,y:230},{x:170,y:230}]),
      YSTROKE([{x:150,y:230},{x:260,y:145},{x:370,y:230}]),
      YSTROKE([{x:240,y:310},{x:240,y:258},{x:285,y:258},{x:285,y:310}])
    ] } },
    { word: "star", data: { w: 520, h: 380, strokes: [ YSTROKE(STAR(260, 190, 120, 50, 5)) ] } },
    { word: "fish", data: { w: 520, h: 380, strokes: [
      YSTROKE(ARC(250, 190, 100, 0, 360, 40)),
      YSTROKE([{x:346,y:190},{x:410,y:145},{x:410,y:235},{x:346,y:190}]),
      YSTROKE([{x:205,y:172},{x:205,y:174}])
    ] } },
    { word: "smiley", data: { w: 520, h: 380, strokes: [
      YSTROKE(ARC(260, 190, 110, 0, 360, 44)),
      YSTROKE([{x:222,y:165},{x:222,y:167}]),
      YSTROKE([{x:298,y:165},{x:298,y:167}]),
      YSTROKE(ARC(260, 205, 60, 25, 155, 20))
    ] } }
  ];

  var idleTimer = null, attractOn = false, attractIdx = 0;
  var attractReplay = null, attractCycle = null;
  var IDLE_MS = 30000;

  function armIdle() {
    clearTimeout(idleTimer);
    if (attractOn) return;
    if (el.screens.menu.classList.contains("hidden")) return;  // menu only
    idleTimer = setTimeout(enterAttract, IDLE_MS);
  }

  function playAttractSketch() {
    var s = ATTRACT_SKETCHES[attractIdx % ATTRACT_SKETCHES.length];
    attractIdx++;
    el.attractGuess.textContent = 'SKETCH-BOT SEES: "' + s.word.toUpperCase() + '"';
    if (attractReplay) attractReplay.stop();
    attractReplay = SD.draw.replay(el.attractCanvas, s.data, { duration: 2600 });
  }

  function enterAttract() {
    if (attractOn || el.screens.menu.classList.contains("hidden")) return; // menu only
    attractOn = true;
    el.attract.classList.remove("hidden");
    attractIdx = 0;
    playAttractSketch();
    attractCycle = setInterval(playAttractSketch, 4200);
  }

  function exitAttract() {
    if (!attractOn) return;
    attractOn = false;
    clearInterval(attractCycle);
    if (attractReplay) { attractReplay.stop(); attractReplay = null; }
    el.attract.classList.add("hidden");
  }

  function onUserActive() {
    if (attractOn) { exitAttract(); SD.audio.click(); }
    armIdle();
  }
  document.addEventListener("pointerdown", onUserActive);
  document.addEventListener("keydown", onUserActive);
  document.addEventListener("mousemove", onUserActive);

  /* ================= keyboard ================= */

  document.addEventListener("keydown", function (ev) {
    var tag = (document.activeElement || {}).tagName;
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    if (ev.key === "Escape") {
      if (settingsOpen()) { closeSettings(); ev.preventDefault(); }
      return;
    }
    // hidden developer shortcut
    if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === "d") {
      enterDevMode();
      openSettings();
      ev.preventDefault();
      return;
    }
    if (settingsOpen() || typing) return;

    // [TAB] skips the secret word on the reveal screen
    if (ev.key === "Tab" && !el.screens.word.classList.contains("hidden")) {
      skipWord();
      ev.preventDefault();
      return;
    }

    var k = ev.key.toLowerCase();

    // confirm bar has priority
    if (!el.confirmbar.classList.contains("hidden")) {
      if (k === "y") { resolveConfirm(true); ev.preventDefault(); return; }
      if (k === "n") { resolveConfirm(false); ev.preventDefault(); return; }
    }

    if (ev.key === "Enter" && M.advance) {
      var fn = M.advance;
      M.advance = null;
      fn();
      ev.preventDefault();
      return;
    }

    // results shortcuts
    if (!el.screens.results.classList.contains("hidden")) {
      if (k === "y") { rematch(); ev.preventDefault(); return; }
      if (k === "n") { toMenu(); ev.preventDefault(); return; }
    }

    if (k === "m") { toggleMute(); return; }

    // drawing shortcuts only on the game screen
    if (el.screens.game.classList.contains("hidden")) return;

    if ((ev.ctrlKey || ev.metaKey) && k === "z") {
      SD.draw.undo(); ev.preventDefault(); return;
    }
    switch (k) {
      case "e": setEraser(true); break;
      case "b": setEraser(false); break;
      case "c": SD.draw.clear(); onCanvasChange(); if (M.mode === "practice") M.wrongGuesses = []; break;
      case "1": selectSize(3); break;
      case "2": selectSize(6); break;
      case "3": selectSize(12); break;
    }
  });

  /* ================= toolbar ================= */

  function setEraser(on) {
    SD.draw.eraser = on;
    $("btn-eraser").classList.toggle("sel", on);
  }

  function selectSize(s) {
    SD.draw.size = s;
    document.querySelectorAll(".sizebtn").forEach(function (b) {
      b.classList.toggle("sel", Number(b.dataset.size) === s);
    });
  }

  function selectColor(c) {
    SD.draw.ink = c;
    SD.draw.eraser = false;
    $("btn-eraser").classList.remove("sel");
    document.querySelectorAll(".swatch").forEach(function (b) {
      b.classList.toggle("sel", b.dataset.color === c);
    });
  }

  function onCanvasChange() {
    updateCanvasHint();
  }

  /* ================= mute ================= */

  function toggleMute() {
    SD.audio.setMuted(!SD.audio.muted);
    el.btnMute.textContent = SD.audio.muted ? "SND:OFF" : "SND:ON";
    if (!SD.audio.muted) SD.audio.click();
  }

  /* ================= wiring ================= */

  function on(id, fn) { $(id).addEventListener("click", fn); }

  /* DUEL always goes through MATCH SETUP first: pick difficulty + rounds,
     only then reveal a word. (Also the landing-page ?mode=duel deep link.) */
  function showSetup() {
    M.advance = beginDuel;
    showScreen("setup");
  }

  function beginDuel() {
    M.advance = null;
    startMatch("duel");
  }

  on("btn-mode-duel", showSetup);
  on("btn-start-match", beginDuel);
  on("btn-setup-back", function () { M.advance = null; showScreen("menu"); });
  on("btn-mode-practice", function () { startMatch("practice"); });
  on("btn-mode-party", function () {
    renderPartyInputs();
    M.advance = partyStart;
    showScreen("party");
  });

  document.querySelectorAll(".diff").forEach(function (b) {
    b.addEventListener("click", function () {
      M.difficulty = b.dataset.diff;
      document.querySelectorAll(".diff").forEach(function (x) {
        x.classList.toggle("sel", x.dataset.diff === b.dataset.diff);
      });
    });
  });

  document.querySelectorAll(".rcount").forEach(function (b) {
    b.addEventListener("click", function () {
      M.roundsChoice = Number(b.dataset.rounds) || 5;
      document.querySelectorAll(".rcount").forEach(function (x) {
        x.classList.toggle("sel", x === b);
      });
    });
  });

  document.querySelectorAll(".pcount").forEach(function (b) {
    b.addEventListener("click", function () {
      partyCount = Number(b.dataset.count);
      document.querySelectorAll(".pcount").forEach(function (x) {
        x.classList.toggle("sel", x === b);
      });
      renderPartyInputs();
    });
  });

  on("btn-party-start", partyStart);
  on("btn-party-back", function () { M.advance = null; showScreen("menu"); });
  on("btn-pass-ready", function () { if (M.advance) { var f = M.advance; M.advance = null; f(); } });
  on("btn-word-start", function () { if (M.advance) { var f = M.advance; M.advance = null; f(); } });

  on("btn-give-up", function () {
    if (M.mode === "practice") endPractice();
    else if (M.roundActive) loseRound(true);
  });

  on("btn-confirm-y", function () { resolveConfirm(true); });
  on("btn-confirm-n", function () { resolveConfirm(false); });

  on("btn-rematch", rematch);
  on("btn-results-menu", toMenu);
  on("btn-poster", function () {
    if (!M.poster) return;   // click blip comes from js/uisound.js
    SD.poster.download(M.poster);
  });

  on("btn-undo", function () { SD.draw.undo(); });
  on("btn-clear", function () {
    SD.draw.clear();
    onCanvasChange();
    if (M.mode === "practice") {
      M.wrongGuesses = [];
      sysline("* CANVAS WIPED. FRESH SUBJECT. *");
    }
  });
  on("btn-eraser", function () { setEraser(!SD.draw.eraser); });

  document.querySelectorAll(".swatch").forEach(function (b) {
    b.addEventListener("click", function () { selectColor(b.dataset.color); });
  });
  document.querySelectorAll(".sizebtn").forEach(function (b) {
    b.addEventListener("click", function () { selectSize(Number(b.dataset.size)); });
  });

  on("btn-mute", toggleMute);
  on("btn-settings", function () { openSettings(); });
  on("btn-close-settings", closeSettings);

  on("btn-save-key", function () {
    SD.ai.setKey(el.inpKey.value);
    if (SD.ai.hasKey()) {
      el.keyStatus.textContent = "KEY LOADED. LIVES IN RAM ONLY.";
      el.keyStatus.className = "cfg-status ok";
    } else {
      el.keyStatus.textContent = "THAT WAS EMPTY.";
      el.keyStatus.className = "cfg-status bad";
    }
    renderCoreStatus();
  });

  on("btn-test-key", function () {
    var k = el.inpKey.value.trim() || SD.ai.key;
    if (!k) {
      el.keyStatus.textContent = "PASTE A KEY FIRST.";
      el.keyStatus.className = "cfg-status bad";
      return;
    }
    el.keyStatus.textContent = "PINGING THE MOTHERSHIP...";
    el.keyStatus.className = "cfg-status";
    SD.ai.testKey(k).then(function (ok) {
      if (ok) {
        SD.ai.setKey(k);
        el.keyStatus.textContent = "LINK ESTABLISHED. IT'S ALIVE.";
        el.keyStatus.className = "cfg-status ok";
      } else {
        el.keyStatus.textContent = "NO SIGNAL. CHECK THE KEY.";
        el.keyStatus.className = "cfg-status bad";
      }
      renderCoreStatus();
    });
  });

  el.voiceCurrent.addEventListener("click", function () {
    el.voiceList.classList.toggle("hidden");
  });
  on("btn-test-voice", function () {
    SD.voice.speak("I am Sketch-Bot 9000. Your doodles are already mine.");
  });

  // button-click blip + audio wake are handled globally by js/uisound.js

  if (window.speechSynthesis) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  /* ================= boot ================= */

  // key from js/config.js, so nobody types it every session
  var CFG = window.SKETCHDUEL_CONFIG || {};
  var cfgKey = String(CFG.GEMINI_API_KEY || "").trim();
  if (cfgKey && cfgKey !== "PASTE-YOUR-KEY-HERE") {
    SD.ai.setKey(cfgKey);
    keyFromConfig = true;
  }

  SD.bot.mount(el.botSprite);
  SD.wordart.mountBackground(el.wordBg);
  SD.wordart.mountMenu(el.menuBg);
  el.menuBot.innerHTML = SD.px.toSVG(SD.SPRITES.idle);   // menu mascot
  el.setupBot.innerHTML = SD.px.toSVG(SD.SPRITES.idle);  // setup mascot
  SD.draw.init(el.pad, el.canvasWrap, onCanvasChange);
  buildTimerBlocks();
  renderCoreStatus();
  setBotStatus("standby");
  showScreen("menu");

  if (DEV) enterDevMode();
  else el.btnSettings.classList.add("hidden");
  if (!SD.ai.hasKey()) {
    console.error("SKETCHDUEL: no Gemini API key in js/config.js. Players will see 'AI temporarily unavailable'. Add the key and reload.");
  }

  /* ================= demo/debug previews (?screen=game|results) ================= */

  var qp = new URLSearchParams(location.search);

  /* landing-page deep links: game.html?mode=duel|practice|party */
  var deepMode = qp.get("mode");
  if (deepMode === "duel") {
    showSetup();          // duel always picks difficulty + rounds first
  } else if (deepMode === "practice") {
    startMatch(deepMode);
  } else if (deepMode === "party") {
    renderPartyInputs();
    M.advance = partyStart;
    showScreen("party");
  }

  if (qp.get("attract") === "1") setTimeout(enterAttract, 400); // demo hook

  var preview = qp.get("screen");
  if (preview === "sudden") {
    // demo the SUDDEN DEATH final-round reveal
    M.mode = "duel";
    M.players = [{ name: "P1", score: 300, streak: 4,
      rounds: [{}, {}, {}, {}] }];
    M.difficulty = "medium";
    showWordReveal();   // rounds.length === 4 -> triggers sudden death
  } else if (preview === "game") {
    M.mode = "duel";
    M.players = [{ name: "P1", score: 142, streak: 2, rounds: [{}, {}] }];
    M.word = "volcano";
    M.roundActive = true;
    M.roundStartAt = performance.now() - 23000;
    showScreen("game");
    resetRoundBoard();
    renderTimer(37);
    SD.draw.setEnabled(true);
    setBotStatus("scanning");
    bubble({ guess: "mountain", confidence: 0.4, reaction: "Pointy. Very pointy. A mountain, obviously." });
    bubble({ guess: "campfire", confidence: 0.55, reaction: "Wait, those squiggles are smoke..." });
    bubble({ guess: "volcano", confidence: 0.9, reaction: "SMOKE ON A MOUNTAIN. That's a VOLCANO!" });
    M.roundActive = true;
    if (qp.get("confirm") === "1") {   // demo the close-call bar
      el.confirmText.textContent = 'CLOSE CALL: "TOP HAT" ~ "HAT"?';
      el.confirmbar.classList.remove("hidden");
    }
  } else if (preview === "win") {
    // demo the win moment: confetti + party blast + arcade stamp
    M.mode = "duel";
    M.players = [{ name: "P1", score: 142, streak: 2, rounds: [] }];
    M.word = "volcano";
    showScreen("game");
    resetRoundBoard();
    renderTimer(52);
    M.roundActive = true;
    M.roundStartAt = performance.now() - 8200;
    setTimeout(function () { winRound("volcano"); }, 500);
  } else if (preview === "word") {
    M.mode = "duel";
    M.players = [{ name: "P1", score: 0, streak: 0, rounds: [] }];
    M.difficulty = "medium";
    var forced = qp.get("word");
    if (forced) {
      // ?screen=word&word=duck jumps straight to a chosen word's reveal
      M.word = forced.toLowerCase();
      M.usedWords.add(M.word);
      el.wordRoundLabel.textContent = "ROUND 01/05";
      M.advance = startCountdown;
      showScreen("word");
      renderWordScreen();
    } else {
      showWordReveal();
    }
  } else if (preview === "settings") {
    enterDevMode();
    openSettings();
  } else if (preview === "results") {
    M.mode = "duel";
    M.players = [{
      name: "P1", score: 358, streak: 3,
      rounds: [
        { word: "sun", won: true, time: 6.4, pts: 94, sketch: { w: 400, h: 300, strokes: [] } },
        { word: "house", won: true, time: 12.1, pts: 103, sketch: { w: 400, h: 300, strokes: [] } },
        { word: "fish", won: false, time: 60, pts: 0, sketch: { w: 400, h: 300, strokes: [] } },
        { word: "kite", won: true, time: 9.8, pts: 120, sketch: { w: 400, h: 300, strokes: [] } },
        { word: "snake", won: true, time: 21.5, pts: 41, sketch: { w: 400, h: 300, strokes: [] } }
      ]
    }];
    showResults();
  } else if (preview === "party-results") {
    M.mode = "party";
    M.roundsPerPlayer = 3;
    function pr(name, score, best) {
      return { name: name, score: score, streak: 0, rounds: [
        { word: best, won: true, time: 8.2, pts: 92, sketch: { w: 400, h: 300, strokes: [
          { color: "#ffd400", size: 6, eraser: false, pts: [{x:120,y:180},{x:120,y:250},{x:280,y:250},{x:280,y:180},{x:120,y:180}] }
        ] } }
      ] };
    }
    M.players = [pr("ANANYA", 372, "house"), pr("PRAJITH", 358, "star"),
      pr("ROHAN", 210, "fish"), pr("MAYA", 195, "kite")];
    showResults();
  }
})();
