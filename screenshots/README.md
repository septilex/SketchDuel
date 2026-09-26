<div align="center">

<img src="./screenshots/logo.png" alt="SketchDuel Logo" width="480"/>

### DRAW. IT GUESSES. NOBODY'S SAFE.

**A real-time drawing duel against an AI that watches you sketch — live.**

[![Play It Live](https://img.shields.io/badge/▶_PLAY_IT_LIVE-sketch--duel.vercel.app-ffd400?style=for-the-badge&labelColor=0a0a08)](https://sketch-duel.vercel.app)

![Track](https://img.shields.io/badge/track-Stack-8a7500) ![Build](https://img.shields.io/badge/build-Live-8a7500) ![Hackathon](https://img.shields.io/badge/Shadow%20Sprint-2K26-8a7500)

Built for **Shadow Sprint 2K26** — a national 12-hour hackathon.

</div>

---

## ⚡ The One-Liner

> **ChatGPT answers questions. SketchDuel plays games with you.**

You get a secret word and 60 seconds. The moment you start sketching, **SKETCH-BOT 9000** starts watching — not when you hit submit (there is no submit). Every 2.5 seconds it takes a fresh look at your half-finished scribble, commits to a guess out loud, remembers what it got wrong, and narrows in like a friend yelling over your shoulder in Pictionary — until it nails your word or the clock kills it.

This is not a chatbot wrapper. The core mechanic is **continuous perception under a time limit** — an AI you compete against, in real time. You cannot do this in a chat window.

---

## 🕹️ Play It Now

No install, no setup, no accounts. Just open the link in Chrome or Edge:

<div align="center">

**▶ [sketch-duel.vercel.app](https://sketch-duel.vercel.app)**

Hit **DUEL NOW** → draw fast → the AI starts guessing. That's it.

</div>

Pages: the landing poster deep-links straight into modes — `?mode=duel`, `?mode=practice`, `?mode=party`.

---

## 📸 Screenshots

### Landing Poster
A hazard-striped arcade poster that deep-links straight into any mode.

<p align="center">
  <img src="./screenshots/landing.png" alt="SketchDuel landing poster" width="100%"/>
</p>

### Match Setup
Pick your signal level (difficulty) and round count before the machine starts watching.

<p align="center">
  <img src="./screenshots/match-setup.png" alt="Match setup screen — difficulty and rounds" width="100%"/>
</p>

### Secret Word Reveal
Every round opens on a tiled, procedurally-patterned reveal card — don't say it out loud.

<p align="center">
  <img src="./screenshots/word-reveal.png" alt="Secret word reveal screen" width="100%"/>
</p>

### The Clock Starts
No submit button. The instant you touch the canvas, the round — and the AI's watch — begins.

<p align="center">
  <img src="./screenshots/draw-countdown.png" alt="DRAW! countdown moment" width="100%"/>
</p>

### Live Duel
The sketchpad, the guess feed, and SKETCH-BOT 9000's running commentary, all updating while you draw.

<p align="center">
  <img src="./screenshots/gameplay.png" alt="Live gameplay — sketching with the guess feed narrowing in" width="100%"/>
</p>

### It Guessed It
A correct guess fires the results card with your time, points, and a fresh roast from the bot.

<p align="center">
  <img src="./screenshots/correct-guess.png" alt="Correct guess result card — refrigerator" width="100%"/>
</p>

### Signal Terminated
Forfeit or run out the clock and the bot has notes — with a one-key way to jump back in.

<p align="center">
  <img src="./screenshots/signal-terminated.png" alt="Signal terminated — forfeit screen" width="100%"/>
</p>

---

## 🎯 What Makes It Different

| | Normal AI tool | SketchDuel |
|---|---|---|
| **Interaction unit** | A finished message | A live, evolving feed |
| **Timing** | Turn-based — you wait | Continuous, on a 60s clock |
| **Memory** | Starts each reply cold | Remembers its own misses within the round |
| **Feel** | A form you submit to | A rival you race against |

Upload-a-photo-and-ask kills the game entirely: no time pressure, no narrowing-in, no duel. The magic isn't calling a model — it's engineering a loop that feels alive.

---

## 🎮 Game Modes

| Mode | What it is |
|---|---|
| **DUEL** | Pick difficulty + rounds (3 / 5 / 7) on the Match Setup screen, then 60s per round. Score = 100 − seconds elapsed, +15 per streak win. Final round is Sudden Death. |
| **PRACTICE** | No timer, no word. Draw anything; the bot just keeps guessing. |
| **PARTY** | Pass the laptop. 2–4 players, 3 rounds each, leaderboard + scannable QR scoreboard at the end. |

---

## ⌨️ Controls

Draw with mouse or trackpad. Ink colors: yellow, white, cyan, magenta.

```
1 / 2 / 3   brush sizes        E   eraser        B   back to brush
Ctrl+Z      undo               C   clear         M   mute
Y / N       answer prompts     Enter  advance    Esc  close config
```

Close-call guesses (synonyms, near-misses, typos) never auto-win — the bot asks you to rule: **[Y] COUNT IT / [N] NOPE**.

---

## 🧠 The Engineering (what to grade us on)

The hard part isn't the API call — it's making a stateless model feel like a live opponent. Five deliberate systems do that:

- **🖼️ Snapshot normalization** — Before every request, the dark game canvas is re-composited to black ink on a white 512px PNG. Vision models read clean line-art dramatically better than a dark UI screenshot, and 512px keeps payloads at ~10–30 KB.
- **🚦 Single-flight throttling** — Never more than one request in flight. If the model is slow, we skip intermediate frames and always send the latest canvas — guesses stay current instead of queuing into the past.
- **🔁 Change detection** — A stroke-revision counter means an unchanged or empty canvas sends nothing. Zero wasted calls while you think.
- **📚 Guess-history injection** — Every wrong guess is fed back into the next prompt, so each call gets smarter instead of starting cold. That's the "narrowing-in" behavior.
- **🛡️ Graceful failure** — Errors degrade in-game: "SIGNAL LOST — RECONNECTING…" with exponential backoff (2.5s → 5s → 10s → 20s), and the round keeps running. Speech is cancel-and-replace, so the bot always voices its newest thought.

Additional guardrails:
- **Defensive parsing** — strict JSON schema via `responseMimeType`, markdown fences stripped, one strict retry on malformed output, confidence clamped.
- **Fuzzy matching** — case / punctuation / article-insensitive, plural-aware (*volcanoes → volcano*), spacing-insensitive (*blackhole → black hole*). Synonyms, whole-word containment (*balloon* for *hot air balloon*), and typo near-misses are never auto-wins — they defer to the player.

---

## ✨ Signature Features

- **🤖 A bot with a mouth on it** — SKETCH-BOT 9000 is a savage, dark-humor art critic. It roasts your drawing, references the actual shapes on screen, and bosses you into adding detail. A correct guess fires a pixel-confetti blast + party-horn fanfare over the arcade stamp.
- **🔥 Taunt engine** — Between rounds it fires one extra Gemini call fed the real round data (word, time, streak, win/loss) and reacts to what actually happened. Canned fallbacks keep the beat alive with no key.
- **🎙️ Hot-mic voice** — The surer the bot is, the higher and faster it talks — `speechSynthesis` pitch/rate scale with guess confidence.
- **💀 Sudden Death** — The final duel round is 20s, a hard word, double points, red-pulsing screen edges.
- **🖼️ Wanted Poster** — One click on the results screen downloads a pixel "WANTED" mugshot PNG of your best sketch (word, time, score, branding). Every player leaves with a shareable card.
- **👾 Attract mode** — Idle 30s on the menu and it flips into a self-playing arcade demo: ghost replays cycle while the bot "guesses" them, with a blinking `INSERT BRAIN TO CONTINUE`. Any input drops back in.
- **📱 Spectator QR** — Party results show a QR that opens a self-contained mobile scoreboard — the whole table watches final standings on their phones.
- **🎨 Word-reveal art** — Every secret word gets its own 12×12 pixel sprite (hand-authored for iconic words, procedurally seeded for the rest), tiled into an animated scrolling background behind the reveal card. `[TAB]` swaps the whole pattern.

---

## 🎛️ Art Direction

A locked pixelated cyber-arcade identity — 80s cabinet bezel meets Game Boy cartridge label. Zero style drift across every screen.

- **6-color palette, no gradients** — `#0a0a08` · `#131310` · `#ffd400` · `#8a7500` · `#f2f2e9` · `#ff2d55` (red appears only in the final 10 seconds and error states)
- **Type** — Press Start 2P (headlines) + VT323 (body), hard pixel drop-shadows
- **Construction** — pixel-notched borders built from hard box-shadows, hazard-stripe headers, `border-radius: 0` everywhere, arcade-button press physics
- **Atmosphere** — CRT scanlines + vignette, `steps()` motion, screen-shake + flicker on big moments
- **Audio** (zero audio files) — live chalk-scratch gated by pen speed while drawing + 8-bit Web Audio blips on every click/hover
- **Cursors** — custom 8-bit pixel cursors (native CSS `cursor: url()`, GPU-composited) + a fading pixel cursor-trail
- **Bottom ticker** — a solid-yellow news-crawl on every page ("YOUR OPPONENT NEVER SLEEPS ◆ LAST GAME: 'SAD LIZARD'…")
- **Accessibility** — `prefers-reduced-motion` fully respected (kills shake, flicker, ticker, trail — keeps function). Mute with `M`.

---

## 🧪 Demo Shortcuts (for judges)

Jump straight to any screen with sample data — no round required:

```
game.html?screen=game                 the main sketchpad
game.html?screen=word                 word-reveal  (add &word=ghost to force one)
game.html?screen=results              results + Wanted Poster
game.html?screen=sudden               Sudden Death preview
game.html?screen=settings             config drawer
game.html?attract=1                   self-playing attract mode
```

Developer drawer (hidden from players): `game.html?dev=true` or `Ctrl+Shift+D` — link test and a bot-voice picker that introduces each voice out loud on hover ("Hi! I am Zira.").

---

## 🔒 Privacy

All game state lives in browser memory only — no localStorage, no cookies, no server, no accounts. Refresh = factory reset. Your drawings never touch a backend (there isn't one) — the vision requests go straight from your browser to the model and nothing is stored.

---

## 🏗️ Tech & Architecture

**Stack:** `index.html` (landing poster) + `game.html` (game cabinet) + `styles.css` + 6 plain JS files. Runs from any static server. Only external dependencies: Google Fonts and the Gemini REST API.

**Drawing engine:** pointer events with coalesced points, quadratic curves through stroke midpoints, incremental segment rendering (no full redraws while inking), DPR-aware canvas. Undo / eraser / 3 sizes / 4 inks.

```
SketchDuel/
├── index.html          landing poster (deep-links into modes)
├── game.html            the game cabinet
├── scoreboard.html      mobile spectator standings
├── styles.css           locked 6-color arcade theme
└── js/
    ├── ticker.js         self-injecting bottom news-crawl
    ├── uisound.js        8-bit click/hover SFX (Web Audio, delegated)
    ├── cursortrail.js     fading pixel cursor trail (rAF-paced)
    ├── poster.js          Wanted Poster PNG generator
    └── vendor/
        └── qrcode.js       vendored QR encoder (spectator scoreboard)
```

---

<div align="center">

**SketchDuel — Your opponent never sleeps.** 🎮✨

</div>
