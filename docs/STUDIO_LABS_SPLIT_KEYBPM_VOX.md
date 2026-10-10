# Studio labs: Split, Key & BPM, Vox (alpha)

Three single-purpose tools under the Studio, all running in the browser. Each
page is labelled **Alpha**, lists its limits on the page, and is prerendered,
indexable and in the sitemap (owner-approved 2026-10-05). Listed on the Hub
under "Labs" with Canvas, Pocket and Press.

| Route            | What it does                                                                                                                    | Engine                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/studio/split`  | One song → vocals / drums / bass / instruments; sample-locked mute/solo preview; WAV + ZIP; **Open in StemDeck**                | Existing Stem Separator stack (`useStemSeparator`, HTDemucs via `demucs-web` + `onnxruntime-web`, WebGPU with CPU fallback)             |
| `/studio/keybpm` | Many tracks → key, Camelot, BPM, level; sort; CSV export                                                                        | Existing `analyzeStemAudio` (Sattari AutoKey + site beat tracker) in a worker; rough-tempo fallback                                     |
| `/studio/vox`    | Record (MediaRecorder) or drop a vocal → detected key → scale correction with strength + glide → optional 3rd/5th harmony → WAV | New `src/labs/vox/voxDsp.js`: YIN tracking (`src/loop/pitch.js`), AutoKey profiles (`decideSongKey`), own TD-PSOLA shifter, in a worker |

Code: `src/labs/{split,keybpm,vox}`, shared frame/parts in `src/labs/audio`.
StemDeck handoff: `src/studio/stemHandoff.js` + `src/studio/hooks/useStemHandoff.js`
(one call in `SattariStudioPage.jsx`). Split puts the original file and the four
stem WAVs in an in-memory handoff and navigates to `/studio`; once the restored
session is ready the first empty deck gets the full mix (for BPM/key analysis)
and each stem lane (Demucs `other` → StemDeck `music`), with the full-mix level
set to 0. A reload or new tab loses the handoff (download the WAVs instead).
Occupied decks are never replaced.

## Licenses

- HTDemucs (Meta, `facebookresearch/demucs`): MIT. ONNX conversion
  `timcsy/demucs-web-onnx@92e33df` (`htdemucs_embedded.onnx`, 172 MB), pinned by
  revision, byte size and SHA-256 in `src/utils/stemSeparatorModel.js`. The HF
  repo itself carries no license tag; the weights derive from the MIT release.
- `demucs-web` 1.0.2, `onnxruntime-web` 1.30.0, `fflate` 0.8.3: MIT.
- Vox DSP is original code in this repo. No GPL code (no Rubber Band). The
  repository has no LICENSE file (proprietary), so GPL code must not be added.
- No paid APIs, no keys, no uploads. Split needs one network fetch of the model
  from Hugging Face (cached in Cache Storage).

## Limits (also shown on each page)

- Split: HTDemucs-class quality (bleed/artifacts), one song at a time, ≤10 min /
  100 MB, CPU mode is slow (the 8 s demo took 90–170 s on CPU in headless Chrome
  on a loaded Mac), phones untested.
- Key & BPM: one global key per track; BPM may be half/double; "rough" BPM comes
  from a single 60 s pass folded into 70–180 BPM; ≤10 min / 200 MB per file;
  fixture-tested only, not benchmarked on a labelled corpus.
- Vox: monophonic dry vocal only; YIN + PSOLA (no neural pitch model, no formant
  control), large shifts sound phasey; offline render (not live); ≤3 min.

## Verification

```sh
npx vitest run src/labs src/studio/stemHandoff.test.js src/pages/SattariHubPage.test.jsx
npm run build && npx vite preview --host 127.0.0.1 --port 5191
LABS_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  node scripts/qualify-studio-labs.mjs   # LABS_SKIP_SPLIT=1 skips the model run
```

The browser script (synthetic audio) checks: Key & BPM rows (C major/8B/120,
A minor/8A/100 rough, silence → no estimate) and CSV; Vox detects C major, tunes
a line sung +35 cents to within ±1 cent per note, a harmony third lands on E4,
and a fake-microphone recording loads; Split runs real HTDemucs on the demo,
plays the stems, exports an exact-length WAV, and **Open in StemDeck** fills
Deck A. It also checks 390 px layouts for overflow. Run tests on Node 22 (see
`.nvmrc`): Node 26's global `localStorage` breaks unrelated jsdom suites.

## Split model hosting (decided 2026-10-05)

The HTDemucs ONNX model (`htdemucs_embedded.onnx`, 180,534,758 bytes, MIT) stays
on Hugging Face (`timcsy/demucs-web-onnx`, pinned revision
`92e33df61cfc9eb820272aaa62d2ef6dcf4d950d`) instead of being self-hosted on
Netlify:

- It cannot live in this repo: GitHub rejects files over 100 MB, so a
  Netlify-hosted copy would have to be fetched at build time anyway.
- Netlify meters bandwidth at 20 credits/GB on the account's credit plan:
  ~3.6 credits per first-time Split/Stem Separator user, so ~830 new users
  would use the whole 3,000-credit month and start paid auto top-ups.
  Hugging Face serves it free, with CORS.
- The risk self-hosting would remove is already covered: the URL is pinned to
  an immutable revision, and `src/utils/stemSeparatorModel.js` checks the exact
  byte count and SHA-256 before use, so a changed or tampered file is rejected.

If the repo ever disappears, put the same file (same SHA-256) on a CORS-enabled
bucket (e.g. Cloudflare R2, no egress fees) and change `MODEL_URL`. The license
notice is `public/stem-separator-credits.txt`, linked from /studio/split
and /stem-separator.
