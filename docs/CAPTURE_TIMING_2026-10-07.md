# Capture timing repair and actual browser lifecycle — 2026-10-07

## What changed

An actual four-deck browser performance exposed a fragmented M4A whose container metadata said 0.3115 s but encoded packets and independent ffprobe measured 14.9446 s. This shortened captured history and stopped editable reconstruction. A second use of the same approximate metadata truncated source-window decoding, preventing export even after the capture clock was fixed.

Source description and compressed range decoding now use the actual encoded packet end. Known-codec whole-song fallback admission uses that timing too, so short first-fragment metadata cannot admit a much larger PCM allocation. A weak per-immutable-Blob cache stores only validated timing numbers; failed probes are not retained. Encoded reads retain their 2 MiB cache, MP3 gapless trimming remains, and capture events/source chunks keep the engine's own duration independently of the compressed reference.

This does not recreate previously truncated capture duration automatically. Original asset bytes and event history were not changed; keep the original portable project before any repair.

## Reproduce

Use Node 22/24 and the installed Playwright Chromium. Start an isolated local Vite source server, then run:

```sh
node scripts/perform-lifecycle-qa.mjs http://127.0.0.1:4291 /tmp/stemdeck-owned-lifecycle
```

The harness creates owned temporary browser profiles and 32-second original generated WAV fixtures, imports four decks/four stems plus full mixes through real UI file pickers, runs the actual analyzer, performs/captures, reconstructs and edits, exercises Undo/Redo, attempts live-engine print, exports actual WAV/ZIP, closes/reopens the entire browser and restores a portable project into a fresh profile. Portable asset references are compared by SHA-256 of actual saved bytes because imported database IDs intentionally change. Export PCM is independently parsed, not inferred from a download button.

Only unrelated `/api/inventory` is stubbed. No audio engine, file storage, renderer or captured timeline is mocked. Physical inputs are not opened. Generated tones test the mechanics, not musical key/BPM accuracy.

## Limits retained

The real replay-print step currently reproduces a scheduling-deadline stop under local load, including a quiet retry. Its FAIL remains separate from passing persistence/export subsets; the harness exits unsuccessfully when that replay fails. Original take/assets remain available. Do not call this full editable replay parity or product completion. No scheduling threshold was weakened.

Representative generated long-file probes measured one-hour MP3 (28.8 MB) precisely at 3600 s after gapless trimming, 111 ms; 30-minute fragmented M4A (15.1 MB), 1800.0213 s including AAC priming, 5.3 ms in Chromium 151. MP3 probing reads the encoded file sequentially in bounded chunks; this is not constant-time. No whole-file PCM decoding was used. These are local observations, not universal latency guarantees. Source description has no exposed cancellation signal; cancellation latency, pathological/enormous inputs, old-browser fallback coverage and physical/long-session/musical/mobile/installed-app qualification remain unverified.

Deployment: release preparation only. Normal stacked PR/check gates remain; no merge or deployment is implied by this repair.

## Exact export frame counts

Actual take export also exposed a frame-count roundoff defect: 779448 frames converted through seconds at 48 kHz becomes 779447.9999999999 before the underlying context truncates to an integer. The master WAV payload lost one frame while its header retained the promised length; aligned stem ZIP validation correctly refused the incomplete entry. Rendering now supplies the exact integer frame count to native OfflineAudioContext, wrapped by Tone for the existing graph. Regression exercises 27- and 779448-frame real renders, master header/payload equality and actual ZIP completion. No silent padding or weakened archive check is used.
