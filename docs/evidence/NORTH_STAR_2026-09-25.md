# North-star workflow engineering evidence — September 25, 2026

Scope: the shared browser application, not a rebuilt or installed native app.
No release approval, deployment, score increase or hardware qualification follows
from this report. See `../PROFESSIONAL_ACCEPTANCE.md` for the remaining acceptance
projects and the canonical five-stage support inventory.

## Defects found and addressed

1. Replay-capable EQ/FX were described as editable arrangement processing.
   The capture UI now distinguishes ordinary reconstructed data from printed
   processing, and warns when no authoritative safety recording is linked.
2. `render()` decoded at the hardware rate before resampling for offline output;
   export decoded source windows directly. A generated lifecycle test measured
   maximum absolute master PCM disagreement of 0.0001322031, above its unchanged
   2e-6 threshold. Both now use the same window decoder and render graph.
3. Three-or-more-input summation produced tiny render-to-render floating-point
   differences even with an unchanged project. Offline track, EQ-band and
   harmonic sums now have a defined order. Live graph node counts are unchanged.
   EQ parity against the original Tone EQ3 is checked at 44.1 and 48 kHz.
4. A seek invalidated an old prefetch's errors, but its remaining reads still
   blocked preparation for the audible destination. Superseded background reads
   now retire after their admitted decode; destination read-ahead can proceed.
   Deterministic unit tests cover cancellation and old-job completion races.

## Generated reference lifecycle

`scripts/reference-lifecycle-qa.html` uses two 180-second generated sources, four
stems each, a fabricated eight-second history, synthetic input, MIDI, source
splitting and EQ automation. It saves, reloads the document, continues editing,
and exports master plus ten aligned pre-master track stems.

Observed after fixes:

- Identical pre-close/post-reload PCM SHA-256; maximum difference **0**.
- Master 24-bit export maximum absolute PCM error **6.332993507385254e-8**
  against render (required < 2e-6).
- Ten aligned stem files; this checks their structure/duration, not every sample.
- No physical input, real musical performance, universal FX parity, full process
  crash, cross-device transfer or true-peak certification is represented.

## First full gate: failed, retained

Report: `/tmp/stemdeck-north-star-20260925/report.json`.
Source fingerprint: `8e94dbfa7247fc2cbad57d3518d042c30f473e2990b8018f9ab6de86b34cdb02`.
The source remained unchanged throughout that run.

Lint, 743 unit/component tests in 115 files, type checking, synthetic metering,
tempo qualification, build and prerender passed. Browser checks failed because
the two-deck/eight-stereo-source cold-seek/loop test starved at source position
161.9 seconds. Later browser checks, including reference lifecycle, arrangement,
recovery and the 60-second synthetic recording, passed. Overall gate **failed**;
the final 120-second soak was not reached. This failure is not waived for load.

After the prefetch fix the isolated live-window check passed: zero source
underruns, cold seek 2313.9 ms, peak admitted PCM/reservation 133632516 bytes
against the unchanged 134217728-byte budget. This single pass is not sustained
load qualification. A complete post-fix gate is required below.

## Physical acceptance prerequisites

Owner-selected rights-cleared songs, named interface/controller, and explicit
input/monitoring permission remain outstanding. About 6 GiB disk space remained
at the final gate's start; free recording headroom before 30/60/120-minute tests.
Other running apps were not closed, and user files were not deleted.

## Second complete gate: soak failed, retained

Report: `/tmp/stemdeck-north-star-final-20260925/report.json`.
Source fingerprint: `a16a43cb79da734b5ae236bda200b8ce592b65feb0d63477b434aa1a5588d0a2`;
unchanged throughout. All 745 unit/component tests, lint, types, meter, tempo,
build and prerender passed. All 13 browser audio groups and built UI checks at
1440/615/390 px passed. The cold-seek/loop case had zero source underruns,
1284.5 ms cold-seek preparation and unchanged 128 MiB admission budget.

The final soak failed early at the second scheduled seek (source position 40 s):
one stem's launch page was not ready. Overall gate **failed**, despite the other
passes. Replay preparation was warming eight speculative seconds per upcoming
seek, delaying later launch windows. It now warms the launch window first;
ordinary audible read-ahead supplies the tail. Future replay warming is separate
from a live seek and no longer invalidates currently audible read-ahead.

The isolated 120-second replay/recording soak after the launch-window change
passed: four stereo stems, two seeks, zero source underruns, zero late events,
maximum lateness 0, peak admitted 133632516 bytes within 134217728 bytes. Report:
`/tmp/stemdeck-north-star-launch-20260925/windowed-soak.json`.
This is synthetic audio-clock evidence, not a physical recording qualification.

## Complete final gate

An attempted rerun at `/tmp/stemdeck-north-star-verified-20260925/` stopped at
lint: concurrently edited `audioAnalysis.js` needed a multiline function
signature. Only that formatting was changed; the other task's analysis behavior
was preserved. This was not an audio-test pass or failure.

Integrated report: `/tmp/stemdeck-north-star-integrated-20260925/report.json`.
Starting source fingerprint:
`c4b9e1d12d0fc5dd3c95565b0e9e39d76ee089e56a57d2421c971a9b5f1ae0ee`.

**All individual stages passed, but the gate remains blocked:** `unchanged:false`,
`softwarePassed:false`, `releaseApproved:false`, no release artifact manifest.
Concurrent work changed source/test/qualification files during the run; later
site edits also arrived after it. A stable-tree rerun is still required. Do not
reinterpret these successes as certification of the latest working tree.

- Lint, **766 tests / 117 files**, types, 300 synthetic metering checks, tempo,
  build and prerender: passed. Test totals include other tasks' concurrent work.
- All 13 browser audio groups: passed.
- Built UI/export checks at 1440, 615 and 390 px: passed. These are browser
  viewport tests, not physical mobile-device qualification.
- Reference lifecycle: identical reopen PCM hash, master PCM error
  6.332993507385254e-8, ten aligned stems.
- Sixty-second synthetic recording/recovery: passed.
- **120-second synthetic replay/recording:** four stereo stems, two seeks,
  zero source underruns, zero late events, maximum lateness 0; preparation
  505.8 ms; peak admitted 133632516 bytes within 134217728-byte budget.

No baseline score increased. No commit, deployment or native installation was
performed. Next: pause concurrent edits, run the stable-tree gate, then complete
Project A with chosen music and authorized hardware input. Physical long sessions,
native hosting, every-effect editability, independent metering qualification,
sequencer depth and cross-device usability remain open in the acceptance ledger.
