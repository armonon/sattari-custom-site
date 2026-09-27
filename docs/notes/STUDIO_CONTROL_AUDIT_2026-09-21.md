# Studio control audit — September 21, 2026

## Scope

Browser Studio (`/studio`), using the current local preview build. This is not certification of the separately installed native app, physical audio hardware, or every browser/device combination. Existing user changes were preserved; nothing was committed, deployed, or installed.

The Sites workflow was used to build and validate the existing browser application without redesigning it. Browser tests ran on a separate localhost origin (4188) with synthetic audio, leaving the user's loaded session on 4186 intact.

## Fixed in this pass

- Library collection buttons now switch between session tracks, separated stems, and recordings, with appropriate empty states.
- Track/stem rows open the selected deck; stem rows also select its Stems tools.
- Deck BPM is editable, committed on Enter/blur, and constrained to 40–240 BPM. Key lock and sync expose their pressed state.
- Add-source imports fill empty decks instead of silently replacing Deck A. A full four-source arranger explains its capacity instead of replacing the first track.
- Select exits Razor mode; arranger playback/recording labels reflect their action.
- Play All reports only decks actually started by the engine. Deck, global, pad, and AutoMix start failures now produce visible feedback. Pending transport starts are guarded against duplicate requests.
- AutoMix assigns its source/target to opposing crossfader sides, respects reversal, and stops its fade on pause/cue.
- Keyboard waveform seeking supports Left/Right, Home, and End. Pointer positions are clamped.
- New-track loading resets the loop start to match the engine. Failed stem batches no longer report unconditional success.
- Browser Slip is explicitly disabled because there is no slip-playback implementation. Fullscreen availability/failure is handled explicitly.
- A source-level regression guard requires each Studio button to have an action or explicit disabled state. This catches inert markup; it does not substitute for behavioral tests.

## Browser evidence

| Workflow | Result |
| --- | --- |
| Add source → Mic / Input / Track | Choices rendered; microphone safety/setup view and Escape dismissal checked without granting permissions |
| Import audio, then import again | Synthetic audio decoded into A, then B; A retained its edited 128 BPM while B retained its own analysis |
| Deck playback / seek | Play/Pause state changed; master stereo meters showed non-silent signal; keyboard seek exercised |
| Deck BPM | Edited 176 → 128 in the rebuilt app |
| Library collections | Session, empty stems, empty recordings, then saved recording collection checked |
| Recording and download | Actual downloaded AAC file decoded successfully: stereo, 48 kHz, 14.113 seconds, 134,619 bytes, peak −31 dBFS |
| Arrangement | Select/Razor switching, track inspector, clip removal, Undo restoration, automation editor, and arrangement playback checked |
| Master | Expansion, speaker mute, neutral audition (tone controls disabled), and restore defaults checked |
| AutoMix | Started two loaded decks without console errors |
| Portable project | Exported file contained two loaded decks, three embedded audio assets, and one recording; reimport reported all three assets and retained deck BPMs |

The in-app browser download-event waiter timed out, but the recording and project files appeared on disk. Their contents were checked directly; the timeout was not treated as proof of a failed download.

## Remaining limits / release gates

- Hardware microphone/interface permissions, monitoring feedback, MIDI controller behavior, actual speaker audibility, latency, and long-set stability require hands-on testing.
- Browser Slip playback remains unavailable, not implemented by this pass.
- The piano roll is still explicitly a pattern sketch, not audible MIDI playback; generated patterns are templates, not transcription.
- Browser arrangement currently supports four source tracks. This pass protects that limit rather than claiming unlimited DAW capability.
- Browser master metering is sampled peak/RMS, not LUFS or a certified true-peak ceiling.
- Automated handler coverage and passing tests do not establish that every possible musical workflow is flawless. Cross-browser/mobile and native app verification remain separate release gates.

## Validation

- Full web suite initially passed 257 tests before changes; the first post-fix full run passed 261 tests.
- After the occupied-track test was added, all 262 functional tests passed together. The new source guard initially failed because it was configured with a Node environment incompatible with the shared browser setup. That setup was corrected; the guard then passed independently and in the final rerun.
- Added behavioral regression coverage for Library navigation, BPM/keyboard seeking, playback errors, and occupied arranger tracks, plus the button-wiring source guard.
- Production build, TypeScript check, changed-code lint, and `git diff --check` passed.
- The last combined rerun was **not clean**: four page tests exceeded their 5–10 second deadlines (empty workspace, Replay editing, BPM/keyboard seeking, and occupied-track protection) while other CPU-heavy applications/builds were running. These assertions had passed in earlier runs, but contention is only a likely explanation, not proof. The redundant rerun was stopped to reduce load. A quiet-machine aggregate rerun remains a release gate; do not report this pass as a flawless 263/263 final run.
- Synthetic downloaded test artifacts were moved out of Downloads into `/tmp/stemdeck-20260920-fixtures/verified-take.m4a` and `verified-project.sattari`.
- Logs: `/tmp/stemdeck-controls-final-tests.log`; artifact validator: `scripts/verify-studio-recording.mjs`.
