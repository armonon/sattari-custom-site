# Session Integrity — stable-candidate protocol

Feature work is frozen. This is a qualification candidate, not release approval.

## Snapshot ownership

The candidate is a separate local Git commit/branch and detached checkout.
The shared working folder and its index/branch are preserved. Unfinished general
website work (homepage/About/navigation/Hub/SEO) is excluded from this candidate;
those paths retain the existing base commit's versions. StemDeck, audio utilities,
dependency lockfile, regression infrastructure and related server tests are
included. Do not deploy this candidate as an update of the entire public site.

Create the candidate using a separate Git index, not by staging another task's
unfinished website work. Inspect the candidate diff before committing. Install
dependencies with `npm ci` in its checkout. No shared node_modules symlink.

## Reproducible automated gate

From the **clean candidate checkout**, with a report directory outside it:

```
STUDIO_GATE_OUTPUT=/absolute/evidence/directory node scripts/studio-release-gate.mjs
```

The gate records commit SHA, source and lockfile SHA-256, config hashes,
Chromium executable version/hash/revision, Playwright version, OS/Node/CPU/memory,
disk headroom, per-stage results, and the exact built-tree digest. Browser checks
use the recorded executable and the candidate's own Playwright installation.
The deploy-artifact verifier checks the same bytes, not a second build.

The tree must be clean before and after and the commit/source fingerprint must
remain unchanged. Timeouts and missing stages fail. Do not edit during the run.
Preserve failed reports before changing code; a fix requires a new candidate SHA.
Do not amend a tested candidate. Never deploy merely because automated checks pass.

## Required evidence, not just targeted tests

- Entire candidate unit/component/server suite, lint and types.
- All browser-audio groups (currently 13), including source windows, replay,
  pitch/tempo/loops, actual DSP effects, input processing, sync, master behavior,
  reconstruction, reopening, export and recording recovery.
- Built-artifact layout/export checks at 1440/615/390 px.
- 120-second synthetic audio-clock recording/replay under UI load.
- Synthetic metering/tempo qualification with explicit exclusions.
- Built `performance-support.json` containing the commit-bound five-stage matrix.

Representative hard assertions include unchanged PCM hashes across reference
reload; master export PCM error < 2e-6; live/export trim/EQ/FX checks; pitch/window
oracle comparisons at 44.1/48 kHz; input mute/monitor/gain alignment; source
replacement while a seek is preparing; rapid alternating seek completion races;
and future-launch preparation without starving current read-ahead. See test files
and browser logs for individual tolerances. These subsets do not prove every
arbitrary DSP graph or hardware lifecycle.

## Support matrix

Each release-artifact cell is exactly PASS, PARTIAL, PRINTED ONLY or UNSUPPORTED.
Existing implementation without complete stage-specific evidence remains PARTIAL.
There are no fully qualified actions yet. Replay controls do not imply ordinary
editable arrangement devices. Every future PASS needs a stage evidence reference.
Original prints remain authoritative for processing not reconstructed exactly.

## Physical acceptance and storage

Do not start without two rights-cleared full-length songs, named interface and
input, monitoring/cue topology and recording permission. Validate the reference
workflow first, then 30/60/120-minute sessions. Native hosting is a separate scope.

Run the disk preflight against the actual capture volume before each session:

```
node scripts/recording-preflight.mjs /capture/volume --minutes 30 --channels 12
node scripts/recording-preflight.mjs /capture/volume --minutes 60 --channels 12
node scripts/recording-preflight.mjs /capture/volume --minutes 120 --channels 12
```

Channels means total recorded channels, including master, stems and input. Budget
uses 48 kHz float PCM, three copies (capture/recovery/export) plus 5 GiB untouched
headroom. Use the actual topology; do not reduce it merely to pass. Recheck browser
storage quota separately: OS free space is not an IndexedDB quota reservation.
Failure or missing telemetry must prevent the run before recording begins.

September 25 cleanup: npm cache verification garbage-collected 10,537,081,763 bytes
of obsolete downloadable packages. Projects, recordings and evidence were not
deleted. Approximately 15 GiB remained, still insufficient for the conservative
12-channel 30-minute budget (~17.8 GB); longer sessions need more disk capacity.

## Approval boundary

The full milestone remains blocked until real songs, physical I/O, capture,
ordinary editable reconstruction, save/close/reopen, master/stem export, the
duration ladder and recovery show no unexplained timing/data loss. Baseline scores
remain unchanged. Do not deepen sequencing or polish mobile before this workflow.
