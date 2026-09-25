# Live audio capabilities pass — 2026-09-23

Scope: browser Studio in this repository, plus a fresh targeted build of the existing native StemDeck engine. No deployment, desktop installation, commit, or microphone recording was performed.

## Implemented

### Continuous programme metering

- AudioWorklet-based stereo K-weighting, 400 ms momentary / 3 s short-term loudness, absolute and relative gated integrated loudness, and four-times interpolated true-peak estimates.
- Integration uses a fixed 0.01 LU histogram, not an ever-growing recording history. Invalid samples are counted and excluded from the calculations. Integration resets when recording starts; the UI prevents manual reset during capture.
- Master Output exposes measured LUFS and dBTP, separate from its sample-peak/RMS display. Unavailable readings are not displayed as zero.
- The existing limiter is **not** a true-peak limiter. The meter is **not EBU-certified**. Full reference-corpus, multichannel and cross-browser qualification remains outstanding.
- A self-contained worklet script is required by Tone's context wrapper. A browser integration test caught an import-loader failure that unit tests did not catch; this was repaired and retested.
- Hot-loop FIR indexing was optimized without changing coefficients. Standalone Node measurements for 120 seconds of stereo 48 kHz input: approximately 6.02 s before, 1.84 s after. These are local microbenchmarks, not whole-application CPU or audio-thread deadline certification; machine load varied between runs.

Standards: [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I), [EBU loudness resources](https://tech.ebu.ch/loudness). The formulas and interpolation coefficients are standards-based; implementing them does not itself certify compliance.

### Variable-tempo analysis and following

- Tempo-state dynamic programming follows onset evidence with bounded 120-second analysis windows and overlap. Weak beats are marked inferred; pure silence does not fabricate a map.
- File analysis runs in a worker rather than blocking UI analysis work on the main thread. Decoding and channel transfer still consume source memory; this is not streaming analysis of arbitrarily large compressed files.
- Deck beat-grid tools offer opt-in **experimental** tempo following while synced. The engine adjusts speed from local detected tempo, only while the deck is playing; it stops its timer when no followers remain.
- Tests cover gradual acceleration, quiet intros/breakdowns, ordered window joins, paused decks, and timer teardown. A generated browser fixture tracked approximately 103.4 → 121.6 BPM while its UI heartbeat continued.
- This is not a neural beat/downbeat detector, phrase detector, or sample-accurate variable warp engine. Initial alignment remains manual/constant-grid based. Half/double-time ambiguity, abrupt changes, inferred beats, and long-window joins require musical listening tests. Existing library items need reanalysis to obtain a tempo map.

### Editable replay timing

- Master compressor controls now schedule against the audio clock alongside existing deck wet/EQ and master level/limiter automation.
- Unchanged master insert racks, master tone, width, low cut, and limiter threshold can schedule ahead on their actual AudioParams with matching live smoothing.
- Any master topology change or interdependent master-stem edit keeps that take's master-processing changes on the dispatcher, rather than prematurely replacing a graph with queued automation.
- Tests cover scheduling eligibility, actual timestamps/values, topology and stem interdependence, plus a real browser replay that prints durable non-silent audio.
- **Exact replay of every effect is not complete.** Transport, pitch/grain phase, filter-type changes, lane mix interactions, and topology changes still have main-thread or state-restoration limits. Already-recorded pre-roll tails and random voice state cannot be recovered when absent from the capture. Keep printed safety audio as the sound reference. The browser test checks event application and timing, not waveform null-test parity against an original performance.

## Native plugin hosting

The desktop repository already has a helper-process host (`PluginSandboxClient`, shared-audio protocol, and `StemDeckPluginSandbox`). It is not connected to this website. Native AU/VST files shown in the web device browser remain inventory entries, not executable browser plugins.

Fresh build in `/Users/lillypad/Projects/StemDeck copy/build/codex-live-validation`, followed by CTest: architecture contract, beat-grid decoder, loudness, replay hash, and recording health — **5/5 passed**. The architecture test covers simulated helper failure, invalid audio/layout rejection, and dry bypass under lock contention; it is not an end-to-end test of an arbitrary third-party plugin crashing in a deployed helper.

Before wiring the shared UI to native processing, choose a desktop wrapper or an installed companion. No unauthenticated localhost plugin service was introduced, no new network listener for native control was exposed, and no native installation was replaced.

## Hardware validation

`scripts/hardware-session-qa.html` provides an explicit opt-in input picker and 30/60/120-minute capture runs. It checks storage quota, audio-clock lag, capture errors, bounded pending audio, chunk continuity, recovery manifests, and persisted event counts. It writes a downloadable local JSON report and leaves recorded audio in recovery storage. It does not upload audio, monitor speakers, or delete recordings.

Start locally with:

```sh
npx vite --config vite.qa.config.mjs
```

Then open `http://127.0.0.1:4192/scripts/hardware-session-qa.html`. Choose the interface, duration, consent checkbox and Start. Budget several GB; keep the computer awake. After stopping, listen to recovered input audio, relaunch and recover, then export and listen again. An early stop is marked incomplete. Input removal is treated as an interruption.

**No hardware session was run in this pass.** Permission and interface selection are still needed. UI opt-in safeguards and report logic were checked; actual device discovery/capture/recovery through this new harness requires the real run. Browser continuity cannot prove zero physical-interface/driver dropouts.

## Verification evidence

- Production build, ESLint, TypeScript and whitespace checks passed.
- Browser loudness/worker fixture: **2/2**. Optimized meter: −19.999995 LUFS integrated, −19.991152 dBTP on a generated −20 dB stereo 997 Hz signal; zero invalid samples. Worker analysis completed in 277 ms with 26 UI heartbeats in the final browser run.
- Independent FFmpeg `ebur128` comparison passes within 0.1 LU at 44.1 and 48 kHz, including quiet sections and silence. Additional coefficient, reset and intersample-peak tests pass. This is not the complete EBU corpus.
- Browser recovery/replay/generated recording fixture: **3/3**. Sixty seconds of real audio-clock capture under automation/UI load; continuous recoverable chunks and journal events; 0 replay events >25 ms late, worst 4 ms in this run. Not a long hardware session.
- Accelerated two-hour worklet simulation is part of the automated suite, distinct from real-time hardware evidence.
- Final full suite: **452 tests passed across 71 files**, using two workers. An earlier concurrent run hit one existing UI test's 5-second timeout; the final run passed that test. New regression tests also exposed a too-strict floating-point assertion and an incomplete meter test mock, both corrected without weakening product checks.

## Release gates still open

1. Deterministic DSP/transport state capture and audio-clock scheduling for every editable performance event, with source-to-replay PCM comparison under load.
2. Native shared-UI host integration and real third-party plugin scan/load/editor/state/crash/restart tests.
3. Approved long physical-interface recording, disconnect/reconnect, crash recovery, export and listening validation.
4. Reference-music tempo corpus and full loudness/true-peak qualification across supported browsers, rates and machines.

Do not describe this pass as exact-all-effects replay, certified metering, browser-native plugin support, or a fully signed-off hardware release.
