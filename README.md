# SKETCHDUEL

**DRAW. IT GUESSES. NOBODY'S SAFE.**

A real-time drawing duel against an AI. You sketch on a canvas; SKETCH-BOT 9000
watches your drawing evolve **live** and shouts guesses out loud as your strokes
appear, narrowing in like a human player until it nails your secret word.

Vanilla HTML/CSS/JS. Single page. No frameworks, no build step.
Only external dependencies: Google Fonts and the Gemini REST API.

---

## 30-SECOND QUICKSTART

1. **Get a free Gemini key** (no card needed): go to
   [aistudio.google.com](https://aistudio.google.com) > **Get API key** > create key > copy it.
2. **Paste it once** into `js/config.js`:

   ```js
   window.SKETCHDUEL_CONFIG = { GEMINI_API_KEY: "your-key-here" };
   ```

   (That file is gitignored, so the key never leaves your machine. A raw
   `.env` can't be read by a no-build static page - this file IS the env file.)
3. **Serve the folder** (any static server works):

   ```
   cd SketchDuel
   python -m http.server 8000
   ```

4. **Open** [http://localhost:8000](http://localhost:8000) in Chrome or Edge -
   that's the arcade landing page. Hit **DUEL NOW**. Draw fast.

That's the whole setup. Players and judges never see a key, a config screen,
or any setup step: open site > click PLAY > draw > the AI starts guessing.

**Pages**: `index.html` is the landing poster; the game cabinet lives at
`game.html`. Landing buttons deep-link straight into modes
(`game.html?mode=duel|practice|party`).

**Developer mode** (hidden from players): the config drawer - key override,
link test, bot voice picker with hover previews - only appears with
`game.html?dev=true` or **Ctrl+Shift+D** in-game.

**Missing key fallback**: if `js/config.js` has no key, the game still runs;
players see only "THE AI IS TEMPORARILY UNAVAILABLE" in the feed, while the
real reason (and any Gemini HTTP errors) go to the browser console.

## MODES

| Mode | What it is |
|---|---|
| **DUEL** | Pick difficulty + rounds (3/5/7) on the MATCH SETUP screen, then 60s per round. Score = 100 - seconds elapsed, +15 per streak win. Final round is Sudden Death. |
| **PRACTICE** | No timer, no word. Draw anything; the bot just keeps guessing. |
| **PARTY** | Pass the laptop. 2-4 players, 3 rounds each, leaderboard at the end. |

## CONTROLS

- Draw with mouse or trackpad. Ink colors: yellow, white, cyan, magenta.
- `1 / 2 / 3` brush sizes, `E` eraser, `B` back to brush, `Ctrl+Z` undo, `C` clear
- `M` mute, `Y / N` answer prompts, `Enter` advance, `Esc` close config
- Close-call guesses (synonyms, near-misses) ask YOU to rule: `[Y] COUNT IT / [N] NOPE`

---

## 60-SECOND PITCH SCRIPT

> ChatGPT answers questions. Ours plays games with you.
>
> This is SketchDuel. I get a secret word - say, VOLCANO - and sixty seconds.
> The moment I start sketching, the AI starts watching. Not when I hit submit -
> there is no submit. Every two and a half seconds it takes a fresh look at my
> half-finished scribble and commits to a guess, out loud.
> "Pointy... a mountain?" - it's wrong, and it KNOWS what it got wrong, so it
> narrows in exactly like a friend yelling over your shoulder in Pictionary.
> I add smoke - "SMOKE on a mountain. VOLCANO!" - eight seconds, 92 points,
> and it trash-talks me on the way out.
>
> Everything is a stock browser and one free-tier API key. No backend, no build,
> no accounts. The hard part isn't calling a model - it's engineering a loop
> that feels ALIVE: snapshot normalization so the model can actually read the
> canvas, guess-history injection so it never repeats itself, in-flight
> throttling so latency never stacks up, and a voice so it feels like a rival,
> not a form. That's a genuinely new kind of play - an AI you compete AGAINST
> in real time - and you can't do it in a chat window.

## JUDGE Q&A PREP

**"Why can't this be done in a chat window?"**
Chat is turn-based: you produce a finished artifact, then wait for one reply.
SketchDuel's core mechanic is *continuous perception* - the AI reacts to an
evolving, unfinished drawing on a clock, remembers its own misses within the
round, and races you. The interaction unit is not a message, it's a live feed.
Upload-a-photo-and-ask kills the game entirely: no time pressure, no
narrowing-in, no duel.

**"What latency engineering did you do?"**
- Snapshots are re-composited to **black ink on a white 512px PNG** before
  sending - vision models read clean line art far more reliably than a dark
  UI screenshot, and 512px keeps payloads small (~10-30 KB).
- **Never more than one request in flight.** If the model is slow, we skip
  intermediate frames and always send the *latest* canvas - guesses stay
  current instead of queuing into the past.
- **Change detection**: a stroke revision counter means an unchanged or empty
  canvas sends nothing. Zero wasted calls while you think.
- Wrong guesses are fed back into the prompt, so each call gets smarter
  instead of starting cold.
- Failures degrade in-game: "SIGNAL LOST - RECONNECTING..." with exponential
  backoff (2.5s -> 5s -> 10s -> 20s), and the round keeps running.
- Speech is cancel-and-replace: the bot always voices its newest thought.

**"What does it cost to run?"**
Nothing. gemini-3.5-flash-lite free tier (fast, non-thinking, generous
daily quota; model overridable via GEMINI_MODEL in js/config.js). Note the
heavier gemini-3.5-flash caps at only 20 requests/day free - too small for
a game that snapshots every few seconds, so the lite model is the default.
A full 60s round is at most ~20 requests
(usually far fewer thanks to change detection); a 5-round match stays in the
low hundreds of requests per day of heavy demoing. If the free tier throttles
(429), the backoff absorbs it mid-round.

**"Privacy?"**
The API key and all game state live in JS memory only - no localStorage, no
cookies, no server. Refresh = factory reset.

---

## TECH NOTES

- **Stack**: index.html + styles.css + 6 plain JS files. Runs from any static server.
- **Drawing feel**: pointer events with coalesced points, quadratic curves
  through stroke midpoints, incremental segment rendering (no full redraws
  while inking), DPR-aware canvas. Undo/eraser/3 sizes/4 inks.
- **The judge is defensive**: strict JSON schema requested via
  `responseMimeType`, markdown fences stripped, one strict retry on malformed
  output, confidence clamped.
- **Fuzzy match**: case/punctuation/article-insensitive, plural-aware
  ("volcanoes" wins "volcano"), spacing-insensitive ("blackhole" wins
  "black hole"). Synonyms, whole-word containment ("balloon" for "hot air
  balloon") and typo-distance near-misses are *never* auto-wins - they ask the
  player to rule with Y/N.
- **Art direction**: locked 6-color palette (#0a0a08 / #131310 / #ffd400 /
  #8a7500 / #f2f2e9 / #ff2d55), Press Start 2P + VT323, pixel-notched borders
  built from hard box-shadows, hazard-stripe headers, CRT scanlines + vignette,
  steps() motion, Web Audio square-wave blips. Red appears only in the final
  10 seconds and error states. `prefers-reduced-motion` respected.
- **Bot voice**: pick any system voice in CONFIG - hover a voice in the list
  and it introduces itself out loud ("Hi! I am Zira.") before you commit.
- **Bottom ticker**: solid yellow news-crawl stuck to the bottom of every page
  (js/ticker.js, self-injecting) - black Press Start 2P text scrolling left
  forever ("YOUR OPPONENT NEVER SLEEPS ◆ LAST GAME: 'SAD LIZARD' ..."), seamless
  duplicate-and-translate loop, static under reduced-motion. Edit the LINE
  constant in ticker.js to change the copy.
- **Chalk + arcade SFX**: drawing on the canvas plays a live chalk-scratch
  (filtered white-noise gated by pen speed - louder/brighter the faster you
  draw, ducks when you pause); every button/link across both pages fires an
  8-bit "select" blip on click AND a softer hover tick when the cursor enters
  it (once per entry, throttled so sweeping the menu doesn't machine-gun -
  js/uisound.js, delegated listeners). All synthesized in Web Audio - still
  zero audio files. Mute (`M`) silences everything.
- **Custom 8-bit cursors**: a black pixel arrow (default), a yellow-edged
  arrow on anything clickable, and a crosshair on the canvas - all native CSS
  `cursor: url()` (data-URI SVG), GPU/OS-composited with zero JS and zero lag.
  Each has an auto-generated light outline so the black cursor stays visible on
  both yellow and black. Regenerate via scratchpad/gen-cursors.js.
- **Pixel cursor trail**: chunky black squares that fade out behind the pointer
  (js/cursortrail.js) - paced by requestAnimationFrame so a fast flick can't
  flood it, skips the sketchpad so drawing stays clean, honors reduced-motion.
- **The bot has a mouth on it**: SKETCH-BOT 9000 is a savage, dark-humor art
  critic - it roasts your drawing, references the actual shapes, and bosses
  you into adding detail ("that floating oval on two sad sticks looks like a
  deformed mushroom - give it legs"). Guessing correctly fires a pixel-confetti
  blast + party-horn fanfare over the arcade stamp.
- **Taunt engine**: between rounds the bot fires one extra Gemini call fed the
  REAL round data (word, time, streak, win/loss) and reacts to what actually
  happened - "Eight seconds for a volcano? My grandpa's toaster renders faster."
  Canned fallbacks keep the beat alive with no key.
- **Hot-mic voice**: the surer the bot is, the higher and faster it talks -
  speechSynthesis pitch/rate scale with guess confidence.
- **Sudden Death (round 5)**: the final duel round is 20s, a hard word, double
  points, with red-pulsing screen edges. Preview: `game.html?screen=sudden`.
- **Wanted Poster**: one click on the results screen downloads a pixel "WANTED"
  mugshot PNG of your best sketch (word, time, score, branding) - every player
  leaves with a shareable card. (js/poster.js)
- **Attract mode**: idle 30s on the menu and it flips into a self-playing arcade
  demo - ghost replays of sample sketches cycle while the bot "guesses" them,
  with a blinking INSERT BRAIN TO CONTINUE. Any input drops back. `?attract=1`.
- **Spectator QR** (party results): scan the on-screen QR to open a
  self-contained mobile scoreboard (scoreboard.html) with the final standings -
  the whole table can watch on their phones. Final-standings snapshot, not a
  live socket (no backend = no shared state to stream). Vendored QR encoder in
  js/vendor/qrcode.js; verified it decodes back to the exact URL.
- **Word-reveal art**: every secret word gets its own 12x12 pixel sprite -
  hand-authored for iconic words (duck, ghost, star, house...), procedurally
  generated (seeded by the word) for the rest - tiled into an animated
  scrolling background (alternating rows, stepped 8-bit bob, mirror-on-reverse)
  behind the reveal card, with the sprite also flanking the word as icons.
  `[TAB]` skips the word and swaps the whole pattern. Scroll speed / sprite
  scale are tunable via `SD.wordart.settings`. Force a word for demos with
  `game.html?screen=word&word=ghost`.
- **Demo shortcuts**: `game.html?screen=game`, `?screen=results`,
  `?screen=word`, `?screen=settings` jump straight to a screen with sample
  data - handy for showing the UI without burning a round.
