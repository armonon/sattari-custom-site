# Loop chord learning and polyphonic drafts

Implemented September 29, 2026. This is an experimental, editable transcription path alongside the existing AutoKey / Auto Pitch melody path. It now includes a bounded whole-chord check and overlapping-note notation. It is not a claim that arbitrary commercial mixes can be transcribed accurately, or that continuous live chord timing is graded.

## Learner flow

1. Choose an arranged starter song or a local recording.
2. For uploads, choose original guitar or instrumental preparation. Optionally select **Include chords & overlapping notes**. Analysis stays in the browser worker.
3. Review the melody and chord-tone guides separately. The latter retains overlapping pitches, groups nearby attacks within 120 ms, and suggests a fingering only when notes can occupy distinct strings within a four-fret span. It does not claim to identify the recorded string.
4. Correct, remove, or add chord tones. Changes recalculate the chord chart, save with the original recording, and invalidate previous review approval. They do not silently alter the melody line.
5. A recording with chords but no clear melody now leads directly to **Practice these chords**, after review. Other songs have a workshop in the Chord charts tab.
6. The chord workshop displays the full shape, highlights one string at a time, and checks absolute MIDI pitch within 35 cents for at least 180 ms. Manual exploration never earns microphone matches. Matches are saved separately from melody results and invalidated when the lesson changes.
7. Export the melody, chord chart, and chord-tone draft as text, or export overlapping note events as standard MIDI. Printing waits for all lazy-loaded staff notation before opening the print dialog.

After checking individual strings, **Try a whole chord check** connects and calibrates the microphone explicitly. The recorder loads before a three-count, captures 2.5 seconds, stops the microphone, and analyzes the take on-device. A shape is matched only when all expected absolute pitches overlap continuously for at least 120 ms without a detected pitch outside the chord's pitch classes. Higher octave harmonics are ignored as extras, but cannot fill a missing expected pitch. This does not measure cents, finger placement, buzzing, or rhythmic strum accuracy.

Results distinguish matched, not confirmed, too quiet, clipping and unavailable audio. An undetected note is not presented as proof that the learner played it wrong. Cancelling, leaving the tab, unmounting, or a disconnected microphone aborts the take and prevents late credit. Recording and worker operations have timeouts. Whole-shape matches have separate versioned progress, linked to the lesson fingerprint; manual steps cannot award them. Audio is neither uploaded nor saved.

The **Sheet music** tab now supports overlapping notes, and offers melody/chord-tone selection when both exist. Draft chord slices use per-pitch ties as other pitches enter or leave, preserve independent releases, cancel accidentals and split barlines. A repeated attack is not tied. The draft uses a sixteenth-note grid in assumed 4/4; it does not infer independent stem voices or the original score. Printed sheets include both melody and overlapping-note staves and wait for every engraving to finish.

Chord vocabulary: all twelve roots with major, minor, dominant seventh, major seventh, minor seventh, sus2, sus4 and power chords: 96 diagrammed shapes. Exact detected pitch-class sets determine names. Missing thirds, unsupported extensions, and ambiguous matches can produce abstentions. Missing pitches can also accidentally form another valid chord; the review step remains necessary. The displayed accompaniment diagram is a suggested standard shape, not a reproduction of the recorded voicing or inversion.

## Engine and provenance

