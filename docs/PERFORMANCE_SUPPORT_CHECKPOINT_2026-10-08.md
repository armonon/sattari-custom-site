# StemDeck source/action support checkpoint — 2026-10-08 UTC

This is an implementation inventory and scoped numeric regression checkpoint,
not a musical workflow, rendered PCM, browser storage, native or release qualification.
Audited production-source baseline: `6bad0edaf198d80d44c9aa02c3e65970fe7d9148`.
No production code changes in this checkpoint. All 20 action families remain unqualified.

## Five-stage inventory

Generated from `node scripts/report-performance-support.mjs --json`.
PARTIAL means a path exists but full stage-specific parity is not proven.
PRINTED ONLY must retain the authoritative print. UNSUPPORTED does not deny
authored arrangement capabilities; it describes the captured-history lifecycle.

| Action | Capture | Replay | Arrange | Reopen | Export |
| --- | --- | --- | --- | --- | --- |
| Deck launch / stop / cue / seek | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Source replacement / removal | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Loop / loop length | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Tempo / playback rate | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Beat sync / project tempo / tempo-map follow | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Deck / stem pitch and key lock | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Deck gain / fader / crossfader | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Stem gain / mute / solo | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Deck EQ | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Deck filter | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Deck / stem FX parameters | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Mixer sends / returns / channel inserts | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Master processing / devices / output level | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Pad trigger / gain | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Input gain / effects | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Input monitoring / connection | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| MIDI notes | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Pan | UNSUPPORTED | UNSUPPORTED | PARTIAL | PARTIAL | PARTIAL |
| Output / cue / input routing | PARTIAL | PARTIAL | PRINTED ONLY | PARTIAL | PRINTED ONLY |
| Arrangement device automation | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL |

## Mixer regression subset

`src/utils/performanceReplay.mixerMatrix.test.js` checks deck gain, fader,
crossfader position, side and curve in Smooth/Linear/Sharp starting configurations.
An independent numeric formula checks future replay mixer targets against reconstructed
combined volume targets, including synthetic scheduled audible-clock timestamps and no-op curve changes.
JSON save/reopen preserves original captures/events, authoritative safety print,
dry source intervals and muted reconstructed tracks. This is serialization, NOT
real IndexedDB/browser restart or sonic/export verification.

Baseline: 68 tests in nine files. Candidate: 71 tests in ten files; targeted ESLint
and `git diff --check` pass. Build/full unit/native/browser/long-session gates are
not rerun for this test/docs-only checkpoint. Prior evidence retains its original SHA.

Run with Node 22:

```sh
node node_modules/vitest/vitest.mjs run src/utils/performanceReplay.mixerMatrix.test.js
node scripts/report-performance-support.mjs --json
```

## Remaining work

Select one musical action-family fixture and verify actual capture, replay PCM,
editable arrangement render, real process-close/reopen and independent exported WAV.
Keep original events and print; compare after safety fades/ramp boundaries, record
source SHA, fixture hashes and stage-specific results. Do not promote this inventory
or numeric tests to PASS cells.

Sparse checkout was used because a complete duplicate checkout exceeded available disk.
No excluded app, retail/media asset, shared dependency or production file was removed.
Mandatory disk/hosted-CI/downstack/native/physical/provenance gates remain intact.
No merge, deployment or product-completion claim.
