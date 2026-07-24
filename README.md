<div align="center">

# 🎮 SKETCHDUEL

### **DRAW. IT GUESSES. NOBODY'S SAFE.**

*A real-time drawing duel against an AI that watches you sketch — live.*

<br>

### ▶ [**PLAY IT LIVE — sketch-duel.vercel.app**](https://sketch-duel.vercel.app/)

<br>

![Track](https://img.shields.io/badge/TRACK-C%20//%20CREATOR%20%26%20DIGITAL%20EXPERIENCE-ffd400?style=for-the-badge&labelColor=0a0a08)
![Stack](https://img.shields.io/badge/STACK-VANILLA%20JS-ffd400?style=for-the-badge&labelColor=0a0a08)
![Build](https://img.shields.io/badge/BUILD%20STEP-NONE-ffd400?style=for-the-badge&labelColor=0a0a08)
![Live](https://img.shields.io/badge/STATUS-LIVE%20ON%20VERCEL-ffd400?style=for-the-badge&labelColor=0a0a08)

*Built for **Shadow Sprint 2K26** — a national 12-hour hackathon.*

</div>

---

## ⚡ THE ONE-LINER

**ChatGPT answers questions. SketchDuel plays games with you.**

You get a secret word and 60 seconds. The moment you start sketching, **SKETCH-BOT 9000** starts watching — not when you hit submit (there is no submit). Every 2.5 seconds it takes a fresh look at your half-finished scribble, commits to a guess *out loud*, remembers what it got wrong, and narrows in like a friend yelling over your shoulder in Pictionary — until it nails your word or the clock kills it.

This is **not a chatbot wrapper.** The core mechanic is *continuous perception under a time limit* — an AI you compete **against**, in real time. You cannot do this in a chat window.

---

## 🕹️ PLAY IT NOW

**No install, no setup, no accounts.** Just open the link in Chrome or Edge:

### ▶ [**sketch-duel.vercel.app**](https://sketch-duel.vercel.app/)

Hit **DUEL NOW** → draw fast → the AI starts guessing. That's it.

> **Pages:** the landing poster deep-links straight into modes — `?mode=duel`, `?mode=practice`, `?mode=party`.

---

### Running it locally (optional)

```bash
cd SketchDuel
python -m http.server 8000     # any static server works
```
Then open [http://localhost:8000](http://localhost:8000). No build step, no dependencies to install.
Locally, put your Gemini key in `js/config.js` (gitignored):
```js
window.SKETCHDUEL_CONFIG = { GEMINI_API_KEY: "your-key-here" };
```

### The key, on deploy

The key never ships to the browser. In production the client POSTs to a tiny
serverless proxy — [`api/gemini.js`](api/gemini.js) — that holds the key in a
Vercel **environment variable** and forwards requests to Gemini. To deploy:

1. Push the repo (the local `js/config.js` stays gitignored — the deploy doesn't need it).
2. In Vercel → **Project → Settings → Environment Variables**, add
   `GEMINI_API_KEY` = *your key*.
3. **Redeploy** so the variable takes effect.

The browser auto-detects: a local `js/config.js` key → call Gemini directly;
otherwise → route through `/api/gemini`. Nothing to toggle.

---

## 🎯 WHAT MAKES IT DIFFERENT

| | Normal AI tool | SketchDuel |
|---|---|---|
| **Interaction unit** | A finished message | A live, evolving feed |
| **Timing** | Turn-based — you wait | Continuous, on a 60s clock |
| **Memory** | Starts each reply cold | Remembers its own misses *within the round* |
| **Feel** | A form you submit to | A rival you race against |

Upload-a-photo-and-ask kills the game entirely: no time pressure, no narrowing-in, no duel. The magic isn't calling a model — it's **engineering a loop that feels alive.**

---

## 🎮 GAME MODES

| Mode | What it is |
|---|---|
| **DUEL** | Pick difficulty + rounds (3 / 5 / 7) on the MATCH SETUP screen, then 60s per round. Score = `100 − seconds elapsed`, **+15 per streak win.** Final round is **Sudden Death.** |
| **PRACTICE** | No timer, no word. Draw anything; the bot just keeps guessing. |
| **PARTY** | Pass the laptop. 2–4 players, 3 rounds each, leaderboard + scannable QR scoreboard at the end. |

---

## ⌨️ CONTROLS

Draw with mouse or trackpad. Ink colors: **yellow, white, cyan, magenta.**

```
1 / 2 / 3   brush sizes        E   eraser        B   back to brush
Ctrl+Z      undo               C   clear         M   mute
Y / N       answer prompts     Enter  advance    Esc  close config
```

**Close-call guesses** (synonyms, near-misses, typos) never auto-win — the bot asks *you* to rule: **`[Y] COUNT IT / [N] NOPE`.**

---

## 🧠 THE ENGINEERING (what to grade us on)

The hard part isn't the API call — it's making a stateless model feel like a live opponent. Five deliberate systems do that:

**🖼️ Snapshot normalization** — Before every request, the dark game canvas is re-composited to **black ink on a white 512px PNG.** Vision models read clean line-art dramatically better than a dark UI screenshot, and 512px keeps payloads at ~10–30 KB.

**🚦 Single-flight throttling** — Never more than one request in flight. If the model is slow, we **skip intermediate frames and always send the latest canvas** — guesses stay current instead of queuing into the past.

**🔁 Change detection** — A stroke-revision counter means an unchanged or empty canvas sends *nothing.* Zero wasted calls while you think.

**📚 Guess-history injection** — Every wrong guess is fed back into the next prompt, so each call gets *smarter* instead of starting cold. That's the "narrowing-in" behavior.

**🛡️ Graceful failure** — Errors degrade in-game: *"SIGNAL LOST — RECONNECTING…"* with exponential backoff (2.5s → 5s → 10s → 20s), and the round keeps running. Speech is cancel-and-replace, so the bot always voices its newest thought.

**Defensive parsing:** strict JSON schema via `responseMimeType`, markdown fences stripped, one strict retry on malformed output, confidence clamped.

**Fuzzy matching:** case / punctuation / article-insensitive, plural-aware (`volcanoes` → `volcano`), spacing-insensitive (`blackhole` → `black hole`). Synonyms, whole-word containment (`balloon` for `hot air balloon`), and typo near-misses are *never* auto-wins — they defer to the player.

---

## ✨ SIGNATURE FEATURES

- **🤖 A bot with a mouth on it** — SKETCH-BOT 9000 is a savage, dark-humor art critic. It roasts your drawing, references the actual shapes on screen, and bosses you into adding detail (*"that floating oval on two sad sticks looks like a deformed mushroom — give it legs"*). A correct guess fires a pixel-confetti blast + party-horn fanfare over the arcade stamp.
- **🔥 Taunt engine** — Between rounds it fires one extra Gemini call fed the *real* round data (word, time, streak, win/loss) and reacts to what actually happened: *"Eight seconds for a volcano? My grandpa's toaster renders faster."* Canned fallbacks keep the beat alive with no key.
- **🎙️ Hot-mic voice** — The surer the bot is, the higher and faster it talks — `speechSynthesis` pitch/rate scale with guess confidence.
- **💀 Sudden Death** — The final duel round is 20s, a hard word, double points, red-pulsing screen edges.
- **🖼️ Wanted Poster** — One click on the results screen downloads a pixel *"WANTED"* mugshot PNG of your best sketch (word, time, score, branding). Every player leaves with a shareable card.
- **👾 Attract mode** — Idle 30s on the menu and it flips into a self-playing arcade demo: ghost replays cycle while the bot "guesses" them, with a blinking *INSERT BRAIN TO CONTINUE.* Any input drops back in.
- **📱 Spectator QR** — Party results show a QR that opens a self-contained mobile scoreboard — the whole table watches final standings on their phones.
- **🎨 Word-reveal art** — Every secret word gets its own 12×12 pixel sprite (hand-authored for iconic words, procedurally seeded for the rest), tiled into an animated scrolling background behind the reveal card. `[TAB]` swaps the whole pattern.

---

## 🎛️ ART DIRECTION

A locked **pixelated cyber-arcade** identity — 80s cabinet bezel meets Game Boy cartridge label. Zero style drift across every screen.

- **6-color palette, no gradients:** `#0a0a08` · `#131310` · `#ffd400` · `#8a7500` · `#f2f2e9` · `#ff2d55` *(red appears only in the final 10 seconds and error states)*
- **Type:** Press Start 2P (headlines) + VT323 (body), hard pixel drop-shadows
- **Construction:** pixel-notched borders built from hard box-shadows, hazard-stripe headers, `border-radius: 0` everywhere, arcade-button press physics
- **Atmosphere:** CRT scanlines + vignette, `steps()` motion, screen-shake + flicker on big moments
- **Audio (zero audio files):** live chalk-scratch gated by pen speed while drawing + 8-bit Web Audio blips on every click/hover
- **Cursors:** custom 8-bit pixel cursors (native CSS `cursor: url()`, GPU-composited) + a fading pixel cursor-trail
- **Bottom ticker:** a solid-yellow news-crawl on every page (*"YOUR OPPONENT NEVER SLEEPS ◆ LAST GAME: 'SAD LIZARD'…"*)
- **Accessibility:** `prefers-reduced-motion` fully respected (kills shake, flicker, ticker, trail — keeps function). Mute with `M`.

---

## 🧪 DEMO SHORTCUTS (for judges)

Jump straight to any screen with sample data — no round required:

```
game.html?screen=game                 the main sketchpad
game.html?screen=word                 word-reveal  (add &word=ghost to force one)
game.html?screen=results              results + Wanted Poster
game.html?screen=sudden               Sudden Death preview
game.html?screen=settings             config drawer
game.html?attract=1                   self-playing attract mode
```

**Developer drawer** (hidden from players): `game.html?dev=true` or **Ctrl+Shift+D** — link test and a bot-voice picker that introduces each voice out loud on hover (*"Hi! I am Zira."*).

---

## 🔒 PRIVACY

All game state lives in **browser memory only** — no `localStorage`, no cookies, no server, no accounts. Refresh = factory reset. Your drawings never touch a backend (there isn't one) — the vision requests go straight from your browser to the model and nothing is stored.

---

## 🏗️ TECH & ARCHITECTURE

**Stack:** `index.html` (landing poster) + `game.html` (game cabinet) + `styles.css` + 6 plain JS files. Runs from any static server. Only external dependencies: **Google Fonts** and the **Gemini REST API.**

**Drawing engine:** pointer events with coalesced points, quadratic curves through stroke midpoints, incremental segment rendering (no full redraws while inking), DPR-aware canvas. Undo / eraser / 3 sizes / 4 inks.

```
SketchDuel/
├── index.html          landing poster (deep-links into modes)
├── game.html           the game cabinet
├── scoreboard.html     mobile spectator standings
├── styles.css          locked 6-color arcade theme
└── js/
    ├── ticker.js       self-injecting bottom news-crawl
    ├── uisound.js      8-bit click/hover SFX (Web Audio, delegated)
    ├── cursortrail.js  fading pixel cursor trail (rAF-paced)
    ├── poster.js       Wanted Poster PNG generator
    └── vendor/
        └── qrcode.js   vendored QR encoder (spectator scoreboard)
```

---

## 🎤 60-SECOND PITCH

> ChatGPT answers questions. Ours plays games with you.
>
> This is SketchDuel. I get a secret word — say, **VOLCANO** — and sixty seconds. The moment I start sketching, the AI starts watching. Not when I hit submit — *there is no submit.* Every two and a half seconds it takes a fresh look at my half-finished scribble and commits to a guess, out loud.
>
> *"Pointy… a mountain?"* — it's wrong, and it **knows** what it got wrong, so it narrows in exactly like a friend yelling over your shoulder in Pictionary. I add smoke — *"SMOKE on a mountain. VOLCANO!"* — eight seconds, 92 points, and it trash-talks me on the way out.
>
> Everything runs in a stock browser. No backend, no build, no accounts, no install. The hard part isn't calling a model — it's engineering a loop that feels **alive:** snapshot normalization so the model can actually read the canvas, guess-history injection so it never repeats itself, in-flight throttling so latency never stacks up, and a voice so it feels like a rival, not a form. That's a genuinely new kind of play — an AI you compete **against** in real time — and you can't do it in a chat window.

---

## 🙋 JUDGE Q&A PREP

**"Why can't this be done in a chat window?"**
Chat is turn-based: you produce a finished artifact, then wait for one reply. SketchDuel's core mechanic is *continuous perception* — the AI reacts to an evolving, unfinished drawing on a clock, remembers its own misses within the round, and races you. The interaction unit is not a message, it's a live feed. Upload-a-photo-and-ask kills the game entirely.

**"What latency engineering did you do?"**
Black-ink-on-white 512px snapshots (~10–30 KB, far more legible to the model); never more than one request in flight, always sending the *latest* canvas; stroke-revision change detection so unchanged/empty canvases send nothing; wrong guesses fed back into the prompt; in-game exponential backoff on failure; cancel-and-replace speech.

**"Privacy?"**
All game state lives in browser memory only — no localStorage, no cookies, no server, no accounts. Refresh = factory reset.

---

<div align="center">

**SKETCHDUEL** · Shadow Sprint 2K26 · TRK-C

*Your opponent never sleeps.*

</div>