- **AutoKey and Auto Pitch remain in use.** See `LOOP_AUTOKEY.md` for their native parity and monophonic qualification.
- Polyphonic model: Spotify Basic Pitch, upstream commit `fa5997af0a8210982619003269994a1be25eddf3`, `basic_pitch/saved_models/icassp_2022/nmp.onnx`.
- Local model: `public/models/loop/basic-pitch.onnx`, 230,444 bytes.
- SHA-256: `2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
- Copyright 2022 Spotify AB, Apache 2.0. License bundled at `public/models/loop/BASIC-PITCH-LICENSE.txt`.
- Primary sources: [model and implementation](https://github.com/spotify/basic-pitch/tree/fa5997af0a8210982619003269994a1be25eddf3), [upstream inference](https://github.com/spotify/basic-pitch/blob/fa5997af0a8210982619003269994a1be25eddf3/basic_pitch/inference.py).

The model uses 22,050 Hz mono audio, 43,844-sample windows and 30 frames of overlap. The browser's audio decoder supplies band-limited input at the target rate; each window discards 15 boundary frames on either side. Timestamps are mapped to the actual window start, avoiding accumulating stride errors. The decoder is Loop's conservative onset-plus-frame decoder, not upstream's full MIDI decoder: onset threshold 0.5, frame threshold 0.3, six active frames, at least 90 ms, eight quiet frames to close. MIDI range is 40–84. Independent notes retain independent endings; no key snapping is performed.

Sessions are released between melody and polyphonic inference. The worker fetches and verifies the model hash. Model failure is shown explicitly and falls back to the existing melody / basic triad guide, without labelling it polyphonic. No new runtime dependency was added.

## Real recording regression evidence

Run:

```sh
python3 scripts/fetch-loop-guitarset.py
node scripts/qualify-loop-polyphonic.mjs
```

The fetcher requests exact ZIP byte ranges from the published [GuitarSet 1.1.0 dataset](https://doi.org/10.5281/zenodo.3371780), validates ZIP CRCs and records SHA-256 provenance. Only local ignored `.local-data/loop-polyphonic/guitarset` receives the audio and labels. On macOS, `afconvert` resamples the benchmark audio to 22,050 Hz floating-point WAV.

Selection was fixed before inference: one track per player, alternating accompaniment and solo, alphabetically first matching track. This resulted in six performances of BN1-129-Eb, using the first 12 seconds of each. This is a narrow regression sample, not broad genre validation. GuitarSet is one of the model's training corpora; the training membership of these files is unknown. Do **not** call this a held-out benchmark. Note labels come from the published corpus and have not been independently verified by a human in this task.

Metric: maximum one-to-one matches with exact rounded MIDI and onset error at most 50 ms. Offsets, string/fret correctness, chord names and live microphone performance are not scored. No threshold tuning was performed against these references.

| Recording | Precision | Recall | Onset F1 |
| --- | ---: | ---: | ---: |
| 00_BN1-129-Eb_comp | 60.7% | 73.0% | 66.3% |
| 01_BN1-129-Eb_solo | 71.8% | 82.4% | 76.7% |
| 02_BN1-129-Eb_comp | 78.6% | 84.6% | 81.5% |
| 03_BN1-129-Eb_solo | 83.3% | 85.7% | 84.5% |
| 04_BN1-129-Eb_comp | 61.5% | 95.7% | 74.9% |
| 05_BN1-129-Eb_solo | 73.3% | 91.7% | 81.5% |
| **Pooled** | **69.0%** | **84.8%** | **76.1%** |

267 matches, 120 extra detections and 48 missed reference notes. The actual model also returned zero notes for silence. Full per-note evidence is in `.local-data/loop-polyphonic/qualification.json`. This evidence justifies an opt-in draft feature with correction tools, not automatic accuracy claims.

The synthetic browser fixture had 17 estimates for 15 intended notes, including an extra harmonic and a missing chord root. Removing the extra B4 through the UI restored a playable Em shape. The missing C root caused the Cmaj7 passage to look like Em: this is a concrete example of why exact pitch-class matching alone cannot establish chord correctness.

## Remaining limits

- Whole-chord feedback is an experimental short-take check, not continuous strum/rhythm scoring. The underlying model can miss pitches or mistake harmonics, so both false abstentions and false matches remain possible outside these fixtures.
- The overlapping-note score uses tied chord slices, not inferred independent rhythmic voices; estimated tempo, meter and note lengths still need review.
- No guarantee of guitar-only isolation, original fingering, alternate tunings, capo inference, bending/slide notation or full-band transcription accuracy.
- Physical guitar-to-microphone validation, independently labelled held-out performances, and more accurate polyphonic inference remain necessary before claiming a production-quality automatic teacher.

## Verification of this implementation

- Final suite: **266 tests in 16 files passed**, with two workers and a 60-second timeout for long DSP fixtures. An earlier run exposed the old triad-only test's assumptions about the expanded chord list, and a five-second timeout on an unchanged AutoKey modulation fixture. The final run includes the corrected triad test plus all 96 chord-type/shape tests, without changing the DSP algorithm to fit the test.
- Loop ESLint, TypeScript checking and the final production build/prerender passed.
- Actual in-app browser: the pinned polyphonic model ran on a generated chord WAV; chord tones and edits survived a reload; review approval reset after deleting an erroneous tone; a chord-only recording entered the workshop; manual steps earned zero microphone matches. No microphone permission was granted and no physical guitar performance was claimed.
- Tested the workshop at 390 × 844 and restored the viewport afterward. The focused workshop has its own header and compact mobile chord diagram.
- The browser generated a 172-byte MIDI file containing 16 note-on and 16 note-off events from the edited draft; the downloaded file was parsed and moved to ignored `.local-data/loop-polyphonic/browser-export.mid`. The browser tool's download event timed out, but the actual artifact was independently verified on disk.
- Removed the generated QA recording from the app's library. The preview is left on the arranged Ode to Joy chord guide. No deployment or commit was performed.

Logs: `.local-data/loop-polyphonic/tests-verified.log`, `lint-verified.log`, `types.log`, `build-verified.log`, `qualification.log` and `qualification.json`.

## Whole-chord and notation follow-up verification

- Latest Loop suite: **298 tests in 23 files passed**, including recorder preparation/cancellation/timeouts, exact PCM capture and silent output, conservative chord assessment, late-result protection, microphone lifecycle and independent note ties. Loop lint, TypeScript checking and the production build/prerender also passed. The full suite took 256 seconds under host load; test thresholds were not loosened.
- `node scripts/qualify-loop-strum.mjs` runs the real pinned Basic Pitch model on deterministic synthetic PCM. All five positive shapes (Em, Am, C, D, G) matched. Six negative checks (missing root, major/minor substitution, sequential strings, wrong bass, noise, silence) earned zero matches. This is a regression set, not an accuracy estimate.
- `node scripts/qualify-loop-strum-recordings.mjs` uses the existing three GuitarSet accompaniment recordings. It selects each recording's first labelled overlap of at least three distinct pitches lasting 150 ms, then processes a 2.5-second take. All three labelled targets matched; all three targets transposed up a semitone were rejected. The original four-pitch selection did not find an eligible event in one recording; the criterion was broadened to triads, without changing the model or scoring thresholds. These are reference voicings, not necessarily the app's standard diagram. Known training-corpus overlap and the tiny sample preclude held-out accuracy claims.
- `scripts/loop-strum-browser-qa.html` exercises a real 48 kHz AudioBufferSource → AudioWorklet → model worker → scorer, with silent speaker output and no microphone permission. Every take contained exactly 120,000 input frames. Em matched, E major against an Em target did not, and silence returned quiet. Recorder preparation is included. The initial QA harness mistakenly read the transferred buffer's length after transfer; it now records the length beforehand.
- The actual app imported the generated chord recording, reloaded its saved guide, and rendered chord-tone notation both in Chord tones and Sheet music. Verified mobile notation and chord-check setup at 390 × 844, then restored the viewport. Manual chord steps stayed at zero matches and cancelling setup did not request microphone access.
- Physical guitar/room/interface testing remains pending. No actual player performance or microphone capture was claimed.

Follow-up logs and evidence: `.local-data/loop-strum/tests.log`, `lint.log`, `types.log`, `build.log`, `qualification.json`, and `recorded-qualification.json`.
