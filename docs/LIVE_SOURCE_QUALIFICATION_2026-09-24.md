# Session Integrity — bounded live sources and scheduled loops

Scope: the shared browser StemDeck. This is engineering work toward the release gate, not a production release, native installer, or musical/hardware certification.

## Implemented in this pass

- Normal deck import and project hydration now pass Blob-backed windowed sources to the same granular playback path used by replay. Existing AudioBuffer/URL callers remain compatible; those legacy callers and sampled pads are not claimed as fully windowed.
- File analysis is serialized across callers. It scans all source samples in windows with at most 16 MiB output PCM, retains compact overlapping 124-second analysis blocks with four-second overlap, and computes full-duration waveform/level statistics. Tempo/key/chord results are estimates and require musical requalification; long-source aggregation changed from a whole-song in-memory analysis.
- Cold play, seek and loop operations prepare all lanes before committing. Current audio continues while a seek prepares. Newer commands, Pause/Stop, disposal and source replacement prevent stale preparation from restarting playback. Failed/cancelled commands do not enter the performance journal as successful changes.
- Play All prewarms the selected decks before choosing their common start time. Live UI reports preparation/errors and stops claiming a deck is playing after a source failure.
- Windowed granular players accept timestamped loop states. Stable-source replay loops and confirmed seeks are scheduled ahead on the audio timeline rather than applied when a UI timer finally executes. New loop captures preserve the actual scheduled transition time.
- Replay explicitly fails when an asynchronous transport mutation cannot be applied, rather than silently printing a take with the missing mutation.
- AIFF/AIFC PCM range reading preserves an advertised import format that the compressed demuxer does not support. It validates chunk extents, channel/rate/encoding and memory admission before allocating output PCM. Unsupported compressed AIFF is rejected clearly.
- Compressed files without duration metadata use a bounded encoded-packet duration scan rather than becoming unimportable or falling back to whole-song PCM decoding.
- Key analysis reuses double-precision Hann-windowed samples and precomputed pitch coefficients instead of recalculating the same cosine inside every pitch test. Three five-second synthetic signals at 8, 44.1 and 48 kHz produced identical complete analysis JSON before/after. Single-run timings were 346.7→242.8 ms, 458.4→160.7 ms and 320.3→147.7 ms respectively; these are engineering measurements, not a broad corpus benchmark.
- A granular scheduling deadline failure stops playback with a clear error instead of bursting obsolete grains after a large main-thread stall. This is containment and diagnosis, not proof of uninterrupted playback under that load.

## Root causes

Ordinary live imports still decoded whole songs twice: once for analysis and again for playback. Replay's new paging path was not wired into those imports. Seeking could restart the player before its destination pages were ready. Asynchronous readiness also introduced a cancellation race unless playback permission, preparation and the final command were tied together.

Loop state was an immediate mutable property, so replay delivered it through its main-thread dispatcher. Timestamped loop-state lookup fixes that scheduling class while retaining the existing grain engine. Other mutation classes still need work.

## Tests and evidence

- Unit tests cover bounded analysis/complete sample coverage, waveform and level equivalence on a short source, tempo-map ordering, cold-seek atomicity, cancellation, capture journaling, scheduled-loop lookup and AIFF endian/range/truncation handling.
- Generated two-deck/eight-stereo-source browser test imports 180-second AAC sources with whole-Blob reads deliberately disabled. It analyzes the complete source, starts both decks, cold-seeks and changes loops, then checks errors, meters, underruns and source-memory admission.
- Preliminary successful live run: 4.269 s analysis, 1.742 s cold seek across eight sources, 133,632,516 peak admitted source bytes (127.44 MiB), zero source underruns. Cold preparation is not instant; original audio remains running until commit.
- The replay harness now fails on any late loop/seek event, rather than merely reporting timing counters while passing the paging assertions. Reference rendering checks both 44.1 and 48 kHz; a new case compares identical timestamped loop commands delivered at different earlier times.
- One preliminary 120-second replay passed with zero source underruns and zero late loop/seek events. A repeat failed under load: old granular callbacks were processed after the message thread fell behind, without their source pages ready. Evidence: `/tmp/stemdeck-scheduled-loop-soak.json`. This is not discarded because another run passed.
- The first full gate failed UI timeouts; its remaining unit run was deliberately stopped to reduce load. Lint passed. Report: `/tmp/stemdeck-live-integrity-gate/report.json`. No types/build/browser pass is inferred from that interrupted gate.
- An initial eight-file focused run had 42 passes and one five-second analysis-test timeout. After the key-analysis optimization, all 43 focused tests passed in 6.92 seconds without changing timeouts: `/tmp/stemdeck-live-targeted-optimized.log`.
- The later loop-state/deadline-containment regression file passed both tests: `/tmp/stemdeck-deadline-guard-test.log`. This adds one new assertion scenario beyond the 43-test run; it is not a complete-suite pass.
- The second frozen-source full gate also failed application-test timeouts. Its remaining unit run was stopped after failures; lint passed in 125.305 seconds, unit stage ended with status 143 after 294.479 seconds. Report: `/tmp/stemdeck-live-integrity-optimized-gate/report.json`. The source remained unchanged at fingerprint `a6ecf5cc97a2e151693bbe54ee2a6542de8685651d0583bab33f23eac9fc0b93`. Types, build, final browser PCM tests and built-artifact UI checks did not run in this gate. No independent soak ran alongside its unit stage. Limits and assertions were not weakened.
- Host diagnostics showed about 8.9 GiB swap in use, severe system load, and an executing rather than deadlocked test worker. These observations explain why an isolated baseline is needed; they do not prove every timeout is environmental. Unrelated applications/builds were not closed or terminated. Only this task's own failed test process was stopped.

## Not qualified / remaining work

Granular callbacks still run on the message thread. Deadline detection is not an audio-worklet implementation. Rate/pitch, source swaps, some filter/topology mutations and complete editable reconstruction remain outside exact-replay qualification. Sustained source-memory retention is measured separately from browser RSS, codec caches, encoded assets, DSP state and recording storage. Pads, instant separation, native plugin integration, real music/human listening, physical audio/MIDI, mobile interruptions, clean installation and the two-hour complete lifecycle remain open.

No category score is raised. Production stays unchanged. A new full software gate and matching frozen-source stress evidence are required before this pass can be designated software-validated.

## Immediate qualification prerequisites

Pause competing heavy builds/applications and rerun the unchanged snapshot before interpreting UI timeouts or stressing live playback further. Provide the rights-cleared music folder, physical audio interface and MIDI controller, and explicit input-recording authorization for the actual two-hour lifecycle. These prerequisites do not replace the remaining software work: the message-thread grain scheduler and unqualified mutation/reconstruction classes above remain release blockers.
