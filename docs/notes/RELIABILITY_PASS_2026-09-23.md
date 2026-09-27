# Browser Studio — limitations/reliability pass

Scope: browser Studio in this repository. This is not verification of the installed native StemDeck application. Existing worktree changes were preserved. Nothing was committed or deployed in this pass.

## Implemented

- Long/dense arrangements use rolling eight-second playback windows, with four seconds of read-ahead, private decode caches, cancellation guards and explicit missed-deadline errors. PCM WAV sources are read by range. Original clip coordinates and shared track effect buses survive window joins; a chunk boundary does not introduce a new clip fade.
- Recording reuses three bounded PCM buffer banks instead of allocating a new large bank at every rollover. The encoder transfers buffers back to the capture worklet. Partial-chunk waveforms ignore unused trailing samples. Existing backpressure stops remain in place.
- Recording diagnostics include audio-context state, visibility, wall time, audio-clock time and captured frame progress. Initial diagnostics and final history are included in the performance journal.
- Portable `.sattari` projects use a version-6 binary container: bounded audio copying, disk-backed writing where supported, per-asset checksums, and validation before import. Legacy version-2 through version-5 JSON readers remain. Temporary project archives appear alongside recoverable export files. Concurrent portable saves/project replacement are guarded.
- Autosave uses atomic IndexedDB transactions with separate track/take records and a revision check to reject stale writes from another tab. Deferred writes are serialized. New-session reset uses the same concurrency guard. Legacy local saves are still readable.
- Deck sync now aligns beat phase as well as tempo. Cue tools expose first-beat placement, 10 ms nudges, half/double BPM, and explicit alignment. Followers use the playing reference deck's effective tempo. Loading a replacement analyzed source clears the previous beat offset.
- Compact track headers and 58-pixel clip lanes recover timeline space. The piano editor defaults to 500 pixels with a larger note viewport. Mobile collection management collapses while the collection selector stays visible.
- Lint failures and two hook warnings were fixed. The lightweight core-check script was repaired for current module dependencies.

## Verification

- Full Vitest suite: **439 tests, 67 files passed** (one worker; 163.79 seconds under concurrent machine load).
- Production build passed (latest measured build: 3.03 seconds).
- Type-check passed; note that JavaScript checking is not comprehensive because the existing configuration disables `checkJs`.
- ESLint passed without warnings/errors. `git diff --check` passed.
- Fast core check passed: comp regions, MIDI timing/sustain, malformed files, shared capture clock, chunk rollover, stereo/mono capture.
- `scripts/streaming-storage-qa.html`: **3 passed, 0 failed** in the native browser. Tested real IndexedDB reopen/reset/conflicting writers, actual binary backup audio, and a seek into a 181-second PCM source followed by playback across two eight-second boundaries. Four recorded chunks and 6,658 continuity probes passed; source-wide decode cache remained empty.
- `scripts/performance-recovery-qa.html`: **3 passed, 0 failed**. In-progress committed events reopened correctly; edited deck/stem/pitch/loop/master events produced durable non-silent audio; the 60-second real-time capture remained aligned/recoverable under control/UI load. Replay: zero events more than 25 ms late, worst measured lateness 20.0 ms. Reported wall time matched audio time at the six checkpoints.
- Accelerated two-hour capture simulation passed. This is not two hours of real hardware recording.
- Visual checks: 1280 × 720 arranger/piano roll and 390 × 844 library. Collection tools expanded correctly; both test tracks fit on the laptop arrangement view. Temporary viewport settings were restored.

All browser audio fixtures used generated signals, without microphone access or speaker output. Test-created assets, journals, temporary archives and the isolated session test database were cleaned up.

## Still not signed off

1. **Exact editable replay:** transport, pitch and topology-changing operations still rely partly on main-thread dispatch. Pre-record effect tails/internal granular state are not reconstructed exactly. Printed audio remains the safety reference.
2. **Compressed source memory:** windowed reads apply to supported PCM WAV. Compressed sources and sampler assets can still need whole-file decoding and must fit the decode budget (128 MiB per streaming window; 384 MiB in ordinary preparation). Browser storage quotas and export fallback limits remain intentional safety constraints.
3. **Live edits during streaming:** structural edits currently restart streaming at the current position and may produce a gap. The generated-signal continuity test covered ordinary audio playback, not every instrument/effect/loop/edit combination.
4. **Beat analysis:** correction and phase alignment operate on a constant-tempo grid. Automatic detection still uses the existing onset estimator; variable-tempo, DBN/downbeat tracking and phrase-aware Auto Mix need separate work and music-corpus validation.
5. **Native plugins:** the browser rack runs its built-in Web Audio processors. Selecting an AU/VST/CLAP file does not host its native DSP. A native bridge, process isolation and hardware/platform validation are separate implementation work.
6. **Metering:** sample peak/RMS are not standards-validated integrated LUFS or oversampled true peak. Do not label them as such.
7. **Release evidence:** no new cloud CI run, production deployment, clean-machine native install, real interface disconnect/reconnect test, or 30–120-minute hardware capture was performed. Background suspension and high machine load still require musical testing. Desktop/mobile browser parity needs a broader device matrix.

## Repeatable checks

```sh
npm run build
npm run type-check
npm run lint
node node_modules/vitest/vitest.mjs run --pool=threads --maxWorkers=1 --minWorkers=1 --testTimeout=30000
node --experimental-vm-modules scripts/check-arrangement-core.mjs
node node_modules/vite/bin/vite.js --config vite.qa.config.mjs
```

Use the isolated QA server at port 4192 to open the two HTML fixtures above. Run native-audio tests after builds/test workers finish. Do not use an active performance session as a test fixture.
