# Browser arranger upgrade

Later implementation work and its separate, incomplete validation status are tracked in [the completion checkpoint](./ARRANGER_COMPLETION_CHECKPOINT_2026-09-21.md). The green results below describe the preceding frozen snapshot, not the newer recording/MIDI/loop changes.

Scope: Sattari Studio browser application in this repository. Native StemDeck is unchanged. No deployment is included.

## Implemented

- Independent audio/instrument tracks, with multiple and overlapping clips; no four-deck arrangement cap.
- Shared audio-clock scheduler for playback and offline rendering. Every source has an explicit stop time. Seeking reschedules active and future clips; UI refresh does not drive audio events.
- Absolute-time clip placement, source offsets, non-destructive split/duplicate/delete, undo/redo, track mute/solo, gain/pan, clip fades and volume/pan/low-pass automation. Splits preserve source offsets, automation boundaries and fade curves.
- A BPM-aware 4/4 bar ruler, selectable 1/4–1/32 snap, fit-to-project zoom, follow-playhead and keyboard seeking. Grid lines thin by musical subdivisions at low zoom instead of drifting away from the ruler.
- Pointer-based clip moving and edge trimming, including cross-track moves. Overlapping clips occupy separate visible rows. Trimmed and split waveforms display the source region, rather than repeating the whole-song overview.
- Multi-clip selection, relative copy/cut/paste, batch deletion and undo/redo shortcuts. Track renaming, colors, duplicate/delete/reordering, offline mode and source relinking. Multi-selection does not yet support group dragging.
- Live track gain, pan, mute and solo changes do not restart playback. Structural clip and automation changes still pause transport.
- Polyphonic built-in triangle/sine instrument clips. Piano-roll edits audition notes through the master chain and are included in playback and export. Multi-bar note pages, octave selection, note lengths/velocity, drag/resize, quantization and precise numeric editing replace the fixed one-bar sketch. New MIDI clips follow project tempo; existing clips can opt into beat-following timebase.
- Graphical clip volume/pan/filter automation with draggable points, keyboard point editing and a numeric fallback. Filter curves use a logarithmic display scale.
- Completed recordings automatically become editable printed-audio tracks. Older saved takes can be added from the Recorded takes section. Control events and the initial performance state are retained with new takes.
- Printed reference takes bypass a second pass through master EQ/dynamics, but follow the master output level. Automatic recording import avoids activating a reference mix over existing active source lanes; previously added reference takes are muted when another is added. Reference lanes remain clearly separate from dry-source multitrack recording.
- 48 kHz/24-bit PCM stereo mixdown with master processing; aligned pre-master track-stem WAVs in a single ZIP. Export a selected time range, or the selected clip's range, with a custom filename. No individual stem normalization. Master compression/limiting means summed stems need not null against a mastered mixdown.
- WAV encoding and ZIP packaging use a worker. Missing assets, invalid trims, non-finite samples, clipping and oversized offline allocations produce errors instead of silently exporting incomplete audio.
- Portable project v5; legacy v2–v4 import; local v2-to-v3 session migration. New arrangement data is validated before project replacement. Existing source audio is not destructively edited.
- Library rows have an Arrange action independent of empty deck availability. It imports stored audio directly into an arrangement track.
- Autosave checks for an intervening session write from another tab and refuses to overwrite it, with a reload/save-backup message. This is optimistic conflict detection, not an atomic cross-tab lock or version-history recovery system.
- Reduced toolbar clutter, collapsed automation details, track options, compact desktop layout, 44px mobile buttons and a collapsible small-screen timeline/export tool group. Cached waveform geometry and live mixer updates avoid unnecessary waveform-data cloning.

## Important boundaries

- Performance events are a timestamped control log, not sample-accurate reconstruction of unprinted live FX or a separate recording of every input. The printed take preserves the actual performed sound.
- Copy deck audio copies source clips and supported edit data, not the live deck FX graph. Record a take to preserve that sound.
- Instruments are built-in synth voices, not third-party instrument hosting, MIDI-device recording or MIDI-file import. The piano roll shows one selectable octave and up to 32 time steps per page; it is not a continuous 88-key editor. New beat-following MIDI retimes when BPM changes; audio remains in absolute seconds without time-stretching.
- Structural edits pause arrangement transport; track mixer changes stay live. No range looping, tempo map, warp markers, comping, or streaming long-file engine is claimed.
- Offline renders and stem archives have 512 MB allocation guards. Decoded audio remains browser-memory dependent; long-set and mobile memory profiling are still required.
- Waveforms use stored peak overviews, not a multiresolution sample-accurate peak cache. Manual take insertion is an explicit layer operation; verify mute/solo when mixing references with source tracks.
- Preview audition is not an external DJ headphone bus. Monitor mute/dim remain speaker-only; exports are program audio.

## Verification workflow

Run unit/component contracts with one worker:

```sh
npm test -- --maxWorkers=1 --testTimeout=120000
npm run type-check
npm run build
```

For actual Web Audio/codec verification, run the Vite development server on a separate origin and open `/scripts/arrangement-browser-qa.html`. Its Run button uses synthetic tones only, muted speakers, and temporary test-origin assets. It checks real PCM timing, split/fade continuity, seek scheduling, polyphonic MIDI output, master gain, WAV/ZIP structure, six aligned stems, recorded audio/control events, printed-reference routing, rebased range exports and uninterrupted live mixer changes. The page is not included in the production build.

Hand check: import five songs, add multiple clips to one track, split in a fade, seek into a gap, switch workspaces during playback, add instrument notes, record a short performance, edit the resulting take, save/reopen a portable project, and compare mixdown/stem exports in another DAW.

## Remaining roadmap — not implemented in this pass

- Synchronized separate-source recording, dry/wet lanes and sample-accurate editable reconstruction of live FX/performance events.
- Overdub/punch recording, take lanes and region comping.
- Transport loop regions, locators and uninterrupted structural editing.
- MIDI import/device recording, richer instruments, track effects, sends/buses and plugin automation.
- Bounded-memory decoding/scheduling/rendering for complete long sets; range export is only a workaround, not removal of the 512 MB render guard.
- True multi-tab ownership, snapshot recovery, crash/device-disconnect scenarios, complete touch-device/accessibility testing and release-load profiling.

## Verification status

All ten actual-browser audio checks passed on the isolated development origin, including the three additional reference-routing, range-export and live-mixer tests. The actual UI was inspected at normal desktop size and 390 × 844. Narrow-screen clip dragging moved the selected clip from 0 to 2 seconds; the tools disclosure exposed editing/export controls; the document had no page-wide horizontal overflow. This is responsive desktop-browser testing, not physical mobile-device certification.

The final frozen-code run passed **325 tests across 42 files**, followed by the TypeScript check, production build, targeted ESLint checks and `git diff --check`. The suite ran with one worker and took 353.81 seconds on the heavily loaded machine; that duration is not a release-performance benchmark. An earlier intermediate run had a Learn-page timeout and loaded an outdated cached module while files were still changing; both passed in the complete frozen-code rerun.

No production deployment, commit, push or native-app update was performed. The user's existing preview session was not reloaded or replaced. The isolated QA tabs/server were closed and the temporary viewport override was reset.
