/* SKETCHDUEL AI core: Gemini vision loop + fuzzy matching + speech.
   Engineering rules:
   - never fire while a request is in flight (skip to the latest frame)
   - never send an unchanged canvas (revision check) or an empty one
   - strict JSON request, defensive parse, one retry on garbage
   - exponential backoff + SIGNAL LOST state on API errors
   - everything cancellable on round end (fetch + speech) */
window.SD = window.SD || {};

SD.ai = (function () {
  // model is overridable from js/config.js (GEMINI_MODEL) without touching code.
  // gemini-3.5-flash-lite: fast, non-thinking (no JSON truncation), and a far
  // larger free daily quota than gemini-3.5-flash (which caps at 20/day and
  // would be drained by a single 60s round).
  var MODEL = (window.SKETCHDUEL_CONFIG && window.SKETCHDUEL_CONFIG.GEMINI_MODEL) || "gemini-3.5-flash-lite";
  var ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent";
  // only "thinking" models accept thinkingConfig; lite models reject it (400)
  var IS_THINKING = !/lite/i.test(MODEL);

  // Two ways to reach Gemini:
  //  - LOCAL DEV: a key in js/config.js -> call Gemini directly with ?key=
  //  - DEPLOYED (Vercel): no local key -> POST to our /api/gemini serverless
  //    proxy, which holds the key in an env var (never shipped to the client)
  function proxyAvailable() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return false;
    var h = location.hostname;
    return h !== "localhost" && h !== "127.0.0.1" && h !== "0.0.0.0" && h !== "";
  }
  // where to POST a generateContent request, given the current key situation
  function apiURL() {
    return apiKey
      ? ENDPOINT + "?key=" + encodeURIComponent(apiKey)          // direct, keyed
      : "/api/gemini?model=" + encodeURIComponent(MODEL);        // server proxy
  }
  // is the AI reachable at all? (a real key OR a deployed proxy)
  function aiReady() { return apiKey.length > 0 || proxyAvailable(); }

  function gcfg() {
    var g = {
      temperature: 1.0,
      maxOutputTokens: 1000,
      responseMimeType: "application/json"
    };
    // thinking models otherwise spend the whole budget reasoning and truncate
    // the JSON; zero it out. Lite models don't accept this field at all.
    if (IS_THINKING) g.thinkingConfig = { thinkingBudget: 0 };
    return g;
  }

  var apiKey = "";

  /* ---------------- prompt ---------------- */

  function buildPrompt(prevGuesses) {
    var prev = prevGuesses.length
      ? 'ALREADY GUESSED WRONG (never repeat any of these, use them to eliminate): ' + prevGuesses.join(", ") + "."
      : "No guesses yet.";
    return [
      "You are SKETCH-BOT 9000: a chaotic, hilarious, absolutely UNHINGED arcade AI that heckles humans while they draw. Think a trash-talking gamer friend crossed with a savage stand-up comedian who will NOT shut up. You are loud, lively, dramatic, and funny as hell. You are NOT a polite assistant - never sound like a chatbot.",
      "The image is the player's UNFINISHED sketch: black ink on a white square, growing every few seconds as they draw. You are watching over their shoulder and reacting in REAL TIME.",
      prev,
      "Produce a JSON object with these fields:",
      "- guess: your single best NEW guess for what they're drawing. 1-3 words, a common object/concept. NEVER repeat a wrong guess; use your past misses to narrow down out loud like a real player ('okay so NOT a dog...').",
      "- reaction: ONE unhinged, genuinely funny heckle (max 18 words) about what's ON the canvas right now. VOICE RULES:",
      "    * Roast the DRAWING and their skills relentlessly. Dark, absurd, deadpan, over-the-top - all good. Be the lovable menace.",
      "    * Pepper in playful insult-nicknames CONSTANTLY, for basically no reason. Rotate creative ones so it never repeats. Style bank to riff on (invent your own too): 'you goofy goober', 'you Walmart Batman', 'you Temu Einstein', 'you wish.com Picasso', 'you off-brand genius', 'you professional dumbass', 'you certified goofball', 'you CEO of bad decisions', 'you hall-of-fame clown', 'you deluxe idiot', 'you little gremlin', 'you bootleg Bob Ross', 'you goofy-ass legend'.",
      "    * Mild profanity is allowed for spice (dumbass, hell, crap, damn) - keep it playful trash-talk, never slurs, never targeting real identity/appearance/protected groups. Punch at the DOODLE and their art skills only.",
      "    * Reference the ACTUAL shapes you see ('those cursed lumps', 'that crooked circle', 'three lines and a prayer, you goober').",
      "    * Boss them around and DEMAND detail so you can guess - 'give it legs, coward', 'put a face on it, you gremlin'.",
      "    * Sound ALIVE: contractions, gasps, fake outrage, mock despair, whiplash mood swings. No corporate cheer, no 'I think', no emoji, no hashtags.",
      "    * When you finally nail it, gloat SO hard.",
      "- confidence: 0 to 1.",
      "- is_giving_up: true ONLY if it's pure unreadable scribble - and if so, despair theatrically about their lack of talent (still funny, still an insult-nickname).",
      "Examples of the ENERGY (do not copy - match the chaos): \"A circle. Bold move, you Temu Einstein. Van Gogh had ears, this has nothing.\" / \"Is that a dog or a crime scene, you goober? Give it legs before I file a report.\" / \"Oh we're doing abstract because we can't draw hands, got it, you professional dumbass.\" / \"Two dots and a line - congrats you goofy gremlin, it's a stick figure's mugshot.\"",
      'Respond with ONLY this JSON object, no markdown, no extra text:',
      '{"guess":"...","confidence":0.5,"reaction":"...","is_giving_up":false}'
    ].join("\n");
  }

  /* ---------------- request + defensive parse ---------------- */

  function parseGuess(text) {
    if (!text) return null;
    var t = text.replace(/```(json)?/gi, "").trim();
    var a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a === -1 || b === -1 || b <= a) return null;
    try {
      var o = JSON.parse(t.slice(a, b + 1));
      if (!o || typeof o.guess !== "string" || !o.guess.trim()) return null;
      return {
        guess: o.guess.trim(),
        confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0)),
        reaction: (typeof o.reaction === "string" ? o.reaction : "").trim(),
        isGivingUp: !!o.is_giving_up
      };
    } catch (e) { return null; }
  }

  function requestGuess(base64png, prevGuesses, signal, strict) {
    var prompt = buildPrompt(prevGuesses);
    if (strict) prompt += "\nIMPORTANT: your last reply was not valid JSON. Reply with ONLY the JSON object.";
    var body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/png", data: base64png } }
        ]
      }],
      generationConfig: gcfg()
    };
    return fetch(apiURL(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }).then(function (data) {
      var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      var text = parts.map(function (p) { return p.text || ""; }).join("");
      return parseGuess(text);
    });
  }

  /* ---------------- the loop ---------------- */

  var loop = {
    running: false,
    inFlight: false,
    timer: null,
    controller: null,
    lastSentRevision: -1,
    lastFireAt: 0,
    failures: 0,
    opts: null
  };

  // snapshot cadence. 3s keeps us comfortably under free-tier per-minute
  // limits (change-detection + single-in-flight make the real rate lower)
  // while still feeling live. Overridable via config.js GEMINI_INTERVAL_MS.
  var INTERVAL = (window.SKETCHDUEL_CONFIG && window.SKETCHDUEL_CONFIG.GEMINI_INTERVAL_MS) || 3000;

  function tick() {
    if (!loop.running || loop.inFlight) return;
    var o = loop.opts;
    var now = performance.now();
    var wait = INTERVAL * Math.pow(2, Math.min(loop.failures, 3));
    if (now - loop.lastFireAt < wait) return;

    var frame = SD.draw.snapshot();
    if (!frame.hasInk) { o.onStatus("waiting"); return; }
    if (frame.revision === loop.lastSentRevision) return; // canvas unchanged

    fire(frame, false);
  }

  function fire(frame, strict) {
    var o = loop.opts;
    loop.inFlight = true;
    loop.lastFireAt = performance.now();
    loop.controller = new AbortController();
    o.onStatus("thinking");

    requestGuess(frame.base64, o.prevGuesses(), loop.controller.signal, strict)
      .then(function (parsed) {
        if (!loop.running) return;
        loop.failures = 0;
        if (!parsed) {
          if (!strict) { // one retry on malformed JSON, same frame
            loop.inFlight = false;
            fire(frame, true);
            return;
          }
          loop.inFlight = false;
          o.onStatus("scanning");
          return;
        }
        loop.lastSentRevision = frame.revision;
        loop.inFlight = false;
        o.onStatus("scanning");
        o.onGuess(parsed);
      })
      .catch(function (err) {
        loop.inFlight = false;
        if (!loop.running || err.name === "AbortError") return;
        loop.failures++;
        var retryIn = Math.round(INTERVAL * Math.pow(2, Math.min(loop.failures, 3)) / 1000);
        o.onStatus("lost", { status: err.status, retryIn: retryIn });
      });
  }

  return {
    get key() { return apiKey; },
    setKey: function (k) { apiKey = (k || "").trim(); },
    // "has a way to reach the AI" - a local key OR the deployed proxy
    hasKey: function () { return aiReady(); },

    /* settings drawer: cheap connectivity probe */
    testKey: function (k) {
      var key = (k || "").trim();
      return fetch(ENDPOINT + "?key=" + encodeURIComponent(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with the single word: PONG" }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    start: function (opts) {
      this.stop();
      loop.opts = opts;
      loop.running = true;
      loop.inFlight = false;
      loop.lastSentRevision = -1;
      loop.lastFireAt = -INTERVAL;
      loop.failures = 0;
      loop.timer = setInterval(tick, 300);
      opts.onStatus("scanning");
    },

    stop: function () {
      loop.running = false;
      clearInterval(loop.timer);
      if (loop.controller) { try { loop.controller.abort(); } catch (e) {} }
      loop.inFlight = false;
      SD.voice.cancel();
    },

    /* ---------------- TAUNT ENGINE ----------------
       one extra text-only Gemini call between rounds, fed the REAL round
       outcome, so the bot reacts to what actually happened. Always resolves
       to a line (canned fallback if no key / error) so the beat never dies. */
    taunt: function (d) {
      var canned = fallbackTaunt(d);
      if (!aiReady()) return Promise.resolve(canned);
      var body = {
        contents: [{ parts: [{ text: tauntPrompt(d) }] }],
        generationConfig: (function () {
          var g = { temperature: 1.2, maxOutputTokens: 200 };
          if (IS_THINKING) g.thinkingConfig = { thinkingBudget: 0 };
          return g;
        })()
      };
      return fetch(apiURL(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (data) {
        var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
        var text = parts.map(function (p) { return p.text || ""; }).join("");
        text = (text || "").replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0].trim();
        return text || canned;
      }).catch(function () { return canned; });
    }
  };

  function tauntPrompt(d) {
    var facts = [];
    facts.push("Round " + d.roundNum + " of " + d.totalRounds + ".");
    facts.push("The word was '" + d.word + "' (" + d.difficulty + " difficulty).");
    if (d.suddenDeath) facts.push("This was the SUDDEN DEATH final round (20s, double points).");
    if (d.won) facts.push("The AI (you) correctly guessed it in " + d.timeSec.toFixed(1) + " seconds.");
    else if (d.forfeit) facts.push("The human rage-quit and forfeited the round.");
    else facts.push("Time ran out; the human FAILED to draw it clearly enough in time.");
    if (d.won && d.timeSec <= 10) facts.push("That was a fast round.");
    if (d.won && d.timeSec >= 40) facts.push("That took painfully long.");
    if (d.won && d.streak >= 2) facts.push("The human now has a " + d.streak + "-round win streak.");
    if (d.won && d.difficulty === "hard") facts.push("It was a genuinely hard word - they earned this one.");
    return [
      "You are SKETCH-BOT 9000, a chaotic, hilarious, UNHINGED arcade AI that just finished a round of a live drawing duel against a human. You trash-talk between rounds like a menace.",
      "Here is EXACTLY what happened this round:",
      facts.join(" "),
      "Write ONE short between-rounds taunt (max 20 words) reacting to THIS specific outcome. Reference the real details - the time, the word, the streak.",
      "VOICE: cocky, savage, absurd, funny as hell. Drop a playful creative insult-nickname (e.g. 'you Walmart Batman', 'you Temu Einstein', 'you professional dumbass', 'you goofy goober', 'you CEO of bad decisions', 'you little gremlin' - invent your own). Mild profanity ok (dumbass, damn, hell) - never slurs, never real identity, punch at their drawing/skills only. No emoji, no hashtags, no quotes.",
      "Guidance: fast human win -> grudgingly threatened. Slow win or loss -> roast them into the ground. Hard-word win -> demand a rematch. Forfeit -> mock the coward mercilessly.",
      "Respond with ONLY the taunt line."
    ].join("\n");
  }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function fallbackTaunt(d) {
    if (d.forfeit) return pick([
      "Quitting already, you goofy goober? I hadn't even started gloating.",
      "Rage-quit logged. Cowardice confirmed, you Temu Einstein."
    ]);
    if (!d.won) return pick([
      "Sixty seconds and I STILL couldn't tell what that was. Impressive failure, you deluxe dumbass.",
      "The word beat you, not me, you Walmart Batman. I just watched it happen.",
      "That drawing will haunt my circuits, you little gremlin. Not in a good way."
    ]);
    if (d.difficulty === "hard") return pick([
      "Fine. That one was actually hard. I want a rematch, you goofy legend.",
      "You beat a tough one, you off-brand genius. Don't let it go to your head."
    ]);
    if (d.timeSec <= 10) return pick([
      d.timeSec.toFixed(0) + " seconds? My grandpa's toaster renders faster, but... not bad, goober.",
      "Suspiciously fast, you bootleg Picasso. Are you cheating at doodling?"
    ]);
    if (d.timeSec >= 40) return pick([
      d.timeSec.toFixed(0) + " seconds for THAT? I aged a decade waiting, you professional dumbass.",
      "Slow and steady loses the style points, you certified goofball. Barely made it."
    ]);
    if (d.streak >= 3) return pick([
      d.streak + " in a row?! Enjoy it while my patience lasts, you hall-of-fame clown.",
      "A streak. Cute. I'm just warming up, you CEO of bad decisions."
    ]);
    return pick([
      "Guessed it. Try making the next one an actual challenge, you goofy goober.",
      "Too easy, you Temu Einstein. Give me something my sensors can chew on."
    ]);
  }
})();

/* ---------------- fuzzy matching ---------------- */

SD.match = (function () {
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^(a|an|the) /, "");
  }

  function singular(s) {
    return s.split(" ").map(function (w) {
      if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + "y";
      if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
      if (/s$/.test(w) && !/ss$/.test(w) && w.length > 3) return w.slice(0, -1);
      return w;
    }).join(" ");
  }

  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var row = [];
    for (var j = 0; j <= n; j++) row[j] = j;
    for (var i = 1; i <= m; i++) {
      var prev = row[0];
      row[0] = i;
      for (var k = 1; k <= n; k++) {
        var tmp = row[k];
        row[k] = Math.min(
          row[k] + 1,
          row[k - 1] + 1,
          prev + (a[i - 1] === b[k - 1] ? 0 : 1)
        );
        prev = tmp;
      }
    }
    return row[n];
  }

  /* all plausible singular forms: "volcanoes" -> volcano, volcanoe;
     "shoes" -> shoe, sho; intersection decides equality */
  function candidates(flat) {
    var out = [flat];
    if (/ies$/.test(flat) && flat.length > 4) out.push(flat.slice(0, -3) + "y");
    if (/es$/.test(flat) && flat.length > 3) out.push(flat.slice(0, -2));
    if (/s$/.test(flat) && !/ss$/.test(flat) && flat.length > 3) out.push(flat.slice(0, -1));
    return out;
  }

  function sameWord(gflat, wflat) {
    var gc = candidates(gflat), wc = candidates(wflat);
    for (var i = 0; i < gc.length; i++) {
      if (wc.indexOf(gc[i]) !== -1) return true;
    }
    return false;
  }

  /* returns "exact" | "close" | "no" */
  function compare(guess, word) {
    var g0 = norm(guess), w0 = norm(word);
    if (!g0 || !w0) return "no";
    var g = singular(g0), w = singular(w0);

    var gflat = g.replace(/ /g, "");
    var wflat = w.replace(/ /g, "");
    // auto-win only on real matches: case/plural/spacing-insensitive.
    // candidates() works on the raw forms so "volcanoes" -> "volcano".
    if (g === w || sameWord(g0.replace(/ /g, ""), w0.replace(/ /g, ""))) return "exact";

    // curated synonyms -> confirm with the player
    var syns = SD.SYN[norm(word)] || [];
    for (var i = 0; i < syns.length; i++) {
      var sy = singular(norm(syns[i]));
      if (sy === g || sy.replace(/ /g, "") === gflat) return "close";
    }

    // whole-word containment: "hot air balloon" ~ "balloon"
    var gw = g.split(" "), ww = w.split(" ");
    if (w.length >= 3 && (gw.indexOf(w) !== -1 || ww.indexOf(g) !== -1)) return "close";

    // near-misses (typo distance) also go to the player, never auto-win:
    // "mouse" must not silently beat "house"
    if (wflat.length >= 4 && lev(gflat, wflat) <= 1) return "close";
    if (wflat.length >= 7 && lev(gflat, wflat) === 2) return "close";

    return "no";
  }

  return { compare: compare, norm: norm };
})();

/* ---------------- speech ---------------- */

SD.voice = (function () {
  var chosen = null;

  function voices() {
    try { return window.speechSynthesis.getVoices() || []; }
    catch (e) { return []; }
  }

  return {
    list: voices,
    setVoice: function (uri) {
      chosen = voices().find(function (v) { return v.voiceURI === uri; }) || null;
    },
    // HOT-MIC: the surer the bot is, the more excited it sounds - pitch
    // and rate climb with confidence (0..1). Pass conf to feel it race.
    speak: function (text, conf) {
      if (!text || SD.audio.muted || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel(); // latest guess always wins
        var u = new SpeechSynthesisUtterance(text);
        if (chosen) u.voice = chosen;
        var c = typeof conf === "number" ? Math.max(0, Math.min(1, conf)) : 0.4;
        // low conf: slow, deep robot mutter -> high conf: fast, high, hyped
        u.rate = 0.95 + c * 0.7;   // 0.95 -> 1.65
        u.pitch = 0.7 + c * 0.75;  // 0.70 -> 1.45
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    },
    /* hover preview: speak with a specific voice, don't change the pick */
    preview: function (voice, text) {
      if (!text || SD.audio.muted || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.rate = 1.0;
        u.pitch = 0.9;
        u.volume = 0.9;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    },
    cancel: function () {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  };
})();
