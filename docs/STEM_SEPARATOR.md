# Stem Separator

Route: `/stem-separator`, linked from Sattari Hub. This is real client-side
HTDemucs separation, not an EQ split or a simulated upload workflow. Store,
Learn, and Studio behavior is unchanged.

## Workflow

- Drop multiple audio files or use the file picker.
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
WebGPU is attempted when available, with a CPU fallback during initialization.
CPU uses one WASM thread so the site's checkout/maps do not require new global
cross-origin isolation headers. CPU inference can be substantially slower than
real time. GPU performance and mobile inference still need hardware qualification.

The ONNX file is 180,534,758 bytes (172 MiB), loaded only after starting a valid
track. Its Hugging Face revision and SHA-256 are pinned in
`src/utils/stemSeparatorModel.js`. Cache Storage reuses the verified model where
available. Audio stays on the device; no inference backend, API key, audio
upload, or paid service is involved. An initial network connection to Hugging
Face is required. Runtime WASM assets are bundled with the site.

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

## Verification

Focused tests:

```sh
npx vitest run src/utils/stemSeparator.test.js src/utils/stemSeparatorClient.test.js src/utils/stemSeparatorDownload.test.js src/hooks/useStemSeparator.test.jsx src/pages/StemSeparatorPage.test.jsx
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

Existing React Router 6 production dependencies have moderate npm audit
advisories. The fix requires a separate major-version migration; this feature
does not change the router version or use user-supplied navigation targets.
