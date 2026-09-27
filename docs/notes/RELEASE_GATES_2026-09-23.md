# Replay, native integration, hardware and qualification gates

Scope: browser Studio follow-up to `CAPABILITIES_PASS_2026-09-23.md`. No deployment, desktop installation, native source modification or physical-input recording in this pass. Existing unrelated changes are preserved.

## Implemented in this pass

- Confirm transport transitions using the actual scheduled audio-clock time. Seeking while playing schedules a single source transition, rather than nested stop/play notifications. Rate confirmations no longer restart grain sources. Mixed legacy/confirmed captures are handled per deck.
- Compile stable-graph fader, crossfader, deck gain and master-stem/mute/solo automation into audio-clock gain ramps. Future mixer state is separate from the playing engine state. Source replacements, removals and master graph changes retain the conservative dispatcher path.
- Add maximum momentary/short-term loudness, loudness range, measurement duration and pause/resume of integrated/LRA measurement. Live meters continue during measurement pause; recording disables manual pause/reset. LRA remains labeled settling for the first 60 active seconds. Fixed histograms bound memory use.
- Add reproducible generated loudness and musical beat-map qualification runners, including optional local annotated music input.

## Evidence and important failures

- `npm run test:meter-qualification`: **300 generated assertions passed**, at 44.1, 48 and 96 kHz. Covers stereo numerical sequences for gating, window maxima/offsets, selected true-peak cases and four LRA sequences.
- `npm run test:tempo-qualification`: **7 generated fixtures passed**, using one-to-one beat matching within 70 ms and F1 >= 0.85. Steady 90/120/150 BPM, acceleration, ambient intro, breakdown and syncopation. Intro and breakdown F1 were about **0.898**, below the approximately 0.994–1.0 steady fixtures; this is not evidence of general real-song accuracy.
- Browser worklet/worker check: **2/2 passed**. Generated 997 Hz programme measured approximately -19.999995 LUFS integrated and -19.991152 dBTP, zero invalid samples. Variable tempo tracked 103.4 to 121.6 BPM; UI heartbeat continued.
- Browser replay/journal quick check: **1 passed, 1 failed**. Committed events survived journal close/reopen. Printing replay stopped because an event arrived more than **250 ms late**. The safety threshold was not relaxed. This is a release-blocking stress result, not an exact-replay pass.
- Final changed-module regression run: **24/24 tests across six files passed**, covering transport capture, replay planning/reconstruction, scheduled mix compilation, loudness and beat scoring. Single worker; 20-second CLI test timeout. Total wall time was 184.88 seconds, including 100.97 seconds of environment setup, under heavy load.
- Final ESLint, TypeScript, production build and Git whitespace checks passed. The production build completed in 8.30 seconds. This build was not deployed or installed.
- Full regression suite: **not completed**. Initial two-worker run hit five-second UI test timeouts and was interrupted. A single-worker rerun with CLI-only 20-second test / 30-second hook timeouts stalled under increasing host load and was also stopped. Default timeout settings and product safety limits were not changed. Changed-module and static/build check results are recorded below when complete; they do not replace the full-suite gate.
- Host load rose from above 130 to above 200 during verification. Other applications and builds were left untouched. This is a confounder, not grounds to dismiss the replay failure.

## Gate 1 — exact editable replay: OPEN

Transport fixes and more audio-clock automation do not establish exact PCM equivalence. Pitch/grain phase, pre-recording tails, graph replacement, filter-type changes and some transport dispatch still need deterministic state capture/scheduling. Legacy captures cannot recover state that was never stored. Retain printed safety audio.

Next acceptance work: compare original and replay PCM for each effect, transport transition, interdependent mute/solo state, rate/loop change and graph edit; run these at normal and contended load. Preserve and report mismatches, missing source state and lateness. A durable non-silent print alone is not sound-preservation proof.

## Gate 2 — native plugins in shared UI: OPEN

The desktop repository contains a helper-process plugin host. The website does not execute native AU/VST files; inventory entries are not hosted plugins. Choose one delivery model before adding privileged integration:

1. Recommended: shared browser UI embedded in the installed desktop app, connected through a narrowly scoped native bridge.
2. Website plus installed companion, requiring authenticated pairing, origin restrictions, bounded messaging, lifecycle/security design and an explicit installation flow.

No unauthenticated localhost native service was created. Acceptance needs actual third-party scan/load/editor/parameter/state/restart/crash tests and native audio routing, not a browser-only mock.

## Gate 3 — physical hardware sessions: OPEN

No microphone or interface was opened without user confirmation. Existing `scripts/hardware-session-qa.html` supports opt-in 30/60/120-minute local recording and recovery reporting. User must identify the input/interface and authorize capture. Check storage capacity, keep the machine awake, use known test material, then test disconnect/reconnect, interruption, reopen/recovery and export; listen to recorded and exported audio. Browser timing/chunk continuity cannot alone prove absence of driver or physical input faults.

## Gate 4 — metering and musical qualification: OPEN

Generated numerical checks are not independent certification or the full reference corpus. Exclusions include 5.0/multichannel (engine is stereo), authentic programme sequences, remaining true-peak anti-alias/transient cases, full ITU BS.2217 coverage and supported-browser/device qualification. The limiter is not certified true-peak protection.

Reference descriptions: [EBU Tech 3341](https://tech.ebu.ch/files/live/sites/tech/files/shared/tech/tech3341.pdf), [EBU Tech 3342](https://tech.ebu.ch/docs/tech/tech3342.pdf). No official audio corpus is bundled. Review [EBU test-set terms](https://tech.ebu.ch/files/live/sites/tech/files/shared/testmaterial/use%20of%20EBU%20AUDIO%20test%20sequences.pdf) before acquiring/using their audio.

Real music requires rights-cleared tracks and independently annotated beat times, including live drummers, weak onsets, silence, breakdowns and abrupt tempo changes. The local runner accepts:

```json
{"tracks":[{"name":"Reference song","file":"/absolute/path/song.wav","beats":[0.5,1,1.5],"minF1":0.85}]}
```

```sh
npm run test:tempo-qualification -- /absolute/path/private-corpus.json
```

FFmpeg decodes local files; the runner does not upload the corpus. Half/double-time and off-beat matches are not silently credited as exact matches.

## Release statement

All four gates remain open. Do not advertise this pass as exact-all-effects replay, browser-native plugin hosting, a completed hardware soak or certified metering.
