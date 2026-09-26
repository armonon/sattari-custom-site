# Critical-review repairs — September 25

This is a repair pass on the shared browser application, not full-release certification. Existing uncommitted source-window work is preserved. Production and native installations are unchanged.

## Repairs

- Arrangement reconstruction uses the same sample-rounded audible event time as replay. Scheduled controls are sorted by audible time, not UI request time, and changes beyond the take are excluded. Tests cover the previously reproduced 100 ms early loop and a JSON save/reopen round trip without mutating capture history.
- Rapid gain changes interrupt the preceding reconstructed ramp at its current value rather than appending a point before a still-future endpoint. Dense same-time changes remain ordered and validate.
- Canceled preparation clears only the pending indicator owned by its generation. Source removal and disposal cannot leave that indicator stuck; an older rejection cannot clear a newer command or replace its error.
- Removing a lane invalidates an outstanding load even when no playable lane exists yet. Finishing the obsolete decode cannot resurrect the removed source.
- Background source-read failures carry their preparation generation. A stale read cannot stop a newly prepared seek/loop. Genuine current-source failures still stop explicitly.
- Playback failure messages no longer assert that a safety recording exists without consulting recording state.
- Browser qualification exposed a further status bug: preparing a loop cleared the player failure even when the audio clock remained stopped. Only prepared commands that actually restart playback now clear player failures; loop edits preserve the diagnostic. Two new regression tests cover both cases.
- Compact arrangement track headers retain name, devices, options, mute/solo and add-clip controls. Gain/pan are inside track options. Narrow-screen options overlay the row instead of growing every track; clip tooltips retain full names and source-independent timeline position/duration.
- UI qualification adds a 615 px narrow-window case alongside 1440 px desktop and 390 px phone widths, with a 160 px maximum collapsed track-header height and reachable gain/pan assertions.
- Clip labels now have explicit, non-shrinking line geometry inside the 50 px clip instead of being vertically compressed by flex layout. A browser assertion checks vertical text clipping. Focused-arranger toolbar specificity prevents compact-icon styles from wrapping the toolbar onto an extra row.

## Validation

- Initial transport/reconstruction/capture/engine run: 42 passing tests.
- Subsequent focused run: 38 passed, one arrangement component test exceeded its unchanged five-second timeout. This is retained as a failed run, not dismissed as environmental.
- Full frozen-source run completed: 109 files / 692 tests; 681 passed and 11 failed. Seven application tests, three arrangement-editor tests, and the accelerated two-hour capture soak exceeded their unchanged timeouts. Lint passed. Source fingerprint stayed `cd111630e81df6d7182bf53385dfc73b141ed4b6ae6f6254dd4a9330ef96b19f`. Report: `/tmp/stemdeck-review-repair-gate/report.json`. The gate stopped before types/build/browser; it is not a release pass.
- After that run, gain-ramp interruption was optimized to interpolate the last segment directly instead of copying/sorting all prior points. All 30 focused tests for reconstruction, preparation, grain failure handling, and lane restoration/removal then passed: `/tmp/stemdeck-review-final-targeted.log`. The full-suite result above precedes this small optimization.
- Type checking passed independently: `/tmp/stemdeck-review-types.log`. Build and browser verification are tracked separately; no earlier artifact is used to certify the new source.
- Production build and prerender passed, including 66 canonical URLs: `/tmp/stemdeck-review-final-build.log`.
- Before the final label/toolbar CSS adjustment, built-browser session checks passed at all three widths, including playback, piano-roll access, mixdown and track-stem exports: `/tmp/stemdeck-review-ui/`.
- On the final rebuilt artifact, 615 px and 390 px passed those checks; track headers were 152 px tall and clip labels passed the vertical-clipping assertion. The 615 px timeline gained 50 px of visible height after the toolbar fix. Desktop 1440 px passed the layout/label checks but failed playback: the app displayed **MIDI scheduling fell behind** and the pause control never appeared. This is a real unresolved scheduling failure, not a visual-test exemption. Final report/screenshots: `/tmp/stemdeck-review-final-ui/`.
- Serialized browser audio checks completed: **8 of 11 suites passed**, report `/tmp/stemdeck-review-final-audio.json`. Windowed replay and live playback failed scheduling deadlines (roughly 79–193 ms observed). Performance recovery failed its loop-state assertion. The separate 60-second audio-clock recording/recovery check inside that suite passed with 1,200 events saved; this does not qualify long hardware recording. Compressed-source PCM comparison, synthetic input/reconnect/recording, sync, master processing, racks, arrangement rendering/export, and synthetic metering/tempo checks passed.
- The subsequent stopped-player-status repair passed all **54 targeted tests across six files**, `/tmp/stemdeck-review-status-tests.log`. Browser results above precede this final repair; their scheduling failures are not resolved by it. No timeout or deadline threshold was relaxed.
- Rechecking the three previously timing-out test files yielded **34 passed / 1 timed out**: all 18 application tests and both accelerated capture-soak tests passed; one linked-pattern/editor test still exceeded five seconds. `/tmp/stemdeck-review-timeout-recheck.log`. This is not a replacement for a green full-suite run.
- The latest status-repair source builds, prerenders, type-checks and passes targeted lint: `/tmp/stemdeck-review-status-build.log`, `/tmp/stemdeck-review-status-types.log`, `/tmp/stemdeck-review-status-lint.log`. The built output contains the status repair; browser qualification has not been repeated on that final rebuild. Production/native installations remain unchanged.

## Still outside a release sign-off

The main-thread granular clock is still an architectural deadline risk. Generation guards fix races, not arbitrary message-thread stalls. Every-effect sample-deterministic replay, complete native arrangement reconstruction, AU/VST hosting through a desktop bridge, real musical corpus qualification, physical audio/MIDI/reconnect/latency testing, the two-hour lifecycle, and clean installation remain unqualified. These are not fixed by narrower UI or isolated passing unit tests. No 10/10 score or full-release claim is made.
