# Flagship tools: Stem Separator and Key & BPM (2026-11-21)

Branch `feat/flagship-separator-keybpm`. Promise: understand a song, separate its
parts, get it ready to practice, perform or create. No account, no uploads, the
existing local HTDemucs engine, and no new services.

## What musicians can do

**Stem Separator** (`/stem-separator`; `/studio/split` is the single-song view)

- Choose what you are making: all parts, a vocal backing track, drum practice,
  bass practice, solo a part, or a custom stem set. Add songs or try the
  8-second original Sattari example, which the real model processes.
- Play all stems on one clock with mute, solo, per-part level, master level, the
  original song as a separate A/B reference, and an A–B practice loop.
- **Download my mix**: one full-length WAV of exactly what you hear. Vocal backing
  = drums + bass + other instruments; drum practice = vocals + bass + other; bass
  practice = vocals + drums + other. The live mix peak is shown, and an optional,
  labelled "prevent clipping" setting is available.
- Individual WAV stems, song ZIP and all-songs ZIP, analysis JSON (unchanged).
- Continue with the song, any stem or your rendered mix in Key & BPM, or send the
  stems to Songboard (same tab).

**Key & BPM** (`/studio/keybpm`)

- Measure one song or a folder (unchanged batch worker, stop/resume, sort).
- Listen to the original audio with play/pause/seek while reading the result.
- Correct the tempo (half time, double time, tap, typed) or the key (any of 24, or
  the detected alternative), and reset to the detected values. Corrections are labels
  and never change the audio.
- Export CSV (detected columns unchanged; correction columns appended) or save a
  version-2 report that keeps detection and corrections apart. Version-1 reports
  still open. Report-only rows say audio is needed to play or re-measure.
- Continue with a track in Stem Separator; your corrections travel as your labels.

## Processing, formats, storage

- Separation: `demucs-web` HTDemucs (4 sources), pinned model revision and
  SHA-256, Cache Storage reuse, WebGPU with CPU fallback, cancellation (all
  unchanged). Stems: 44.1 kHz stereo 32-bit float WAV (verified by reading the
  downloaded files).
- Mix export: WAV 44.1 kHz stereo, 32-bit float (default) or 24-bit PCM, rendered
  from the exact stem PCM (no resampling), full length, padded never truncated.
- Key & BPM loads no separation code or model (verified in the bundle graph and by
  the browser's resource list).
- Stem Separator saves songs and stems in this browser (IndexedDB) and restores
  them on reload; **Clear saved work** removes them (not the model cache or other
  tools). Key & BPM keeps results in the tab unless you save a report. Neither is a
  backup; all copy now says this. Previously the page claimed "page session only"
  while the code already saved to IndexedDB.
- Same-tab handoffs are in memory, single use, expire after 10 minutes, and are
  described as "transferred in this tab only". A reload shows no false transfer.

## Measurement

See `docs/SEARCH_GROWTH.md` (events table). New pages `split` and `key-bpm`; new
events for cancel, preview, mix export, reports/CSV, corrections, continuations and
feedback opened. Separator outcomes are per track attempt; Key & BPM outcomes are
per batch run. Once-keys prevent duplicates from rerenders and restored work.
Consent, GPC and DNT behavior and the server allowlist are unchanged in shape.
Feedback uses the existing service-inquiry route ("Music tool feedback").

## Verification (commit on this branch, local production build)

Environment: macOS (darwin, Apple silicon), Node 24.14.1, Playwright Chromium
159.0.8154.6 headless. The host was under extreme load (load average ~300 on 10
cores), so timings are not representative.

| Area | Result |
| --- | --- |
| Unit/component suite (vitest, 268 files) | 2433 of 2443 passed on the first full run. The 10 failures were tests that used the old labels or guard rule. They were updated, and both files pass (26/26); the full suite runs again in CI |
| New tests | Mix rule and render (17), StemPlayer with a fake Web Audio clock (6), Key & BPM corrections/report v2 (25+), handoff (5), measurement routes/once/GPC |
| Type-check | `tsc --noEmit` clean |
| Production build + prerender + SEO check | Passed; 90 public pages valid |
| Real-model end-to-end, CPU mode | 23/23 checks (`2026-11-flagship-evidence/qualify-flagship-cpu.json`): 167 s HTDemucs inference on the demo; the downloaded drumless mix equals vocals+bass+other per sample (max error 2.1e-8), 44.1 kHz stereo, 352,800 frames; the downloaded mix plays back in the browser; an all-muted export is refused; the ZIP holds the right song's stems; reload recovery; Key & BPM handoff measured C major / 8B / 120 BPM; half time → 60 kept "detected 120"; audition; CSV columns; fresh-context report round trip; malformed report rejected atomically; Clear saved work |
| Real-model end-to-end, automatic (WebGPU) mode | See the PR description for the result of this run |
| Layout | No horizontal overflow at 390, 768 and 1440 px (automated, emulated widths) |

NOT VERIFIED: physical phones and tablets; Safari/Firefox for the new player and
export; subjective listening quality; long songs (10 minutes) and large-batch memory
use; GPU timing on other hardware; the Netlify deploy preview and production.
Synthetic fixtures and the 8-second demo do not establish key/BPM accuracy across
genres.

Reproduce: `npm run build`, `npx vite preview --host 127.0.0.1 --port 4310`, then
`FLAGSHIP_URL=http://127.0.0.1:4310 node scripts/qualify-flagship-tools.mjs`
(`FLAGSHIP_DEVICE=auto` for the GPU path; `CHROMIUM_EXECUTABLE` to choose a browser).
