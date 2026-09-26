# StemDeck Session Integrity 1.0 — qualification ledger

Milestone: prepare → perform → capture → edit → save → close → reopen → export a two-hour set of rights-cleared real music with physical audio/MIDI hardware, without data loss or unexplained sonic/timing changes.

**Status: NOT QUALIFIED. No category is certified 10/10.** This ledger distinguishes engineering evidence from musical and hardware qualification. The last review's opinion scores remain frozen; “unscored” is not zero and does not imply a pass. No scores are raised by this implementation pass.

Current follow-through: [release-candidate hardening](RELEASE_CANDIDATE_2026-09-25.md). The latest full Node 20 gate passed 719 tests and static/build checks, but failed replay deadlines and live preparation under heavy concurrent machine load. That failure remains recorded; this is not a qualified release. Dependency security updates and further validation are in progress.

Previous scheduling evidence: [bounded native-audio queues](NATIVE_AUDIO_QUEUE_2026-09-25.md). Its unchanged-source gate passed 711 unit tests, all 12 audio suites, three UI widths and the mandatory 120-second soak. Actual audio-thread probes measured uninterrupted deck/MIDI output across 650 ms UI stalls. Those results identify that earlier snapshot, not subsequent edits or unrestricted load tolerance.

Latest engineering follow-up: [bounded live sources and scheduled loops](./LIVE_SOURCE_QUALIFICATION_2026-09-24.md). Ordinary deck import/analysis now uses bounded sources, but the new full gate failed UI timeouts and the repeated playback stress run exposed a message-thread scheduling failure. The earlier evidence below does not qualify those later changes or the production release.

## Scorecard and acceptance contracts

| Section | Baseline score | Professional acceptance test | Current evidence/status | Gap to 10 |
|---|---:|---|---|---|
| Live performance | 7/10 | Two decks/eight stems, full-length real music; play/seek/loop/cue/sync/pitch/tempo under normal and UI/CPU load at 44.1/48 kHz; zero source underruns and sustained memory plateau | Paging pool and four-source replay tests added; physical multi-deck session not run | Live import/analysis still has whole-file paths; hardware/corpus/controller/latency matrix |
| Editable replay | 6/10 | Capture and replay every mutation individually and in dense combinations; compare onset samples, PCM error, tails and processing state | Windowed vs whole-buffer grain reference at 44.1/48 kHz; previous audio-clock/control/journal tests | All-mutation canonical scheduling/state; opening DSP state; legacy capture limits |
| Arrangement | 7.5/10 | Capture → reconstruct → edit audio/MIDI/FX/automation → save → close → reopen → mixdown/aligned stems; zero lost supported fields | Existing browser editing/export and project tests | Complete event-to-native-lane mapping; sub-ms model restriction; long real-set round trip |
| Library | 8/10 | ≥5,000 rights-cleared tracks including duplicates, damaged media and incomplete metadata; interrupt imports, relink, backup/restore; zero organization loss | Existing import/organization/preview/backup tests | Large real corpus, moved-folder and interrupted-import qualification |
| Instruments | Unscored | Velocity/sustain/polyphony/preset/state/automation/export tests; live/export timing and musician playability at both rates | Existing voice, piano-roll and sequencing tests | Musical evaluation, supported sustain/control and dense voice matrix |
| Native plugin hosting | Unscored | Physical desktop host scan/load/editor/state/automation/latency/restart/crash matrix with real plugins | Shared browser rack is inventory plus web DSP, not AU/VST hosting | Authenticated/scoped desktop bridge; native qualification; do not advertise browser hosting |
| Master/output | 7.5/10 | Reference peak/RMS/LUFS where supported; live/safety/master/stem comparison; cue/monitor isolation; no unexplained gain/routing changes | Generated meter and browser master/rack qualification | Reference corpus, external routing, independent metering and limiter qualification |
| Desktop UI | 7/10 | Complete lifecycle by keyboard/mouse and unfamiliar musicians; no clipped labels, blocked timeline or ambiguous state | Automated 1440 px workflow screenshots | Observed clip-label clipping and tiny controls; human task testing |
| Mobile UI | 5.5/10 | Real phone/tablet clip and note editing, undo, transport; orientation/lock/background/route interruption without state loss | Automated 390 px workflow only | Physical devices, touch-focused density and interruption matrix |
| Project integrity | Unscored | Old-schema migration → edit → save/reopen/export; corrupt autosave/missing source/full disk/terminated save; preserve last good project | Existing persistence/migration/recovery unit and browser checks | Full historical-project corpus; real disk/permission/crash matrix |
| Long-session performance | Unscored | 30/60/120-minute physical sessions; sample-frame drift, RSS/CPU, source underruns, record backlog, handles and autosave measured | Accelerated two-hour paging model; short and two-minute synthetic audio checks | Actual two-hour lifecycle, memory plateau, real music, physical input and listening |
| Hardware reliability | Unscored | Physical interface/headphone/controller reconnect, sample-rate/buffer changes; recover or clearly stop without losing work | Synthetic input lifecycle tests only | User must identify and authorize devices and capture; no physical input opened |
| Release reliability | 6/10 | Green CI, clean committed/tagged tree, hashes of exact shipped artifact, clean install and old-project upgrade in each advertised environment | Local release gate exists; this work is not deployed/installed | Clean release commit/tag after qualification; Safari/native/mobile/install/upgrade/shipped artifact proof |

