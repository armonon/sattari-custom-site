# Visual overhaul: Stem Separator console and Key & BPM readout (2026-11-22)

Branch `feat/flagship-visual-overhaul`, stacked on `feat/flagship-practice-next`.
Concept mockups: `docs/design/2026-11-overhaul/` (static HTML, not served).

## Stem Separator: "console"

- The player spans the page above the settings and song list.
- Overview of the whole song: every part's real peaks in its colour, numbered bar
  lines from the beat grid, the gold A–B loop and the playhead.
- Transport: large play button, m:ss.t timecode, bar.beat, speed and key readouts,
  and loop controls.
- Channel strips: waveform, vertical fader, **real post-fader level meters**
  (Web Audio analysers), mute and solo, WAV download and Key & BPM. A master strip
  carries the master fader, the master meter, the exact mix peak, and Prevent
  clipping.
- Side panel: Practice (speed and key), Beat and click (switches for click,
  count-in and snap; bar loops; bar start), and Download my mix.
- Day and night themes both styled. Every control keeps its accessible name.

## Key & BPM: "instrument readout"

- A large readout of the selected track (click a track name, or play one): the key
  in large type with its Camelot code, evidence and relative key, a circle of
  fifths with the key lit and the second choice shaded, and the tempo with
  half / as detected / double buttons.
- Check it by ear: play/pause and position, a **drone on the tonic**, **play the
  scale**, and a drone on the second choice.
- Tap pad (or the T key) with "Use … BPM".
- **Your notes**: one line per track, saved with corrections, included in reports
  (optional `user.notes`, report version 2 unchanged) and the CSV (new trailing
  `Your notes` column).
- The full table, correction editor, report and CSV are unchanged otherwise.

## Differences from the concept mockups

- Key & BPM keeps the results table below the readout instead of a separate song
  list on the left, so sorting, bulk export and per-row actions stay as they were.
- No "click at the BPM" in Key & BPM: the analyzer gives a tempo but no beat
  positions, so a click would not line up with the song.
- No "agreement across sections" figure: the analyzer does not report one.

## Verification

- Vitest: every file passes. The full parallel run had 15 timeouts in unrelated
  Studio/Pocket/Learn files under machine load; those 10 files pass 132/132 when
  rerun on their own. New tests: `KeyReadout.test.jsx`, `keyTheory.test.js`,
  `beatPosition`, notes in corrections/report/CSV.
- ESLint, `tsc` and the production build pass (91 canonical URLs).
- Real-model QA (`scripts/qualify-flagship-tools.mjs`, CPU): **37/37**, evidence in
  `2026-11-overhaul-evidence/`. New checks: level meters move with audio (muted
  drums read 0, master 0.55) and rest when paused; the Key & BPM readout lights
  exactly one key on the circle and the drone toggles; console and readout
  captured in both themes. Export checks unchanged (drumless mix max error 2e-8,
  loop export exact, 75% speed 470,400 frames, M4A level −0.05 dB).
- QA fix: the Key & BPM handoff now opens the demo in the player first. After the
  two-song batch step the most recently saved song is shown by default, which
  made the handoff depend on save order. Not verified: how the drone and scale sound on different
speakers, physical phones, Safari/Firefox rendering of vertical range inputs
(`writing-mode: vertical-lr`, supported in current versions).
