# Release-candidate hardening — September 25

Status: **release blocked**, not a full production release.
No deployment, native installation, release tag, or signing is implied by a local
passing test. This document supersedes older current-status summaries, not their
historical failure evidence.

## Changes in this pass

- Fixed-source replay now compiles deck pitch, key lock, per-stem pitch and
  confirmed playback-rate history into future audio-clock commands. Public deck
  state follows audible time. Source replacement and unsupported graph mutations
  remain explicitly dispatched; they are not certified sample-deterministic.
- Added rendered comparisons at 44.1/48 kHz for combined pitch/key-lock/stem/rate
  edits, including commands delivered only 80 ms ahead. The isolated two-minute
  four-stereo-stem test passed with zero underruns or late controls. Largest error
  in the new pitch cases was 1.49e-8 against an unchanged 0.0001 tolerance.
- Added an exact-artifact hash over sorted paths, sizes and file bytes. Deployment
  verification rejects changed, added or removed files, symlinks, failed gates
  and commit mismatches. A passing software gate does not set release approval.
- CI now runs the same complete gate, including the mandatory two-minute soak,
  on Node 20.19.0 and 22.x. It retains qualification logs and deploys the exact
  verified artifact instead of rebuilding. Remote CI has not run in this pass.
- Replaced Node-22-only test promise helpers. Library hashing now passes a byte
  view to WebCrypto, preserving hash bytes while accepting FileReader buffers
  across execution contexts. Scoped expensive UI test queries without increasing
  timeout limits or removing workflow assertions.
- Updated React Router to 7.18.4 and Vitest/UI to 4.1.11, retaining Node 20 support.
  The post-update npm audit reports zero known vulnerabilities, down from five
  moderate findings. This is not a complete application security audit. CI now
  fails on moderate-or-higher dependency advisories. Gate reports include Node,
  platform, CPU count, total memory and per-step load/free-memory snapshots;
  those diagnostics never waive a failing test.

## Evidence

- `/tmp/stemdeck-pitch-compiled-soak/windowed-soak.json`: isolated pitch reference
  comparisons and 120-second synthetic compressed-audio replay passed.
- `/tmp/stemdeck-node20-all-tests.log`: retained failed initial compatibility run.
- `/tmp/stemdeck-node20-recheck.log`: library failures resolved; one unrelated UI
  query timeout remained, prompting scoped semantic queries.
- `/tmp/stemdeck-release-node20-final/`: all 719 tests / 112 files passed on Node
  20.19.0, followed by static checks and the production build. Browser validation
  then failed a replay scheduling deadline (73.7 ms) and live source preparation.
  At inspection, the machine's load averages were 83.07 / 33.81 / 16.45, with
  unrelated compilation and audio applications running. This is a real failed
  run, not a waiver. The 50 ms grain deadline and source-memory limits remain
  unchanged; later isolated passes cannot establish overload immunity.
- Dependency migration required constructable Stripe/Resend test mocks and the
  React Router 7 `StaticRouter` import. The repaired focused run passed 162 tests
  (piano roll plus server workflows). The separate Node 20 server-only rerun
  passed all 149 tests, using Node rather than a simulated browser. Build and
  prerender passed, including all 66 routes. The audit has zero known findings.
- `/tmp/stemdeck-release-hardened-final/`: final gate of the updated dependencies
  completed with **703 tests passed, 16 timed out** across 112 test files. All 16
  reported failures were wall-clock timeouts: 15 UI workflows (5 seconds each)
  and the accelerated capture model (30 seconds). No timeout was waived and no
  passing manifest was written. Audio/build stages were not rerun by that final
  gate after the unit failure; earlier targeted passes do not change its status.
  The 5-second test timeouts were not increased. Available disk space dropped
  below 9 GiB while other work continued; no fresh native build was attempted.
  The host subsequently reported about 15,144 MiB of swap in use on a 24 GiB
  machine. This supports investigating system pressure before interpreting
  elapsed test times as an application-only performance measurement.
- Final gate completed at `2026-09-26T02:06:35.659Z` on Node 22.23.2. Source was
  unchanged during the run: `aa541f09215773b99554460d1d262c784ab053fcc33ce7d785c42483f40f6554`.
  `softwarePassed` and `releaseApproved` are both false. The missing artifact
  identity is intentional: the failed snapshot is not a qualified release.

## Next controlled run

Pause competing builds/audio applications and restore disk headroom first.
Then run `npm run test:studio-release` with a new `STUDIO_GATE_OUTPUT` directory.
The existing deadline and memory assertions stay in place. Reproduce and fix
any audio failure that persists under the declared supported operating load;
do not use a passing rerun to erase the overloaded-run evidence. No competing
application was closed and no user build directory was deleted by this pass.

## External release blockers

1. Native signing preflight found a Developer ID Application identity, but no
   Developer ID Installer identity or usable default `sattari-notary` profile.
   An OpenAI API key cannot satisfy either requirement. Do not put secrets in
   source files, browser bundles, reports or chat messages.
2. Physical recording needs a named interface/controller, monitoring topology,
   rights-cleared music and explicit permission to capture input. Generated
   audio, accelerated two-hour models and browser tests do not substitute for
   long real-time hardware sessions, reconnect tests or listening.
3. Clean-machine macOS install/upgrade, real Safari/iOS/Android testing and remote
   CI execution remain separate gates. Current disk space is about 13 GiB;
   old build folders have not been deleted to make room.

## Unfinished engineering, not user-testing obligations

- Complete audio-clock replay of source/routing/FX topology changes and opening
  DSP state, plus complete event-to-editable-arrangement conversion.
- Authenticated, scoped native AU/VST hosting through the shared browser UI.
  The browser rack is web DSP plus native inventory, not native plugin hosting.
- Real-music quality qualification for separation, beat/key detection and
  variable-tempo sync; independent loudness/limiter qualification.

Printed takes remain the safety reference. Do not advertise exhaustive exact
replay, universal plugin support, certified metering or a completed full release.
