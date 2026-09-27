# Reliability follow-up — not a release sign-off

## Changes in this pass

- Native diagnostics distinguish callback-deadline overruns from recorder drops/write faults; the aggregate safety gate remains conservative.
- Audio channel-graph reads now use a bounded read-side lifetime guard with lock-free atomics, rather than an atomic `shared_ptr` load that may acquire a standard-library lock. Outgoing graphs remain owned on the control thread until audio readers finish; reclamation never occurs in the callback. Added deterministic retirement/lifetime coverage and switched the concurrent sample-continuity test to the new read path.
- A subsequent strict contract run exposed two callback-side deallocations in refined-analysis replacement. Assembly/backtrace inspection identified the final refined-analysis shared-owner release in `TrackDeckBody::processInto`. Deck source/analysis replacements now retain outgoing versions and reclaim them on publishing threads. Added deterministic lifetime/RT-release checks. Grid publication also serializes the control-thread retirement list because edits and neural refinement can publish concurrently.
- The stress harness records elapsed callback time and thread CPU time separately, and offers an explicit `--audio-priority` simulation mode. It is not a physical-device callback test.
- macOS release scripts explicitly use the audio-priority mode, matching the native device scheduling class. Failure to obtain that priority fails; no ordinary-priority fallback or increased deadline is allowed. The ordinary-thread diagnostic remains available and its failures are retained below.
- Paced tests no longer burst-render an accumulated backlog following an OS stall. Missed wakeups now have their own failing assertion. No deadline/drop threshold was relaxed. Recording finalisation is also checked for faults.
- Native recording queues tag blocks with their original sample position. Queue overflows and oversized blocks create explicit silent gaps on the disk writer, preserving subsequent audio/event alignment and the final take length. Missing sound cannot be recovered; the take remains faulted.
- Disk writers use high (not real-time) priority. Thread startup and WAV write/flush failures are checked.
- Device reconfiguration finalises an active take before changing sample-rate metadata or rebuilding recorder pools. This prevents a disk consumer from retaining pointers into replaced buffers and preserves the original take/event clock. It ends the take; it does not claim seamless hardware reconnect recording. Added a simulated host-lifecycle regression.
- Master and retrospective capture no longer call JUCE `Thread::notify()` on the callback: `WaitableEvent::signal()` internally takes a mutex. Background consumers poll at 1–20 ms, capped to one quarter of their queue duration. Stop/prepare notifications stay off the audio thread.
- Nonempty existing recording files are refused rather than appending a second WAV header or silently overwriting a take. The desktop preflight tells the user to choose a new name.
- Stress takes now use isolated directories. Successful generated fixtures are cleaned; failed fixtures are retained for diagnosis.
- Browser replay cannot restart after disposal while waiting for audio unlock, nor retain a late-decoded input chunk after cancellation. Regression tests cover both races.

## Diagnostic history before the final verification

The earlier two ordinary-thread runs with six counter increments remain recorded in `RELEASE_HARDENING_2026-09-23.md`; they were not passes.

1. Instrumented ordinary-thread run: one overrun at 104.587 seconds, **14.877 ms elapsed / 0.584 ms thread CPU**. Most elapsed time was not executing on the callback thread. This is consistent with preemption or blocking, not 14 ms of DSP computation; CPU timing alone does not distinguish those causes.
2. First audio-priority run: zero overruns, zero recorder drops; p50 0.504 ms, p99 0.764 ms, max 1.211 ms, budget 10.667 ms.
3. Repeat audio-priority run: **failed**, one callback overrun plus 1,688 recorder drops. The callback was 14.181 ms elapsed / 0.448 ms CPU.
4. After recorder alignment/priority changes, but before harness wakeup correction: **failed**, 23,986 recorder faults, no callback overruns; max callback 0.698 ms. This is not evidence of successful recording.

These runs used the old accumulated catch-up pacing. Their recording-fault totals cannot establish how many faults a real, paced hardware callback would have; the corrected harness must be verified separately. The host also had substantial unrelated load.

