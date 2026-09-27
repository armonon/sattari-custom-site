# Arranger completion checkpoint

Scope: local Sattari Studio browser code. No deployment, commit, push, or native desktop update.

## Added in this pass

- Audio-clock loop regions with ahead-of-time cycle scheduling, bounded graph cleanup, live mixer updates and an explicit error if scheduling falls behind. Loop setup and named project locators are under **Loop, locators & MIDI recording**. Loop enable/range are currently session UI state; named locators persist in the project.
- Standard MIDI format 0/1 PPQ file import, including running status, polyphony, note lengths, velocity and sustain. MIDI follows the current project tempo. Tempo maps, instrument programs, pitch-bend and most controller automation are not imported. Files over 16 MB, SMPTE timing and files exceeding 100,000 note-ons are rejected explicitly.
- Web MIDI keyboard selection, live polyphonic monitoring, sustain-aware recording into new editable takes, all-notes-off and preservation of recorded notes when the selected input disconnects. Browser/device support and permission are required. Recording MIDI while loop mode is enabled is intentionally blocked rather than incorrectly flattening wrapped time.
- Region comping: select a source clip, open **Build a take comp**, choose a range and copy it into a comp lane. Only that range is replaced; other comp regions and original sources remain intact. Source gain/pan are retained; sources are muted and edits are undoable. Printed-reference and pre-master sources use separate comp lanes.
- Optional **Separate source lanes (preview)** recording. One AudioWorklet captures connected deck outputs, mic/input and pad outputs using a shared sample counter. Five-second float-WAV chunks preserve headroom and are saved to IndexedDB. Chunk boundaries have no added fades; source lanes are sample-aligned with one another. MediaRecorder master-reference alignment is based on audio-clock offsets, not a guarantee of codec phase alignment.
- Recoverable source manifests retain saved chunk references and timeline placement. Find them from the arranger's recovery control. A crash may lose the current unsaved chunk or outstanding storage writes; already committed chunks can be recovered. Recovery is not a complete session-history/transaction system.
- Source capture has a 64 MB pending-write budget and a two-chunk acknowledgment limit in the worklet, so an unresponsive main thread cannot build an unlimited message queue. It stops its own path with an error if storage falls behind. The master recorder continues independently. Source capture is off by default pending native-audio validation; standard master recording remains the default.

## Important limitations

- Deck effects are printed into source recordings, not reconstructed as editable live FX automation. Sources connected after the take starts are not added dynamically. This capture path does not separately record each arrangement track or every pre-FX stem.
- Imported/recovered source lanes are offline and muted so they do not accidentally double the master reference or decode every alternate source into RAM. Enable chosen lanes in Track options, or comp selected regions directly. Choose the source lanes and mute the reference deliberately when editing a reconstructed mix. Comping one stem does not automatically rebuild all other stems of a full mix.
- Loop scheduling uses a foreground look-ahead timer. Browser suspension or extreme event-loop stalls can interrupt it; the UI reports a stopped transport rather than silently drifting.
- Complete long-set streaming playback and bounded-memory offline export are NOT implemented. Existing decoded-audio memory constraints and 512 MB offline-render/archive guards still apply. Chunked source storage does not remove those limits.
- Automatic punch recording, full dry/wet multitrack reconstruction, richer instrument hosting, per-track effect/send buses, complete crash recovery and physical-device/mobile certification remain unfinished.

## Verification evidence

The new single-process diagnostic passed: comp-region preservation, MIDI file timing, sustain handling, malformed-file rejection, shared capture start clock, chunk rollover, stereo/mono capture and worklet backpressure shutdown. A separate Babel parser check passed for seven changed engine/UI files. These are logic and syntax checks, not a successful application build or native audio certification. The diagnostic exercises the actual model/parser/worklet source without starting test workers:

```sh
node --experimental-vm-modules scripts/check-arrangement-core.mjs
```

It does **not** replace browser audio testing. Added Vitest coverage covers MIDI import/capture, comping, loop scheduling, float-WAV headroom, capture persistence and MIDI-device disconnection. Added native-browser checks cover loop playback and actual AudioWorklet capture/decoding/recovery.

Full validation is pending. The machine reported a load average above 250; test-worker runs stalled and browser control timed out three times. Those runs were stopped, not counted as passes. The preceding pass's 325 tests and 10 browser checks are baseline evidence only and do not certify these new changes.

## Resume gates

1. Run the added unit/component tests, then the full suite on a responsive machine.
2. Run type-check, production build, targeted lint and whitespace checks against a frozen snapshot.
3. On an isolated development origin, run `/scripts/arrangement-browser-qa.html`; verify loop PCM and source-chunk continuity/decoding, not just a moving playhead.
4. Test a physical MIDI keyboard (pedal, retriggers, disconnect), mic/interface overdubbing with headphones, and source recovery after a forced close.
5. Record, comp, save/reopen and export a representative real set, checking peak levels and alignment in another DAW.
6. Keep separate-source capture labeled preview until those gates pass. Do not claim full release readiness or Ableton parity from this checkpoint.
