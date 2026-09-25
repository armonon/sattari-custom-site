# Arrangement devices — browser implementation

## Where it is

Arrange → **Effects rack**, or **Devices · N FX** on a track. The rack sits below the timeline and remains available without selecting a clip. The track selector targets audio or MIDI tracks, including empty tracks. Instrument source cards open the existing piano roll.

## Implemented

- Six built-in **web editions**: Sattari EQ (three bands), Comp, Echo, Space, Heat and Image. These use native Web Audio nodes and are not ports of the native suite's complete DSP or interfaces.
- One shared insert chain per track: overlapping clips feed the same nonlinear processing. Track level, mute, solo and master-stem group gain follow the rack, including its tails.
- Up to eight inserts per track, ordered processing, live parameter smoothing and bypass, remove/reorder, undo through the arrangement history, and project persistence. Structural rack edits pause transport deliberately; parameter/bypass edits do not restart it.
- Existing browser instruments can be added from the same browser. Instrument clips, auditioning and keyboard voices route through track effects.
- Mix, Create and Vocal **web starter chains**, not the full native rack products.
- Rack presets export/import as validated `sattari-web-rack-v1` JSON. Imported presets cannot introduce executable plugin code or arbitrary parameters.
- Full 48-product native catalog from the working copy of `/Users/lillypad/Projects/sattari-plugins-main/config/products.json` (repository HEAD at inspection: `32b7c09`). Products lacking a browser implementation are explicitly marked native-only, with no fake Load action.
- On disk: user-selected folders inventory AU/component, VST, VST3 and CLAP package names locally, deduplicating bundle contents. No plugin binary is executed, uploaded, or stored in a project. Removing an inventory item does not delete the installed plugin.
- Mixdowns and pre-master track stems include track effects. Full exports extend through calculated effect tails; explicit range exports keep the selected duration. Offline preroll grows beyond the previous 12-second baseline for long serial effect tails. Silence and preroll stay bounded by supported rack settings.

## Important remaining work

- **Native AU/VST/CLAP hosting is not implemented in the browser.** Select an architecture: connect the existing native StemDeck host, or build a paired local companion with explicit pairing, origin checks, process isolation, plugin scanning, state persistence, audio/MIDI transport, and offline rendering. Merely listing installed plugins is not hosting them.
- The complete Sattari native suite (Auto Pitch, Maqam, VoxSynth, Stack, Arp, etc.) has not been ported to WebAssembly or integrated through a host bridge. Its catalog is included, not its binaries.
- No third-party web-module code loader or arbitrary script execution is exposed.
- Rack-parameter automation, send/return buses, sidechain inputs and general plugin delay compensation remain separate DAW work. Browser node latency can differ between device chains. Seeking resets effect history; full-set exports reconstruct it with preroll.
- Avoid opening projects with effects in older application builds that ignore the optional `track.effects` field.

## Verification

`scripts/rack-browser-qa.html`: nine real-browser checks passed, covering audible processing/bypass for all six effects, shared track buses, mute/tail behavior, section/reference continuity (maximum sample difference below 0.001), and encoded export tails. No audio was sent to speakers.

UI checked at desktop and 390-pixel phone width. Fixed shrinking device cards in the scrollable browser. An isolated preview retained both inserted effects after a page reload.

Automated tests cover effect validation, project serialization/migration, tail duration, native package inventory, track selection, insertion, parameters, bypass, reorder, removal, instruments and explicit native-only catalog status.

- Production build passed (2,841 modules).
- Focused production-file ESLint check passed.
- Initial 12-file regression run: all 87 assertions passed, but Vitest exited with an internal worker `onTaskUpdate` timeout. This is not counted as a clean run.
- Serial threads-pool rerun: **12 files / 87 tests passed, exit 0, no unhandled errors**, without changing application code or suppressing unhandled errors. The loaded machine spent 677 seconds initializing test environments versus 32 seconds executing assertions; these durations are not audio-performance measurements.

This change is local; no production deployment, desktop installation, commit or push was requested in this turn.
