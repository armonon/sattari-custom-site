# Release hardening — evidence, not a 10/10 claim

Historical snapshot: additional recorder and replay fixes were made after this
report. The candidate ZIP below is **not the latest source build**. Follow-up
qualification is recorded in `RELIABILITY_FOLLOWUP_2026-09-23.md`.

## Implemented

- Replay decodes its opening captured-input window before starting transport or recording, rather than spending its scheduling runway on IndexedDB/decoding.
- Captured-input buffering has a separate 64 MiB budget and releases completed chunks. Missing or oversized source chunks stop replay with an error.
- Stable-graph confirmed play/stop/seek events queue ahead on the audio clock, without adding lookahead twice. Pitch/rate/loop/source mutations remain conservative dispatched operations. Opening automation is queued immediately. The 250 ms safety stop remains unchanged.
- Transport eligibility is compiled in linear passes, not rescanned for every event.
- Deck reverb shares deterministic immutable impulses by sample rate (four cached rates maximum), avoiding repeated generation/allocation per deck.
- Native progressive separation no longer restores muted material at unprepared positions or fades. Unity retains the original; with cuts, unavailable coverage fades the deck to silence. Cancellation/failure preserves bounded preview windows and cuts. This is safer, NOT seamless instant separation.
- Added an isolated real-browser audio runner and an exact-source release gate. The gate hashes source before/after validation, preserves step logs, refuses a changing source tree, and emits a build manifest only after software checks pass. It deliberately never claims hardware/release approval.
- Existing web CI now bounds test concurrency and includes generated loudness/tempo qualification. The new browser runner was executed locally; it is not yet provisioned as a browser CI job.

## Verified final web snapshot

Source SHA-256: `96ca0a553a0e3598e7bf53a5d5a24415f6ca8a8b7dfce20524625b637928b57b`.
Git base: `a668c938d5ac589cefa51edd2208bb3aab1d30f6` plus local changes. The worktree was unchanged during the gate.

- **589/589 tests in 93 files**, single worker, 154.16 seconds. This is the full website repository suite, not 589 audio-only tests.
- TypeScript, production build and prerender passed. Targeted ESLint and repository whitespace checks passed separately.
- **300/300 generated metering assertions**, **7/7 generated tempo fixtures**. Not certification or musical-corpus qualification.
- **8/8 real-browser fixture groups passed**: input PCM, input capture/recovery, two-deck sync, master processing, rack DSP/export, arrangement, metering/tempo workers, replay/recording recovery.
- Replay print completed with **0 events >25 ms late**, worst **10.7 ms**, followed by a passing **60-second audio-clock recording/recovery soak** with generated control/UI work. This supersedes the earlier failure for this fixture, not all possible effect histories or contention levels.
- Dense arranger checks include 24 tracks/960 clips sharing one source. They are not a 960-unique-source RAM qualification.

Logs: `/tmp/stemdeck-release-20260923/`; final build identity: `dist/release-manifest.json`.
Reproduce with `npm run test:studio-release`, setting `STUDIO_QA_ORIGIN`, `PLAYWRIGHT_MODULE` and optionally `CHROMIUM_EXECUTABLE` for an isolated local QA server and installed Playwright runtime. Without an audio origin, the report explicitly marks audio unchecked.

The first broad run was not accepted: two UI timeouts and two replay regressions against a module loaded before the edits. Fresh targeted runs passed, followed by the complete unchanged-snapshot run above. An earlier browser batch timed out during active development; only the final unchanged-snapshot batch counts as the combined pass.

## Native evidence and failure

- Rebuilt `StemDeckContractSuite` and the universal standalone in the existing configured Release build directory. **41/41 contracts passed together**, 68.33 seconds. This was not a clean-machine/fresh-directory build.
- New StemFx regressions verify drum/all-stem cuts outside coverage, key-lock and normal paths, and edge-fade mute safety.
- Updated standalone passed model, native helper, dependent-library and ad-hoc signature checks.
- A separate paced **120-second native recording/churn soak FAILED**: 6 aggregate dropped-buffer/deadline counter increments; callback p50 0.332 ms, p99 2.892 ms, max 26.997 ms against a 10.667 ms budget. No audio-thread allocation/deallocation, silent blocks or non-finite output. Heavy host load is context, not a passing result.
- The paced harness runs on an ordinary test thread, not an actual device callback. Independent callback-overrun counting was added for follow-up diagnosis without weakening any failure condition.
- A second 120-second run, without the browser/build workload, **also failed**: 6 aggregate increments and 6 independently measured callback overruns; p50 0.699 ms, p99 4.933 ms, max 15.184 ms. No allocations/deallocations, silence or non-finite samples. Matching counts implicate callback timing rather than proving a recording-queue overflow. They do not distinguish DSP execution from OS preemption. The failure is repeatable and remains a release blocker; no threshold was loosened.

## Delivery

Local candidate ZIP: `/Users/lillypad/Downloads/StemDeck-candidate-42bfl7/StemDeck-candidate.zip`.

ZIP SHA-256: `ae8cf58284ed49a0a40bbef14afaf08b3757a7c03759fb7ff0d7c88a8d680325`.
App executable SHA-256: `1ab1b3b1d2c0dc30677d5c9d54f6e1ecfb1d9d8cce2f8d634493ec218c8e2d32`.

This is a local test candidate, not a signed/notarized production release. Access to `/Applications/Sattari StemDeck.app` was denied; the installed copy was not inspected or replaced. The public website was not deployed. No commit or push was made. Other worktree changes were preserved.

The candidate ZIP's compressed-data integrity check passed. The additional native timing diagnostics affect only the test executable, not the packaged app.

## Still open — the five original gates

1. Replay fixture now passes, but native paced stress has an unresolved counter failure. Repeated contention/hardware qualification is still required.
2. Safe fallback is fixed; the old slow model/runtime, multi-deck fairness and seamless instant separation are not solved.
3. Exact all-effects editable replay remains incomplete: pre-roll DSP history, grain phase, topology changes and several immediate setters still depend on the printed reference. Lost historical state cannot be reconstructed retroactively.
4. Real-interface 30/60/120-minute sessions, physical loopback latency, disconnect/reconnect and musical listening still require the selected hardware, cabling and user confirmation. No physical microphone was opened in this pass.
5. Local builds now have reproducible software evidence, but the installed desktop app and deployed website are not updated/qualified together. Clean-machine installation and signed distribution remain open.

Also open: shared browser/native plugin hosting, real-song beat/key quality and mode-aware matching, metering/limiter certification, and broad musical usability acceptance. No 10/10 or professional-release parity claim is supported by these results.
