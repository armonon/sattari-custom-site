# Native-audio scheduling follow-through — September 25

This pass targets the repeatable live/replay deadline failures documented in
`RELEASE_FOLLOWTHROUGH_2026-09-25.md`. It is not a release approval or a claim of
complete AudioWorklet transport migration.

Later changes and failed overloaded-machine reruns are tracked in
[release-candidate hardening](RELEASE_CANDIDATE_2026-09-25.md). The passing
snapshot described here is historical and does not approve those later edits.

## Implementation

- Windowed granular playback queues a bounded one-second horizon of native
  AudioBufferSource starts, envelopes and stops. The shared Tone/UI lookahead is
  unchanged. A control invalidates and rebuilds unplayed grains at its requested
  audio time; it does not wait for the queue to drain.
- Queued seek/stop/loop/rate/pitch edits retain source positions, scheduled stop
  boundaries and page ownership. Pending source pages retry the same future
  grain. The existing 50 ms missed-grain deadline remains a failure, not a
  recovery that bursts obsolete audio.
- Replay tempo and key-unlocked pitch changes are submitted together at their
  audible time. The deck's public position/rate/playing state follows that time,
  rather than jumping when the future command enters the queue.
- Replay source preparation interleaves stems' first pages and reads actual loop
  regions instead of decoding unnecessary audio beyond short loops. The existing
  128 MiB source-pool admission limit remains unchanged.
- Scheduled replay controls and MIDI voices use a one-second horizon. MIDI's
  existing overlap/queued-voice caps and missed-note tolerance remain unchanged.
  This is bounded native scheduling, not pre-creation of an entire song's voices.

## Reference-clock correction

The audio comparison exposed a duplicate tick in pinned Tone 15.1.22: at 48 kHz,
the reference emitted both `1.12` and `1.120000000000003`, doubling one grain's
attack. The queue deduplicates by audio sample; the legacy windowed callback also
guards identical ticks. The PCM oracle now explicitly deduplicates the same
floating-point tick. Its sample-error tolerance is still `0.0001`, and the test
reports first/max differing frames and tick sequences on failure.

The queue is also driven by Tone's simulated clock during offline comparisons;
the raw OfflineAudioContext clock stays at zero while Tone prepares the graph.
This distinction is tested instead of interpreting missing offline grains as a
change to the audio DSP.

## Tests and qualification

- Unit regressions cover bounded scheduling, interval deduplication, musical
  invalidation, pending-page retries, exhausted horizons, reentrant stops,
  synchronized rate/pitch commands, delayed public transport state and bounded
  MIDI scheduling across a 650 ms UI stall.
- Rendered comparisons cover 44.1/48 kHz, pitch, tempo, short and long loops,
  queued loop/rate/pitch mutations and different command-delivery times.
- `scripts/grain-stall-qa.html` uses generated audio and an AudioWorklet probe.
  It blocks the UI thread while measuring actual audio-thread RMS, validates a
  scheduled stop, and checks page/voice release. No microphone is accessed.
- The first isolated grain probe measured 221 audio blocks during a 650.67 ms
  stall, minimum RMS `0.13110749084542317`, zero post-stop RMS and zero page leases
  (`/tmp/stemdeck-queue-stall.json`). This predates the added MIDI probe and is
  targeted evidence only.
- The first full run (`/tmp/stemdeck-native-scheduling-gate`) passed windowed
  replay, live two-deck playback and the existing audio suites, but its new probe
  initially rejected absent-input blocks instead of measuring them as silence.
  The probe was corrected to report zero RMS for empty input. Source changes
  during that run invalidate it as frozen-tree qualification.
- The frozen run at `/tmp/stemdeck-final-native-queue-gate` passed 708 tests,
  build/static checks, all UI sizes and 11/12 audio suites. Recovery replay
  failed on a dispatched performance event; the gate remained red and skipped
  its final soak. Three diagnostic reruns reproduced a Master Stems event
  arriving 388 ms late. Other reruns passed with 111/228 ms worst lateness;
  those intermittent passes did not resolve the failure.
- Master-stem gain compilation is now independent of insert topology. Embedded
  stems in master-processing events are compiled in order; graph dispatch does
  not reapply or cancel their scheduled gain ramps. Public mixer state commits
  at audible time without issuing additional ramps. Three targeted recovery
  reruns then passed with zero events over 25 ms late (worst 16/10.7/8 ms).
- The final complete frozen-source gate **passed** at
  `2026-09-25T20:41:33.009Z`, source fingerprint
  `a932a2eab838176e21516dde06a2f637b7ac2c83732daaa0227f8fca654f7240`.
  Evidence: `/tmp/stemdeck-queue-and-mix-final-gate/report.json`.
  - 711 tests across 110 files passed together.
  - Lint, type checks, synthetic meter/tempo qualification, production build and
    prerender passed.
  - All 12 browser audio suites passed; built UI/import/playback/export checks
    passed at 1440, 615 and 390 px.
  - Grain and MIDI probes each measured 221 audio blocks across a 650.67 ms UI
    stall, with minimum RMS 0.1311 / 0.1442 respectively. Scheduled stop measured
    zero RMS; no page or MIDI voice leases remained after cleanup.
  - Recovery replay had zero events over 25 ms late; worst dispatch was 14.7 ms.
    Its separate 60-second generated recording persisted 1,200 events and passed
    recovery/alignment checks.
  - The mandatory 120-second four-stereo-stem soak passed with two seeks, loop
    on/off, zero source underruns, zero late scheduled controls and zero maximum
    scheduled-control lateness. Peak admitted source PCM was 133,632,516 bytes
    against a 134,217,728-byte budget (not total application RAM).
  - Rendered reference comparisons stayed below 0.0001; maximum error among the
    tested cases was approximately 2.98e-8.
  - `dist/release-manifest.json` identifies this passing source snapshot. It
    explicitly retains `releaseApproved: false` for the separate gates below.

## Remaining boundary

The queue can survive a bounded UI stall; it is **not** immune to arbitrarily long
stalls, slow decoding, operating-system audio starvation or unsupported graph
mutations. Some replay mutations remain message-thread dispatched. Exact replay
of every topology change, native/browser plugin integration, rights-cleared
musical-corpus testing, physical interfaces/MIDI/reconnect/round-trip latency,
long hardware sessions, real mobile/Safari coverage and installed clean-machine
validation remain separate, unqualified gates. Printed takes remain the safety
reference. No production deployment or native-app update is made by this pass.
