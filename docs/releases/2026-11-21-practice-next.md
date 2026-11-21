# Practice tools, faster first sound and a Key & BPM benchmark (2026-11-21)

Branch `feat/flagship-practice-next`, stacked on `feat/flagship-separator-keybpm`.

## What musicians get

- **Hear something sooner.** For songs over 45 seconds, a 20-second section (from
  about 30% in) is separated first and opens in the player for listening and mixing
  while the whole song separates. No downloads from the preview; it is not saved,
  never blocks the full run, and is released when the song finishes or stops. It
  adds roughly that section's processing time to the total. First use still
  downloads the 172 MB model before anything plays.
- **Slow down and transpose.** Speed 50–125% keeps pitch; ±6 semitones keeps tempo.
  All stems are stretched with WSOLA using one shared alignment path, so the mix
  stays phase-coherent (unit-tested: the sum of stretched stems equals the stretched
  sum). Pitch is applied by playback rate (and cubic resampling in exports).
  Optional "use my speed and key in the download". Practice quality: expect some
  smearing on sharp transients and at extremes. Songs up to 6 minutes.
- **Beat grid.** Beats from drums + bass via the existing tempo tracker (worker):
  bar lines on the waveforms, a click locked to the audio clock (including through
  loops and speed changes), a one-bar count-in, A–B snapping, 1/2/4/8-bar loops from
  the playhead, and an adjustable bar start. Downbeats are assumed 4/4 from the first
  tracked beat; they are not detected.
- **Key & BPM benchmark.** `scripts/benchmark-key-bpm.mjs` runs the worker's exact
  analysis on labelled audio. Results (`docs/qualification/key-bpm-benchmark-2026-11-21.md`):
  24 generated songs: key 95.8% exact, tempo 100% within 4%. 17 Sattari lesson
  recordings: key 35.3% exact, tempo 70.6%. Supported keys were exact 5/6, tentative
  1/7, which validates the tentative label; the UI now says so and shows the
  alternative beside tentative keys. Real-world accuracy across genres is
  **BLOCKED** on a licensed, labelled song set (`KEYBPM_BENCH_MANIFEST`).

## Fixes found during verification

- The beat grid was first written to `src/utils/beatGrid.js`, overwriting the
  Studio's existing module; the production build caught it. Restored unchanged; the
  player grid is `stemBeatGrid.js`.
- `…-full-mix-mix.wav` naming, and loop time stamps that floored (1.97 s → "0m01s");
  names now round to the nearest second.
- A speed-slider label collision (`<output>` is labelable) found by tests; the slider
  has an explicit accessible name.

## Verification (this branch, local production build, macOS, Chromium 159 headless)

| Check | Result |
| --- | --- |
| Full vitest suite | 2516/2516 tests, 277 files |
| Type-check, ESLint on changed files, build, SEO check | Pass (91 public pages) |
| Real-model end-to-end (`qualify-flagship-tools.mjs`, CPU) | 35/35: beat grid 119.7 BPM on the 120 BPM demo; 75% speed export 470,400 frames as expected; preview section playable before the 50 s song finished; plus all earlier checks |

NOT VERIFIED: listening quality of stretched/transposed audio; click and count-in
timing by ear; GPU inference; physical phones; Safari/Firefox; songs near the 6-minute
practice limit on low-memory devices.