## This pass — P0 replay source paging

### Completed

- Replay's effective event plan determines source dependencies; disabled mutations and archival edits do not load missing media. Regression coverage retained.
- Deck sources are range-readable Blob descriptors rather than whole decoded songs. The live DSP engine can consume these descriptors using the same Tone grain clock, envelopes, pitch/rate behavior and downstream processing.
- One 128 MiB paging pool per replay engine admits allocations before decoding, serializes decodes, evicts least-recently-used unpinned pages, and pins buffers used by sounding grains. Separate sampled-pad PCM is limited to 128 MiB; increasing the old combined 256 MiB source budget was not the solution.
- Source-time pages include grain lookahead. Upcoming confirmed seeks and loops are prefetched independently of the replay dispatcher’s event partition. Large loop wraps assemble only the current grain; short loops use the native loop path.
- Mixed sample rates resample bounded windows with preroll/postroll through the native decoder. Temporary PCM/WAV/resampling buffers are included in admission estimates. Fractional sample offsets survive large-loop joins.
- Source failures stop replay visibly and preserve printed safety recordings. Cleanup releases decoder resources and grain page leases. Tone is pinned to 15.1.22 because the adapter depends on its granular scheduling hooks.
- Reproducible unit, reference-render and online replay acceptance tests are included. The three-minute stereo AAC fixture is a generated signal, not commercial music.

### Root causes

The previous replay cache decoded complete songs before playing them. Four three-minute stereo 48 kHz stems need about 264 MiB, exceeding its former 256 MiB source cap. The arranger's existing range reader did not help the granular replay player.

Two additional acceptance-test failures were fixed: per-grain sample-rate conversion differed from native whole-buffer conversion, and seek prefetch lost confirmed transport events after the plan was partitioned into scheduled versus dispatched events. Fractional source offsets at loop joins also required preservation.

### Acceptance tests and measurements

- `windowedSource.test.js`: accelerated 120-minute/eight-source paging sequence, memory admission/eviction, pinned pages, large-loop joins, disposal during decode. This is not elapsed real-time or physical-session proof.
- `replaySources.test.js`: four full-length source descriptors without whole-file PCM decoding; disabled source dependencies; bounded pad cache.
- `performancePlayer.test.js`: prefetch after schedule partition and loop-region changes; adjacent transport/control regressions.
- `scripts/windowed-replay-qa.html`: reference comparison at 44.1/48 kHz with offset, rate, pitch, short loop and large loop boundary cases. Acceptance: non-silent output, maximum absolute PCM error <0.0001. Observed preliminary maximum: 2.98e-8.
- Same page: four separate 180-second stereo AAC assets, captured replay, distant seeks and loop changes with synthetic 4 ms UI pressure every 32 ms. Requires zero source underruns and admitted source-page PCM within 128 MiB. `?soak=120` runs the two-minute variant. Whole-process RSS, CPU percentage and physical driver deadlines are **not** measured by this harness.
- The two-minute synthetic run passed: 487 ms preparation, zero source underruns, 133,632,516 peak admitted source bytes (127.44 MiB), 20 ms maximum control-dispatch lateness. That lateness is deliberately reported: zero events above the existing 25 ms warning threshold is not zero timing error. Evidence: `/tmp/stemdeck-paging-soak.json`. This run precedes the final import/loop-guard regression cleanup; the final frozen gate repeats the short acceptance variant.
- Final frozen-source gate passed: 104 test files / 665 tests; all 10 browser audio suites; 1440 px desktop and 390 px mobile workflows; lint (one existing hook warning), types, meter/tempo checks, production build and prerender. Source remained unchanged throughout. Evidence: `/tmp/stemdeck-session-integrity-paging/report.json`. A local green gate is not release authorization.
- Final frozen-source 120-second synthetic run: 530.2 ms preparation; zero source underruns; 133,632,516 peak admitted source bytes (127.44 MiB); no page errors. **One control event exceeded the 25 ms warning threshold, with 52 ms maximum dispatch lateness.** The harness passed its paging/audio-presence assertions, not a sample-timing acceptance test. This is a remaining timing qualification failure, not zero-latency or exact-replay evidence. PCM reference comparisons remained within 2.98e-8. Evidence: `/tmp/stemdeck-paging-final-soak.json`.

