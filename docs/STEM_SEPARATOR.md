# Stem Separator

Route: `/stem-separator`, linked from Sattari Hub. This is real client-side
HTDemucs separation, not an EQ split or a simulated upload workflow. Store,
Learn, and Studio behavior is unchanged.

## Workflow

- Drop multiple audio files or use the file picker.
- `Separate demo` runs the bundled eight-second original practice mix through
  the same decoder, analysis, model, and export path as an uploaded track. It
  does not substitute pre-generated stems or process other queued files.
- Choose vocals, drums, bass, instruments, or all four. Instruments maps to
  Demucs's `other` output, not the complete non-vocal backing track.
- One action processes the queue sequentially. Selection is snapshotted for
  the batch; finished tracks are not reprocessed when retrying failures.
- Preview each stem, download individual WAV files, a track ZIP, or a batch ZIP.
- Stop terminates the inference worker, retaining finished results and queued
  files. Retry uses the current stem selection.

## Engine And Privacy

`demucs-web@1.0.2` provides model preprocessing, inference orchestration, and
overlap-add reconstruction. `onnxruntime-web@1.30.0` runs in a dedicated worker.
WebGPU is attempted when available, with a CPU fallback during initialization
and one CPU retry if GPU inference fails. The processing-device selector can
force CPU compatibility mode for the entire batch.
CPU uses one WASM thread so the site's checkout/maps do not require new global
cross-origin isolation headers. CPU inference can be substantially slower than
real time. GPU performance and mobile inference still need hardware qualification.

The ONNX file is 180,534,758 bytes (172 MiB), loaded only after starting a valid
track. Its Hugging Face revision and SHA-256 are pinned in
`src/utils/stemSeparatorModel.js`. Cache Storage reuses the verified model where
available. Audio stays on the device; no inference backend, API key, audio
upload, or paid service is involved. An initial network connection to Hugging
Face is required. Runtime WASM assets are bundled with the site.

Cache read/write failures do not block inference. Invalid cached model bytes
are discarded and downloaded again in the same attempt; fresh downloads still
must pass the pinned byte count and SHA-256 checks before use or caching.
Downloads fail with a retryable message after 45 seconds without data. The
client also terminates a worker after five minutes without a progress, analysis,
or result message, so a stalled engine does not leave the page locked forever.
Exceptionally slow devices may need a shorter track. Elapsed time is separate
from actual chunk progress and does not imply an estimated completion time.

The adapter corrects upstream progress counting for short/multi-segment tracks
and explicitly disposes ORT tensors between segments. WAV exports reuse the
existing `arrangementExport.wavBytes` encoder in 32-bit float mode at 44.1 kHz,
preserving estimates without clipping or independently normalizing stems.
ZIP packaging uses fflate in its own cancellable worker. Output names are
sanitized and numbered directories preserve duplicate track titles.

Third-party notices: `public/stem-separator-credits.txt`.

## Limits

- Browser-decodable mono/stereo files only. Codec support varies by browser.
- 20 files per queue, 100 MiB per file, 300 MiB total source files.
- Maximum duration: 10 minutes per track; 512 MiB retained output budget.
- Results are temporary for this mounted page session, not stored in a library.
  Download before navigating away. Reload/close warns if processing or results
  exist. Navigating away cancels work and releases preview URLs.
- AI output can contain bleed/artifacts. More selected stems increase retained
  output size; the model computes all four sources regardless of selection.
- Musical analysis requires at least three seconds and sufficient tonal or
  rhythmic evidence. Short, quiet, sparse, or ambiguous signals may legitimately
  have no key/BPM estimate. The reason is displayed beside the measurement.

## Sattari AutoKey

Song and pitched-stem key estimates use `src/utils/sattariAutoKey.js`, a browser
port of the current Auto Pitch dropped-file `SongKeyEstimator` path from the
Sattari plugin suite. This replaces the site's generic key-profile estimator
only in Stem Separator; Studio and Learn are unchanged.

Source: `sattari-plugins-main/core/include/sattari_audio_core/SattariSongKeyEstimator.h`.
Source SHA-256: `3a5077177165801c619790a498b3d39db7cd2ae0c447ff5fd02793e20af6d0bf`.
The native caller is `plugins/auto-pitch/src/PluginProcessor.cpp`:
`startSongSourceAnalysis` finalises the file scan, and `updateAutoKey` prioritises
the file verdict with a margin of at least 0.10.

The port preserves whole-file box resampling to 16 kHz, non-overlapping 4096-point
area-normalised Hann frames, 60 interpolated peaks, local spectral whitening,
harmonic pitch-class contributions, peak-relative 0.2 gating, and the native
major/minor Pearson profiles and tie rules. The existing `demucs-web/fft` replaces
JUCE's FFT, so this is algorithmic parity, not a bit-identical native binary.
Only the whole-file detector is ported, not live tracking, neural fallbacks,
section timelines, tuning, chords or the native cross-plugin correction bus.

Website adapters retain the existing quiet/short/percussion and sparse-harmony
guards, antiphase-safe stereo downmix, and failure isolation. Key scoring scans
the entire decoded file with bounded scratch space. The separate prominent-note
summary, tonal-evidence guards and tempo continue sampling up to three 20-second
windows. AutoKey's subharmonic hypotheses are not presented as played notes.
No new model download, audio upload or API key is needed.