The deterministic recorder-health test passed the deliberately stalled-consumer overflow test, exact subsequent marker position, trailing-drop duration, and checkpointed force-quit recovery. Its interface reconnect check is simulated processor lifecycle, not a physical cable test.

## Storage cleanup

Repeated synthetic stress tests had appended into ten fixed-name WAV files under `~/Library/Caches/StemDeckRtSafety/`, accumulating about 11 GB. Only those ten named synthetic WAV fixtures were deleted. They are not recoverable as files but their generated test audio is reproducible. No user songs/projects were deleted. Available disk space increased from approximately 14 GiB to 25 GiB at that check.

## Final verification

- **593/593 web tests in 93 files** passed, followed by type checking, 300 generated metering checks, seven generated tempo fixtures, production build and prerender. Source fingerprint unchanged across the complete gate: `0932e5d8427a954a867f7c36a9feed6e1054e80170560c1f9dd700aee814101a`. Logs: `/tmp/stemdeck-followup-20260923/`. This gate explicitly records `audioChecked: false`; browser audio checks are separate below.
- **41/41 native contracts** passed together on the final device-reconfiguration build in **56.25 seconds**, including overflow alignment, trailing drops, existing-file preservation, force-quit checkpoint recovery, old-clock preservation across reconfiguration, neural cancellation and zero-audio-allocation checks. Log: `/tmp/stemdeck-device-change-contracts-final.log`.
- Universal standalone rebuilt and passed model/helper/dependency/ad-hoc signature validation. Final executable SHA-256: `b71a09b88e4eb899946200660dde655ecc89360bb839cd137915f09cd7780af3`. This is an existing build-directory validation, not a clean-machine installation. Built app: `/Users/lillypad/Projects/StemDeck copy/build/release-today-2026-09-18/SattariStemDeck_artefacts/Release/Standalone/Sattari StemDeck.app`.
- Targeted web ESLint/type checking and both repository whitespace checks passed.

Before the channel-graph guard change, the corrected paced run had **zero recorder faults**, zero late wakeups (max wake lateness 6.060 ms), but still **failed** with one callback overrun at 9.749 s: 15.642 ms elapsed / 0.654 ms CPU. This motivated removing the callback-side atomic-shared-ownership hazard; it does not establish that hazard as the exclusive cause. Log: `/tmp/stemdeck-final-priority-soak.log`.

**8/8 browser audio fixture groups passed their functional assertions**, including the 60-second audio-clock recording/recovery soak, while the native rebuild was running. However, replay reported **two events >25 ms late, worst 238.7 ms**. The existing fixture's safety cutoff is 250 ms; this functional pass is emphatically **not** timing/exact-replay qualification. Log: `/tmp/stemdeck-followup-audio.json`. No physical devices were used.

After native builds and soaks completed, an isolated serial rerun again passed **8/8 browser audio groups**. Replay reported **zero events >25 ms late, worst 9.3 ms**. Its 60-second recording/recovery soak passed with incremental event persistence and zero reported pending audio backlog at sampled checkpoints. Log: `/tmp/stemdeck-followup-audio-serial.json`. This confirms better timing without the competing build; it does not erase the loaded-run delay or demonstrate sample-exact replay. The temporary QA server/browser were stopped afterward; existing user servers/tabs were not modified.

Do not treat the previous candidate ZIP or installed application as this revised build.

Intermediate graph/notification rebuild: 40/41 contracts passed, with `StemDeckRtSafety` correctly failing on the two analysis deallocations described above. No allocation/deallocation allowance was increased; the following rebuild includes their fix. Its failing log is `/tmp/stemdeck-lockfree-contracts.log`.

After the retirement fix and graph publication lock-pool isolation, **41/41 native contracts passed together in 83.76 seconds**, including the new deterministic source/analysis final-release checks. Log: `/tmp/stemdeck-retirement-contracts.log`. This supersedes the intermediate failing build, not the earlier paced timing failures.

That earlier standalone passed bundle validation with executable SHA-256 `6eeeda855e544154f1c37b623e6aff50f4da5a564dcc4c0cbc68bef8f2084a01`; it is superseded by the device-reconfiguration build above.

