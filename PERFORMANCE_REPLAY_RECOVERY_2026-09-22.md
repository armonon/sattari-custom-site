# Performance replay, recovery and long recording

This is a browser Studio implementation pass. No native application installation or public deployment is included.

## Added

- An append-only IndexedDB performance journal, normally flushed every 250 ms. Transactions include sequence numbers, duration and take metadata; unsuccessful batches remain pending and can retry. The timer does not queue extra writes behind a slow transaction.
- Recovery of in-progress event history and source audio together from Arrange → Loop, locators & MIDI recording → Find recoverable source takes. Recovery preserves current tracks and adds recovered audio muted/offline.
- Source recovery manifests now use incremental IndexedDB records instead of repeatedly serializing the whole take into localStorage. Legacy localStorage manifests remain readable.
- Long-session WAV capture: an explicit recording option that avoids a growing compressed MediaRecorder blob. Master safety audio, connected dry input and pad sources are saved in five-second floating-point WAV chunks. The encoder worker is reused across chunks.
- Recording health: committed event count, durable audio duration, pending bytes and errors. Audio-clock lag relative to wall time is visible and retained with the journal.
- Live-engine replay of captured deck/stem/master control events using the same audio graph as performance. Adds audition, stop and real-time print controls. Prints add a new muted reference track; they do not overwrite the original take.
- Deterministic deck reverb for new recordings (DSP version 2). Older random-reverb recordings are flagged as non-identical.
- Ahead-of-time AudioParam scheduling for common deck EQ/reverb/echo, master level and limiter controls. Other transport/topology/pitch operations still report main-thread scheduling lateness.
- Captured pad audio is preserved by default. “Rebuild pads from edited events” allows changing their performance events, with an explicit synthesized-noise difference warning.
- Additional captured event coverage for master stem changes, pad gain/source changes, lane removal and loop controls. Initial snapshots preserve actual lane levels, mute, solo and stem FX, not only UI defaults.

## Recovery guarantees and limits

Committed transactions survive page reload or process interruption. An abrupt termination can still lose the uncommitted event batch (normally up to 250 ms) and current audio chunk (normally up to five seconds); under slow storage these windows grow. A disk/quota failure is reported, not treated as a successfully saved take. No browser-storage system guarantees survival of a cleared origin or failed disk. Keep portable backups.

Long-session capture writes audio incrementally; it is not an assertion that every browser/device can sustain an hours-long live set. Full compressed-source decoding during replay is still limited to a 256 MiB decoded-source budget. Captured inputs stream in a short look-ahead window. Portable base64 project backups and huge event-history editors are separate memory constraints.

## Observed verification — initial native run

- An earlier regression run passed 305 tests across 47 files. Further changes followed, so this is not final-state regression sign-off.
- Final JavaScript/JSX syntax validation passed for nine changed implementation files; `git diff --check` passed. The final production build and full post-change regression run were stopped when the machine became severely unresponsive. The accelerated two-hour worklet test is included but was not successfully completed in this pass.
- Incremental journal reopen/recovery passed without calling finish on the take.
- Live-engine replay applied deck/stem effects, pitch, loops and master inserts, and printed non-silent finite PCM into recoverable WAV chunks.
- The stressed replay initially reported 6 control events over 25 ms late, worst 162.7 ms. Ahead scheduling for common controls was added afterward; this is not evidence that every control is now sample-exact.
- The real-time 60-second wall-clock soak **failed**: the browser audio clock advanced only about 32 seconds. Completed chunks were saved incrementally (observed pending PCM about 3.66 MiB), but that does not meet a real-time reliability target. The application now surfaces this clock-lag condition instead of showing an unqualified healthy recording state.
- System load during testing was very high (load averages above 45, later above 60). Other applications were left untouched. This observation does not by itself establish the cause of the browser clock stall.
- A later native functional replay check completed journal recovery and produced audio, but its worst delayed event was 13.524 seconds. That is a failure of real-time performance despite those functional assertions passing. Replay now aborts when an event/automation deadline is missed by more than 250 ms and does not add that aborted print as a completed arrangement track. Partial chunks remain recoverable. This final guard still needs verification on a responsive machine.

## Still not complete / release blockers

Exact editable replay of every original sample is not established. Opening delay/reverb history and grain phase from before recording are not captured. Legacy impulse responses and synthesized noise may differ. Main-thread-dependent transport, filter topology, master-rack topology and pitch changes can be late under load. Captured mic audio is editable as audio lanes, not regenerated from physical input events. Keep the original safety take.

Physical microphone/interface soak testing awaits a chosen input, permission and duration. Read-only device inspection found the built-in microphone, iPhone microphone and virtual loopback devices; no clearly identified external USB interface. No microphone was recorded during this pass.

## Reproduce

```sh
node node_modules/vitest/vitest.mjs run src/components/studio src/utils src/pages/SattariStudioPage.test.jsx --pool=threads --maxWorkers=1 --minWorkers=1 --testTimeout=30000
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js --config vite.qa.config.mjs
```

Open `/scripts/performance-recovery-qa.html` on port 4192. “Run replay and journal checks” runs the short native checks; the other button includes the 60-second recording test. It uses generated signals, no microphone or speaker output, and cleans up only its own fixtures.

The two-hour worklet test is an accelerated simulation at 8 kHz, not two hours of wall-clock hardware testing.
