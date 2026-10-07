# Studio apps: installable, offline, suite menu and Locker

## Two installable apps

| App | Manifest | Scope | Start |
| --- | --- | --- | --- |
| StemDeck | `/studio.webmanifest` (linked only on `/studio`) | `/studio` | `/studio?installed=1` |
| Sattari (Split, Key & BPM, Vox, Canvas, Pocket) | `/studio/sattari.webmanifest` (linked only on `/studio/*`) | `/studio/` | `/studio/split?installed=1`, one shortcut per tool |

Press (`/press`), the shop, the hub and `/downloads` link no manifest and are never controlled by
the worker. Icons: `scripts/gen-pwa-icons.mjs` (maskable StemDeck icons, Sattari icons from the
brand mark).

## Service worker (`src/pwa/studio-sw.js` → `dist/studio-sw.js`)

- `npm run build` ends with `scripts/build-studio-sw.mjs`, which injects the precache list: the six
  studio pages, every JS/CSS bundle except Split's onnxruntime files, fonts, icons, manifests
  (~6 MB). The build id hashes the pages, the file list and the worker source.
- Registered from the studio pages only (`src/pwa/studioPwa.js`) with scope `/studio`, and a second
  time with scope `/assets/`: dedicated workers (Split, Key & BPM, Vox) are matched to a
  registration by their own URL, so without it their scripts never reach the worker offline. The
  `/assets/` registration controls no pages and only answers from the caches.
- Pages: network first (3 s), then the page precached with this build. App files: cache first.
- Never cached: user audio, exports, `/api`, Hugging Face, Stripe, the Locker. Only cross-origin
  exception: the suite menu script (CORS, ok responses only).
- Split offline is opt-in: "Make Split available offline" on `/studio/split` saves the 172 MB model
  (the page's own `sattari-demucs-v1` cache) and the 28 MB runtime (`sattari-split-offline-v1`),
  and "Remove offline Split" deletes both.
- Updates wait for the user: "A new version is ready — Reload" posts `SKIP_WAITING`.
- `/studio-sw.js` is served `Cache-Control: no-cache` (netlify.toml).

### Kill switch

If the worker itself misbehaves: `cp scripts/kill-switch-studio-sw.js dist/studio-sw.js` and deploy
(overlay). It deletes the studio caches, unregisters both registrations and reloads open studio
tabs. Restoring an older deploy alone does not remove an installed worker.

## Suite menu and Locker (`src/suite`)

- `https://thecreatingco.com/suite/v1/suite.js` is added once, on studio/tool pages and `/press`
  only, with `data-app` = `stemdeck`, `split`, `key-bpm`, `vox`, `canvas`, `pocket` or `press`
  (the first studio page opened decides it) and `data-menu="none"`; `<tcc-suite-menu>` sits in the
  StemDeck command bar and the tool headers with its 36 px box reserved in CSS.
- Every export download on those pages (stems, mixes, WAVs, Canvas video, Ableton ZIP, StemDeck
  mixdowns/recordings) shows a "Save to Locker" offer once the kit is ready.
- `?tcc-open=`: StemDeck loads audio into the first free deck; Split, Key & BPM and Vox take audio;
  Canvas takes audio or cover art; Press takes a photo. Pocket has no import.
- sattarimusic.com is outside thecreatingco.com, so the Locker uses the popup handoff there;
  stemdeck.thecreatingco.com uses the bridge iframe.
- Without the kit (offline, blocked), nothing changes: no menu, no offer, no errors.

## Checks

- `node scripts/qualify-studio-pwa.mjs` — manifests, scopes, offline pages + Pocket Ableton export,
  cache audit, update prompt. `SPLIT_OFFLINE=1` adds the opt-in offline Split run (downloads the
  model). `STUDIO_PWA_URL=https://…` runs the read-only part against a deployed site.
- `node scripts/qualify-suite-locker.mjs` — menu on every tool page, Save to Locker (popup handoff),
  `?tcc-open=` into Split and StemDeck, kit-blocked fallback. `SUITE_QA_URL=https://…` for a deploy.