Pre-device-reconfiguration audio-priority **120-second soak passed**: 11,250 blocks at 48 kHz/512 samples, 82,174 concurrent channel add/removes, zero callback overruns, zero additional recorder faults including finalisation, zero late wakeups beyond the block budget, zero detected C++ audio-thread allocations/deallocations, no silent blocks and all finite PCM. Callback p50 **0.458 ms**, p99 **2.506 ms**, max **3.228 ms**, budget **10.667 ms**; maximum wake lateness **2.291 ms**. Log: `/tmp/stemdeck-retirement-priority-soak.log`. This is an audio-priority simulation, not a hardware callback or smaller-buffer qualification.

The ordinary-thread diagnostic **failed**: 50 callback overruns, 58 late wakeups, zero recorder faults, zero C++ allocation/deallocation violations. Worst callback **437.654 ms elapsed / 0.435 ms CPU**; worst wake lateness **80.699 ms**. Log: `/tmp/stemdeck-retirement-ordinary-soak.log`. This is strong evidence of severe non-CPU delays on the ordinary thread, not hundreds of milliseconds of DSP calculation. It must not be reported as a pass. Native release validation now explicitly requests audio scheduling priority rather than interpreting an ordinary CLI thread as a device callback.

The first device-reconfiguration contract run was **40/41** because the new fixture expected a 48-kHz take after an earlier fixture had left the processor at 44.1 kHz. The fixture now explicitly prepares its starting rate and block size; no assertion was relaxed. Failing log: `/tmp/stemdeck-device-change-contracts.log`. The complete rerun passed as reported above.

**Two consecutive final-build audio-priority 120-second soaks passed**, run serially with no competing build/test started by this task. Each rendered 11,250 blocks at 48 kHz/512 samples, with zero callback overruns, zero additional recorder faults through finalisation, zero scheduler wakeups later than one block budget, zero detected C++ audio-thread allocations/deallocations, no silent blocks and all finite PCM. Counters are measured after warm-up.

| Final-build run | Channel add/removes | Callback p50 / p99 / max | Max wake lateness | Result |
| --- | ---: | --- | --- | --- |
| 1 | 72,312 | 0.464 / 1.920 / 3.387 ms | 7.674 ms | Pass |
| 2 | 72,169 | 0.461 / 0.869 / 5.658 ms | 7.083 ms | Pass |

Logs: `/tmp/stemdeck-device-change-priority-1.log`, `/tmp/stemdeck-device-change-priority-2.log`. The callback/wakeup budget remained **10.667 ms**. These passes qualify only this synthetic audio-priority workload, not a physical device, smaller buffers, real music separation or third-party plugin sessions. The earlier ordinary-thread and audio-priority failures remain diagnostic evidence; the test changes do not retroactively turn them into passes.

## Still unfinished

- **Instant separation:** this pass has not replaced or accelerated the neural model. The previously measured first preview was 42.6 seconds and full preparation 115 seconds for a generated 30-second source under load. A qualified fast streaming model/runtime, overlap reconstruction and fair multi-deck scheduling are still required. Experimental preview remains opt-in; muted stems must not silently return outside prepared coverage.
- **Exact editable replay:** cancellation and scheduling safety improved, but arbitrary pre-existing delay/reverb histories, pitch/grain phase, mutable routing/topology and all transport changes are not sample-exact reconstructed. Printed reference lanes remain necessary, especially for older captures missing state.
- **Native/browser plugins:** native helper-process hosting exists, but no embedded browser/native command-and-audio bridge exists. Browser AU/VST imports remain catalog entries, not executable native plugins. This needs a real native-authoritative bridge and routing/state/lifecycle tests, not relabeling the catalog or exposing an unauthenticated local service.
- **Hardware qualification:** no physical microphone/interface was opened and no loudspeaker test tones were emitted. Interface model, input/output channels, loopback cabling and user confirmation are required for physical latency, hot-unplug and long-session recording tests.
- **Distribution:** no commit, push, deployment or installed-app replacement was performed. The previous ZIP is stale relative to these edits. Clean-machine installation and signing/notarization remain separate release gates.
