# Master output insert rack

## Workflow

- Drag a built-in web effect (or a web starter chain in the Sattari suite browser) onto Master output. This copies a new instance; it does not move or remove a track insert.
- Alternatively open **Master FX** in the output strip and click an effect. This is also the touch/keyboard path.
- Up to eight master inserts, ordered processing, live parameter editing, bypass, removal, presets and project persistence. Software instruments remain on instrument tracks.
- Native AU/VST/CLAP binary drops display an explicit host-required message and never execute or upload the file.

## Signal path

Live sources → master level/tone → master inserts → existing compressor/limiter → recorded program bus → monitor-only controls → speakers.

Arrangement playback, keyboard audition and live inputs share the live engine's single program/master insert chain. Pausing the arranger never disposes the live program bus. Offline mixdown reconstructs the same DSP before its compressor/limiter. Printed reference lanes continue to bypass repeated master processing. Pre-master stem exports exclude master inserts. Full mixdown duration and section preroll account for track plus master effect tails; explicit range exports respect the requested end.

Rack topology swaps crossfade for 25 ms with bounded retired-node cleanup. This does not preserve old reverb/delay history when replacing/removing a device. Parameter edits retain the current graph. No native plugin host or plugin delay compensation is added by this change. The existing “Audition neutral” control still bypasses master tone only; inserts have independent bypass switches.

## Verification

- Final regression: 8 test files / 57 tests passed, exit 0. Includes master/rack UI, source drag payloads, rejected native/over-capacity drops, settings persistence, live/arrangement engine regressions and export-tail planning.
- Real browser: 14 audio checks passed. Covers shared live/arrangement master routing, master DSP, encoded tails, section continuity, unchanged pre-master stems and live graph replacement, plus the earlier track-rack tests. No speaker output.
- Verified an actual drag gesture increases the master insert count; an inserted effect survived reload on the isolated QA origin.
- Desktop and 390 × 844 phone layouts checked; viewport restored and QA tab closed.
- Focused ESLint and final production build passed (2,841 modules). An initial UI test exposed a missing optional `clips` guard on the master bus, fixed and rerun successfully.

Local changes only: not deployed, committed, or installed into the desktop application.
