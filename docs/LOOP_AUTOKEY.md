# Loop: Sattari AutoKey and Auto Pitch integration

Loop uses the native suite's signal-processing design and pinned monophonic neural pitch model. This is local browser inference, not a call to an API key or a native plugin bridge. The native repository is unchanged.

## Engine provenance

`src/loop/autoKey.js` ports `core/include/sattari_audio_core/SattariSongKeyEstimator.h` from `/Users/lillypad/Projects/sattari-plugins-main` (repository HEAD `32b7c09155f8a2bd949c60a9c68ce55448ad0309` when inspected; source-file SHA-256 `3a5077177165801c619790a498b3d39db7cd2ae0c447ff5fd02793e20af6d0bf`). It preserves rounded box resampling to 16 kHz, 4096-point area-normalized Hann frames, peak interpolation, local whitening, harmonic PCP accumulation, peak-relative gating and the native balanced major/minor profiles. The browser uses a JavaScript FFT instead of JUCE. Section decisions cover approximately 15 seconds; weighted disagreement can flag a possible key change.

The native margin is winner correlation minus runner-up correlation. It is not calibrated confidence or a probability of correctness. Loop reports an alternative and labels sparse/short/low-margin material tentative or insufficient. The additional UI gate uses at least five represented pitch classes, four seconds of audio and a margin of 0.08 for “Suggested key.” These are conservative presentation rules, not a newly measured accuracy threshold. Manual key selection changes the guide metadata; it does not transpose audio or coerce detected pitches into a scale.

`src/loop/neuralPitch.js` uses the native `SattariCrepePitch.h` per-frame normalization and local ±4-bin salience decoder. The bundled `public/models/loop/crepe-tiny.onnx` is the exact Auto Pitch model, SHA-256 `027006c98e649e4bd9c795fb84cb4df6f23d8a7a54255f38789c68e85b56bd60`. The original [CREPE project](https://github.com/marl/crepe) is MIT licensed; the license ships beside the model. The native model record pins upstream weights commit `bb29b8d99a89924476d112d27ed470e4ac5617c0`.

Browser inference uses ONNX Runtime WASM in the analysis worker, batches of 32 centered 64 ms frames at a 20 ms hop, salience threshold 0.75, a one-frame median filter, a separate signal-energy gate, and attack-based splitting for repeated pitches. Events must last at least 75 ms and four frames and map to standard guitar MIDI 40–84. This differs from the native causal streaming wrapper: it is an offline lesson-building adapter, not a port of live Auto Pitch correction. Inference tensors and sessions are released. Model bytes are verified before use. On model/inference failure, the existing YIN transcription runs and the review explicitly labels the fallback.

## Guided import and preparation

Selecting a file stages it without starting analysis. The learner chooses solo guitar or full-band preparation, then presses **Build my practice guide**.

Solo recordings go directly to note analysis. Full-band recordings use the existing `StemSeparatorClient` and its verified four-stem Demucs model to produce the `other` / Instruments stem. This reduces vocals, bass and drums; it is **not guitar-only isolation**. The UI explains the first-use 172 MB model download and longer processing before starting. Failure does not silently substitute full-mix transcription.

The original mix supplies global key and tempo. The prepared stem supplies melody/chord estimates. Original and prepared blobs remain distinct, preserve a shared timeline, and save together in IndexedDB. A/B controls in the overview and studio choose the practice playback source. Edits retain the prepared blob. Stereo phase cancellation is detected before downmixing. Cancel, unmount and replacement imports abort separation and terminate workers; stale decode, preparation and analysis results cannot replace the current lesson. An idle analysis worker times out after two minutes without progress.

The existing review gate remains required for imports. Chord analysis still estimates major/minor triads on a coarse temporal grid; the neural pitch model does not generate polyphonic guitar tabs. Live microphone feedback continues to use the low-latency YIN and onset path, not offline CREPE.

## Reproducible evidence

Run from `site/`:

```sh
node scripts/qualify-loop-analysis.mjs
LOOP_NATIVE_KEY_RENDER=/absolute/path/to/SongKeyRender node scripts/qualify-loop-analysis.mjs
npx vitest run src/loop src/pages/LoopPracticePage.test.jsx --pool=threads --maxWorkers=1
```

The qualification script checks the actual pinned ONNX model through the same `transcribeNeural` function used in production, not a mocked predictor. It writes expected/detected events, onset errors, wall times and native comparison records to `.local-data/loop-analysis/qualification.json`.

On 2026-09-29, all 48 synthesized major/minor progression cases (24 keys at 44.1 and 48 kHz) agreed with the native production file analyzer on primary key, alternative key and margin within the native CLI's three-decimal precision. A separate synthesized Ode to Joy recording also reproduced the native ambiguous D minor / A minor result with margin 0.003, demonstrating why the UI must not present every top-ranked key as certain.

These fixtures establish adapter parity and deterministic signal behavior, not held-out music accuracy. The native repository's historical 57.6% exact-key score on its combined 1337-track corpus is **not** a Loop performance claim. Real guitar recordings, distorted/polyphonic passages, actual room/microphone conditions and user learning outcomes remain separate qualification requirements. Do not assign a “10/10” rating from passing these tests alone.

The actual pinned neural model passed all seven deterministic pitch scenarios on the same date: open strings/fretted notes with a stronger second harmonic (9/9), quiet plucks (9/9), plucks with seeded background noise (9/9), a 200 ms-spaced riff (8/8), repeated ringing notes (4/4), silence (zero notes) and unpitched noise (zero notes). Maximum onset error was 40 ms in these fixtures. These are 39 synthesized expected events, not 39 human performances. Wall times in the saved report were measured on a heavily loaded development Mac and are not a product performance benchmark.

The actual browser upload flow was also exercised with the generated `QA-guitar.wav`: full-band preparation ran on GPU, returned the Instruments stem, completed AutoKey/Auto Pitch analysis and exposed A/B playback. The stem omitted the fixture's three low guitar notes; rebuilding from the original restored all nine. This directly motivated the low-note warning and the **Rebuild from the original recording** recovery control. Review unlocked practice, and the imported guide reached microphone setup without granting capture or recording a performance score. The import and review layouts were inspected at desktop size and 390 × 844. The browser reported no runtime errors in this walkthrough.

The focused suite passed 151 tests across runs. Heavy host load caused four test workers to time out during startup; those files were rerun successfully. A UI assertion that assumed whitespace in an accessible filename was corrected and the five page tests rerun successfully. Lint, type checking and production bundling are separate checks; synthetic model qualification must remain separate from microphone hardware validation.
# September 29 addition

Loop now offers an optional polyphonic chord-tone draft and a guided string-by-string chord workshop. AutoKey and Auto Pitch remain the key and melody engines described below. See [LOOP_POLYPHONIC.md](./LOOP_POLYPHONIC.md) for the additional model, measured real-recording results, exports, and limitations.
