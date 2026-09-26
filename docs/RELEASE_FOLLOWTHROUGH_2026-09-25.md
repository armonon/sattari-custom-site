# Release follow-through — September 25

This pass follows `REVIEW_REPAIRS_2026-09-25.md`. It does not authorize production deployment or certify physical hardware.

**Current status: not release-approved.** The shorter gate and a separate two-minute soak passed, but the subsequent frozen-source repeat reproduced main-thread audio deadline failures under load. Passing earlier runs do not override that failure.

## Changes

- Scheduled replay loops update public deck state at their audible time, not when queued early. Pending state is discarded on stop and cannot affect a replacement deck. This repairs the previously failing recovery assertion without scheduling the loop twice.
- The piano roll renders visible pitch rows plus overscan instead of mounting every key/grid control on each edit. Spacer geometry preserves all 108 pitches. Scroll and octave controls still expose the complete keyboard, and active gestures retain their rows. Tests traverse every pitch and preserve velocity editing.
- Arrangement playback chooses its opening timestamp after constructing the master processing graph. Cold rack setup no longer consumes the opening scheduling margin.
- Windowed grains use native buffer-source stop times and native completion notifications, removing the per-grain ToneBufferSource timer and idle-disposal callback. Tone's envelope timeline is retained to preserve existing musical output. The grain-generation clock itself remains on the main thread; this is reduced overhead, not an AudioWorklet transport replacement.
- Granular PCM failure diagnostics report the first differing sample, worst differing sample and reference/render energy. Acceptance thresholds are unchanged.

## Focused validation

- 50 focused replay/grain/piano/editor tests passed. The linked-pattern editor test that previously exceeded five seconds took 702 ms in that run. This is one measured run, not a universal performance guarantee.
- 14 arrangement-engine tests passed, including a simulated 400 ms cold master-rack construction.
- The initial fully native envelope candidate failed reference PCM comparison and was not accepted. The final envelope-compatible version passed all eight reference render cases at 44.1/48 kHz (maximum sample difference `2.9802322387695312e-8`), both scheduled-loop delivery comparisons, and a 14-second four-stem replay with zero source underruns and zero late scheduled controls. `/tmp/stemdeck-native-grain-parity-final.json`.
- Preliminary browser qualification passed live loading/seeking across two decks and eight stereo sources, and all four performance recovery checks including a 60-second synthetic recording. The full suite is being repeated against one frozen source snapshot; preliminary results do not replace it.

## Frozen-source software gate

This first green snapshot precedes the additional seek-boundary fix described below; it is historical evidence, not certification of later edits.

The entire gate passed at `2026-09-25T19:06:45.365Z` with unchanged source fingerprint `08e8153497ea2aad4a447a57811a7a63eebb6a5fb48cbd97597f3a9f3b10dba4`:

- Lint and type checking passed.
- **696 tests across 109 files passed together** (105.37 seconds of Vitest execution).
- Synthetic meter and tempo qualification passed.
- Production build and prerender passed.
- **All 11 browser audio suites passed.** This includes the previously failing windowed replay, live loading/seeking and performance recovery suites, plus the 60-second synthetic recording/recovery check.
- Built UI passed at **1440, 615 and 390 px**, including import, navigation, playback/pause, piano-roll access, mixdown and aligned track-stem export. Phone piano-roll screenshot was visually inspected after virtualization.
- Evidence: `/tmp/stemdeck-followthrough-gate/report.json`, with separate stage logs, audio report and UI screenshots underneath that directory. The build contains `dist/release-manifest.json` identifying this exact source snapshot.
- The gate deliberately retains `releaseApproved: false`; software qualification is not physical/native certification. No production deploy, Git push, commit or native-app installation was performed.

## Extended soak and seek-boundary repair

The first separate two-minute soak failed at a seek: a generated grain timestamp was a few floating-point ULPs before its stop/start boundary, and Tone's tick query returned the intervening reset-to-zero instead of the requested source offset. This was a real source-read failure even though the shorter gate passed.

Windowed playback now preserves independent start anchors and integrates the existing clock frequency from the selected anchor. A regression covers `12.355999999999998` against a `12.356` seek boundary, the preceding sample region and subsequent progression. It does not increase lookahead or loosen deadline limits. All 23 affected grain/replay tests passed.

The next two-minute soak passed: four stereo stems from 180-second sources, two seeks, loop on/off, zero source underruns and zero late scheduled controls. Peak admitted source PCM was `133632516` bytes against a `134217728`-byte limit. This is a source-pool budget, not total application memory. PCM reference comparisons still passed with maximum sample error `2.9802322387695312e-8`. Report: `/tmp/stemdeck-seek-boundary-soak/windowed-soak.json`.

`scripts/run-windowed-soak.mjs` is now a mandatory final step of the release gate. It uses generated media and isolated browser storage, checks that its local QA port is free, writes a report, cleans up its browser/server, and fails the gate for deadline/underrun/PCM failures. A subsequent complete frozen-source run includes this step.

## Repeat gate / final correction

The repeat at `2026-09-25T19:19:30.804Z` used unchanged source fingerprint `d21d127e6849ff4940eec67d661a5345506a0fa4287cb99443da0eb8dd583384`:

- All **697 unit tests / 109 files** passed; lint, types, synthetic meter/tempo qualification, build and prerender passed.
- Built interface passed at all three widths, including playback and exports.
- **9 of 11 audio suites passed.** Windowed replay missed scheduling deadlines by approximately **474–690 ms**; live-window playback also failed its deadline checks. Recording/recovery passed all four checks, including its 60-second synthetic recording.
- The gate stopped at the failing browser stage, so its newly mandatory final soak was not run. The separate passing soak remains separate evidence, not a release override.
- Report: `/tmp/stemdeck-final-followthrough-gate/report.json`. Its combined browser-stage flags are false because audio failed; individual UI results are in `browser/ui/report.json`.

After that repeat, one additional start-anchor cancellation edge case was fixed: stopping cancels future position anchors along with the clock's future starts, preventing a resumed take from jumping to an abandoned seek. All **84 targeted tests across seven files** then passed (`/tmp/stemdeck-last-focused.log`), including that regression. The full frozen-source report above precedes this final small fix; it is not a green certification of the current tree.

The final correction passed targeted lint, type checking and a fresh production build/prerender (`/tmp/stemdeck-last-lint.log`, `/tmp/stemdeck-last-types.log`, `/tmp/stemdeck-last-build.log`). No test deadlines or PCM tolerances were loosened. The final build has not been requalified by the entire gate.

## Remaining qualification boundaries

Main-thread scheduling can still fail during sufficiently long stalls. Exact sample-deterministic replay of every DSP/transport mutation, complete native plugin integration, physical interface/MIDI/reconnect/latency testing, real musical-corpus evaluation, long hardware sessions and clean-machine installed-app verification are not established by these tests. No 10/10 or unrestricted release claim is made.
