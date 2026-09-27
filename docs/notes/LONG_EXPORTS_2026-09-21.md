# Long-set browser exports — 2026-09-21

## Changes

- Arrangement mixdowns and aligned track stems render in 30-second sections with a 12-second baseline DSP preroll (extended for serial insert-effect tails), then encode 24-bit / 48 kHz stereo PCM in a worker.
- Section rendering retains original clip coordinates for fades, automation, sample offsets and MIDI note phase. It skips silent MIDI sections and does not depend on background-tab timer ticks.
- Exports write incrementally to origin-private temporary disk storage. The old full-output 512 MiB allocation and aggregate stem allocation are no longer on the UI export path.
- Standard WAV below 4 GiB; RF64 for larger WAV data; ZIP64 archives for stems. No silent 32-bit size/offset wraparound.
- Storage quota is checked before export. Cancellation, encoding errors and quota exhaustion abort and remove the partial generated file. Source audio and projects are untouched.
- Completed exports remain available under **Export range & filename → Export downloads** for downloading again or clearing their temporary copies. Disk-backed exports can be recovered after a page reload. Clear copies only after a download finishes.
- Browsers without the private-file-system backend retain a guarded 128 MiB in-memory fallback with an actionable message for larger exports.

## Evidence

- Real browser: 25-minute synthetic sparse set produced a 432,028,844-byte disk-backed WAV, with correct PCM header and cache recovery. The test removed its completed temporary file.
- Real browser: six export checks passed, including sustained sine/pad/synth notes across a 30-second boundary, stereo fades/volume/pan/filter automation, and cancellation cleanup. Section/reference maximum sample difference required to be below 0.001.
- Real browser: all 11 instrument regression checks passed.
- Nine packaging/planning contracts passed: PCM samples/CRC, WAV/RF64, independent Python ZIP validation, offsets beyond 4 GiB, quota/abort, an eight-hour export plan, and eight aligned five-minute stems exceeding the former aggregate budget. Large-size planning tests use mocked writes; they are not eight-hour real-time soak tests.
- Final combined arrangement/export suite: 97 tests across 15 files passed. The initial run under heavy host load timed out in six UI tests; all passed on the combined rerun (53 seconds).
- Capture/audio-engine follow-up: 25 tests across four files passed. Browser integration uncovered and verified a fix for Tone's wrapped audio context being passed to the native worklet constructor. Capture now uses the owning context's worklet factory; the 12-test native arrangement suite passed, including durable source chunks and recording recovery.
- Total real-browser coverage: 29 checks passed (six long-export, 11 instrument, 12 arrangement). Focused production-file lint and the final production build passed.

## Limits that still apply

- Individual imported source assets still use browser whole-file decoding. A single very large source, many simultaneous sources, or dense MIDI polyphony can still exhaust memory even though output buffering is bounded.
- Disk quota, physical free space, browser/file-system support and keeping the page open determine available export duration. Temporary exports consume storage until cleared. They are not a substitute for a downloaded backup.
- The engine's legacy whole-buffer `render()` helper retains its 512 MiB guard for short reference renders; production `export()` uses `renderSection()` instead.
- RF64/ZIP64 support is required in downstream software for oversized exports. Pre-master stems can clip; encoding stops with a gain warning instead of silently flattening samples.
- DSP continuity uses preroll rather than serializing native audio-node state. Retest boundary comparisons if new long-tail processors are added.

## Repeatable checks

Production deployment: `6ab1cf0d0f88f7b723b95549`, Netlify site `sattari` (`53a43ab7-fd89-4b5b-902e-6bc0e36c58b2`), https://sattarimusic.com/studio. Deployment included existing functions, redirects and headers; no Git commit or push was requested or performed.

Verification: production `/studio` returned HTTP 200 and the current entry bundle. The served Studio bundle and export worker matched the local build by SHA-256. The published deployment opened successfully in the browser, including Arrange and the new export guidance.

```sh
node node_modules/vitest/vitest.mjs run --config vitest.export.config.mjs
node node_modules/vite/bin/vite.js build
```

Run `scripts/long-export-browser-qa.html`, `scripts/instrument-browser-qa.html` and `scripts/arrangement-browser-qa.html` on a separate local test origin. They use generated fixtures, not the user's Studio project.