The UI and JSON identify `keyEngine: sattari-autokey`, engine version 1, full
key-scan duration, alternative key and raw `keyConfidence` margin. This margin
is the top-two correlation difference, not a probability. Below 0.10 the UI
shows **Tentative**, matching the native distinction between a displayed
candidate and a trusted verdict. An isolated triad can remain ambiguous, and
the runner-up is not evidence of a modulation. Drum stems have no key.

Native contract fixtures cover all 24 major/minor keys at 44.1/48 kHz,
decoder chunk independence, silence, finalisation and the 27.5 Hz boundary
sub-bass regression. Additional chunk tests cover 8/11.025/16/96 kHz inputs;
the separator itself supplies 44.1 kHz decoded PCM. These fixtures are not
a real-world accuracy benchmark.

Optional comparison against the installed native plugin (requires FFmpeg):

```sh
AUTO_KEY_NATIVE_RENDER=/path/to/sattari-plugins-main/build/local/plugins/song-key/SongKeyRender node scripts/qualify-autokey-native.mjs
```

This checks three isolated triads and the bundled demo against the native
file verdict, including the alternative key and three-decimal raw margin.

### AutoKey Verification (2026-09-29)

- All 30 focused AutoKey, separator-analysis and measurement-panel tests passed
  using one Vitest thread. Scoped ESLint and formatting checks passed.
- The optional native comparison passed all four audio fixtures, including
  matching alternative keys and displayed margins. The demo resolves to
  C major with A minor as the alternative (margin 0.187).
- The actual browser demo completed HTDemucs CPU inference with all four WAVs,
  song/stem AutoKey metadata, matching JSON/ZIP reports and cancellation checks.
  Quiet vocals and drums correctly have no assigned key. BPM remains 120.
- Day/night layout and waveform checks passed at 320, 390, 768, 1024 and
  1440 pixels. Screenshots are in `/tmp/sattari-separator-analysis-qa`.
- Initial test attempts hit host-load timeouts. The successful retry used
  `--pool=threads --maxWorkers=1 --testTimeout=120000`; browser analysis waits
  allow up to 120 seconds. No production build or deployment was made for
  this AutoKey change; the earlier full-release verification gaps below remain.

## Verification

Focused tests:

```sh
npx vitest run src/utils/sattariAutoKey.test.js src/utils/stemMusicalAnalysis.test.js src/utils/stemSeparator.test.js src/utils/stemSeparatorClient.test.js src/utils/stemSeparatorModel.test.js src/utils/stemSeparatorEngine.test.js src/utils/stemSeparatorDownload.test.js src/hooks/useStemSeparator.test.jsx src/pages/StemSeparatorPage.test.jsx src/components/StemAnalysisSummary.test.jsx --maxWorkers=1
npm run type-check
npm run build
```

Real-model browser smoke test (Playwright required):

```sh
npm run preview -- --host 127.0.0.1 --port 5174
SEPARATOR_URL=http://127.0.0.1:5174/stem-separator node scripts/qualify-stem-separator.mjs
```

`PLAYWRIGHT_MODULE` can point to an installed Playwright entry module.
`SEPARATOR_TEST_SECONDS=8.2` exercises multiple inference segments;
`SEPARATOR_STEMS=Vocals,Bass` exercises a subset;
`SEPARATOR_CANCEL_FIRST=1` also exercises stop/resume.
`SEPARATOR_QA_DIR` overrides the default `/tmp/sattari-separator-qa` output.

The smoke test uses generated stereo audio, performs genuine model inference,
checks finite/nonidentical outputs and exact sample counts, plays a returned
WAV, unpacks the downloaded ZIP, and captures desktop/mobile screenshots.
It is a functional check, not a listening-quality benchmark or a long-batch
memory soak. Do not describe it as qualification on every device.

`SEPARATOR_QA_URL=http://127.0.0.1:5190 node scripts/qualify-separator-analysis.mjs`
checks the one-click demo in CPU mode, song/stem analysis, JSON and ZIP reports,
cancellation, and day/night layouts at 320, 390, 768, 1024, and 1440 pixels.
Run real inference separately from other memory-heavy checks on constrained
machines. Unit tests inject GPU failures to check fallback; hardware GPU
performance is not certified by the CPU smoke test.

### Local Reliability Check

- The real eight-second demo passed CPU inference, four WAV exports with exact
  sample counts, 120 BPM detection, individual stem analysis, JSON/ZIP reports,
  and cancellation while retaining a finished result.
- Day/night screenshots, overflow checks at all five widths above, and actual
  desktop waveform pixels passed. Scoped ESLint passed.
- The latest focused unit run completed 31 passing tests, but five additional
  files could not start their Vitest workers. A separate threads-pool retry also
  failed to start workers. These runs are **not full-suite passes**.
- Verification was constrained by severe host load (about 280 load average,
  0.5% CPU idle, and 23 GB of 24 GB memory in use). The production build was
  stopped after more than 22 minutes in transformation. A later batch smoke
  retry timed out loading the local page, before inference.
- Re-run the complete focused suite, production build, and batch/playback smoke
  test when host resources are available. No production deployment was made.