### Frozen artifact identity and regression status

- Gate completed at `2026-09-25T04:39:46.023Z` (September 24 local time).
- Base commit: `27c32c2704f4542897cacde43e0ab6e21e1cbcda`; intentional uncommitted changes are included in the tested source snapshot. No release tag exists for this pass.
- Source fingerprint: `feb8fd151f9189cc2d220ab4388cedba3a00f30b1c9ea9373dcc8d88bd21c20c`.
- Built `dist` tree SHA-256: `add334cdf48f57e965d99000e3f5090777111f9eed8f41347689abd30995e131` (288 files; 171,950,301 bytes). Hash input is sorted relative file paths, each followed by a NUL byte and that file's bytes. This identifies the locally tested artifact; nothing was shipped.
- No failures remain in the executed regression gate. Initial test failures from eagerly importing the granular adapter into unrelated mocked-engine tests were fixed with lazy loading and covered by the full rerun. This is not evidence that untested workflows are regression-free.
- Musical validation: not run. Physical audio/MIDI, human listening, native installed build, Safari and real mobile-device qualification: not run. Scores remain unchanged across all 13 sections.

### Known limits / next weakest links

1. Normal live import/analysis and sampled pads still contain whole-source paths. This pass fixes replay source preparation; it does not certify bounded memory across the complete import/perform lifecycle.
2. Tone's granular callbacks and some graph/pitch/loop mutations still depend on main-thread scheduling. Prefetch removes whole-file decode stalls, not all timing sensitivity. Runtime lateness remains measured and reported, not disguised as sample determinism.
3. A finite set of PCM reference fixtures does not certify every codec, variable-rate container, fractional loop boundary, device or musical time-stretch quality.
4. Decoder internals, encoded Blob/cache storage, DSP graphs, inputs/recording queues and browser heap are additional to the source PCM counters. Whole-process long-session memory qualification remains open.
5. Complete FX/input/MIDI/routing reconstruction into standard arrangement lanes, native hosting, physical hardware/mobile sessions and human listening remain open. No supported capability claim is broadened by this pass.
6. Repository contains the prior pass plus this pass as intentional uncommitted work. Fixtures/tests/notices are source assets, not garbage. No release commit/tag or deployment is justified yet.
7. The historical pre-migration dependency audit reported five moderate findings. The [release-candidate pass](RELEASE_CANDIDATE_2026-09-25.md) updates React Router and Vitest/UI and reports zero known audit findings. Its complete regression gate is still blocked; a clean dependency audit is not a completed application security review.

Next highest-leverage task: finish bounded source preparation and seek-aware admission for ordinary live loading, without changing musical timing while a cold source prepares. Move the remaining timing-critical dispatched mutations onto the audio/session clock and make dispatch lateness a distinct failing qualification gate; the final soak's 52 ms event is explicit evidence this remains necessary. Then qualify the entire live → replay → Arrange lifecycle against full-length rights-cleared material.

## Human / environment gate

Historical repair evidence: [September 25 critical-review repairs](REVIEW_REPAIRS_2026-09-25.md) records the initial failed full-suite run and intermittent MIDI scheduling failure. The subsequent [release follow-through](RELEASE_FOLLOWTHROUGH_2026-09-25.md) records a green shorter gate and separate two-minute soak, followed by a repeat with **697 unit tests passing but live audio deadlines failing under load**. Release approval remains blocked; earlier passing snapshots do not certify later changes or override the failed repeat.

Needed: rights-cleared music folder (with stems), interface and driver, MIDI controller, monitoring topology, sample rates/buffer settings, and explicit authorization for physical recording. No permission to capture a microphone is inferred from a general request to improve the application. Until these are supplied, physical and musical tests remain **not run**, not passed.
