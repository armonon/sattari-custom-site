# Loop guitar practice — first working version

Open `/loop` on the Vite dev server. The existing `/learn` page links to it.
The original lesson is immediately playable; no API key or account is required.

## What works

- Drag in an audio file, or select one in **Add a song**. Decoding and analysis stay in the browser. Imports are limited to 40 MB and eight minutes.
- Estimated tempo, key, per-bar major/minor chords, and monophonic note events run in a cancellable worker. Review estimates against the recording.
- Synchronized tablature, a fretboard guide, approximate guitar staff notation, and chord diagrams. Correct notes, chords, and practice tempo with the edit control.
- Pitch-preserving playback speed, phrase loops, seeking, individual note/chord reference tones, and printable/text practice sheets.
- Imported audio and edited lessons persist in IndexedDB on the current browser. Storage failure is reported; the current session remains usable.
- A 24-chord library with open and barre shapes, and a microphone tuner for standard guitar tuning.
- Microphone feedback compares absolute note pitch and tuning, rather than just membership in a key. “Wait for me” advances on a stable matching note while playback is paused. Permission is requested only after the user clicks. Cancellation, unmount, backgrounding and disconnected inputs release the microphone.

## Accuracy boundaries

This is a working DSP baseline, not a full-band AI transcription model. It works best on clear, single-note guitar. Dense recordings, distorted chords, bends, slides and fast phrases can be wrong or omitted. Staff rhythms are rounded to a small set of practice durations. Fingering is suggested, not inferred from a player's hands. Chords are estimated on a fixed bar grid using the estimated tempo; recordings with tempo changes or pickup bars need correction.

Live whole-chord recognition, timing/latency scoring, source separation, alternate tunings and cloud sync are not implemented. No fake chord or timing scores are displayed. The original demo's chord progression is suggested accompaniment; its WAV contains the melody.

The next audio milestone should compare a source-separation plus polyphonic transcription model against human-verified guitar parts, and preserve confidence and editable corrections in this same lesson format.

## Files and checks

`src/pages/LoopPracticePage.jsx` and its CSS own the workspace. `src/loop/` contains the lesson model, diagrams, audio analysis, microphone lifecycle, import worker and IndexedDB storage.

The original 32-note demo is generated deterministically by `node scripts/create-loop-demo.mjs`; it uses no third-party recording.

Run focused tests with `npx vitest run src/loop src/pages/LoopPracticePage.test.jsx --maxWorkers=1`. They cover pitch and octave detection, silence/noise rejection, repeated-note transcription, all 24 chord voicings, the shipped WAV, microphone permission/cancellation, import cancellation and guide editing.

The route is lazy loaded and included as a non-indexable prerender target. The existing storefront and learning workspace remain available.
