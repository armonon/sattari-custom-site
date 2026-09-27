# Arrangement correctness and reliability pass

Scope: browser Studio in `site/`. These changes do not update the native desktop binary or deploy the public website.

## Implemented

- Comp lanes preserve instrument/audio processing, post-device gain, automation and stem assignment; incompatible device chains get separate comp buses.
- MIDI recording snapshots the selected instrument, sample settings, gain, pan and device chain at take start. New takes do not inherit source mute/offline flags.
- Trimming retains hidden notes and envelope data. Extending the edge restores retained content, including after save/reopen. Explicit splitting still creates independent pieces.
- Range export retains original source coordinates and effect history, exports the requested frame count, and supports tail-only ranges. Full exports retain their existing end guard/tails.
- One lower editor switches between clip, devices, track automation and piano roll. The timeline remains above it. Arrange uses a compact master with expandable processing. Mobile editor widths are bounded.
- Track volume, pan and built-in device parameters have editable automation. Playback and export schedule these on the audio clock. Muting cancels queued gain endpoints so a later endpoint cannot accidentally unmute the bus.
- Confirmed deck transport events include actual position/rate/start timing. Recordings preserve editable events plus original history; project backups include source assets referenced by the events.
- Source replay reconstructs deck play/pause/seek/rate, source changes and mixer/crossfader moves into editable clips and volume automation. Reconstructed lanes start muted, retaining the printed reference.
- Event history and captured source lanes survive a failed master-container decode. Event timing and values can be edited, disabled and restored in the capture editor.
- PCM/float WAV export decodes only the source sample windows needed by each render section. Decoded source cache has a 384 MiB budget. Compressed formats still use browser whole-file decoding.
- Autosave coalesces edits after 600 ms idle, with a 3-second maximum wait and lifecycle flushes. Existing conflict checks remain in place.
- Timeline clips outside the horizontal viewport are culled. Playhead visual updates no longer require a full React render every tick. Group drags preserve relative time/track positions; vertical-only drags work.

## Verification

- Production Vite build passed (2.71 seconds on the final build).
- Combined Studio components, utilities and Studio page run: **302 tests across 46 files passed**, single worker, 49.09 seconds.
- Focused audio/model/editor regression run: 93 tests across 17 files passed.
- Focused recording/storage/master/editor run: 82 tests across 12 files passed. These runs overlap; do not add the counts.
- Native browser recording/arrangement harness: 12 checks passed. Uses real AudioWorklet, MediaRecorder and Web Audio with generated signals, not mocked DSP.
- Native rack harness: **18 checks passed**, including comp PCM comparison after reopen, tail-only range comparison, automated section rendering and a 24-track/960-clip edit/reopen/missing-file/relink/render fixture. The dense fixture uses one shared source; this is not a 960-unique-file memory benchmark.
- Layout inspected at 1280×720 and 390×844. Fixed overflowing mobile editor widths and verified timeline plus piano editor visibility.

Re-run regression tests with:

```sh
node node_modules/vitest/vitest.mjs run src/components/studio src/utils src/pages/SattariStudioPage.test.jsx --pool=threads --maxWorkers=1 --minWorkers=1 --testTimeout=30000
node node_modules/vite/bin/vite.js build
```

Native browser fixtures: start `node node_modules/vite/bin/vite.js --config vite.qa.config.mjs`, then open `/scripts/arrangement-browser-qa.html` and `/scripts/rack-browser-qa.html` on port 4192. This separate origin avoids touching the working Studio session. Fixtures create and clean up generated test assets and do not send audio to speakers.

## Remaining limits — not release sign-off

1. Fully faithful, editable replay of every live DSP stage is **not complete**. Deck/stem reverb, echo, filters, pitch/key-lock, loops, pads/input processing and master changes may still require the printed take. Unsupported events are reported rather than silently treated as reconstructed. Live gain smoothing is approximated by replay envelopes.
2. Performance event history is committed to the project after stopping a recording. Durable source audio chunks have recovery support, but the in-progress event stream does not yet have its own crash-recovery journal.
3. PCM window decoding applies to supported RIFF WAV formats. Long compressed files and unusual WAV containers can still need whole-file decoding. The memory guard is not a general streaming playback engine.
4. Comp processing is preserved, but cutting a region does not recreate all pre-region FX history from the unselected original performance.
5. Horizontal clip culling is implemented; full vertical track virtualization and more compact undo history remain future work.
6. Generated-signal tests are not a hands-on musical session or an hours-long hardware soak. Physical MIDI, microphones, interfaces, device disconnects, output listening and long-session thermal/dropout behavior still need validation.
7. No deployment, commit, or installed-desktop update was performed by this pass.
