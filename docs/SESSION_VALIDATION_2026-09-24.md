# Shared-session validation — 2026-09-24

Target: existing Netlify site `sattari`, `sattarimusic.com/studio`. Native application installation is outside this web deployment.

Published production deploy: `6ab5a3bf7065cc8fe71f8f74`. Post-publish desktop/mobile workflow checks passed at `https://sattarimusic.com/studio`, with no page errors or viewport overflow. The expected hashed JS/CSS and inventory API return 200. Production browser report: `/tmp/stemdeck-production-qa/report.json`.

## Evidence

- Full Vitest run: **96 files, 625 tests passed** (single worker).
- TypeScript no-emit check, Vite production build, prerender and `git diff --check`: passed.
- Isolated Chromium desktop (1440 × 900) and mobile (390 × 844): all four workspaces, inspector and sequencer checked locally and on the deployed preview. No uncaught page errors or viewport overflow. Screenshots inspected.
- Eight generated-audio suites passed together on a separate local server with hot reload disabled: input routing, input recording, two-deck sync, master processing, effects rack, arrangement rendering/export, loudness/tempo and performance recovery.
- Recovery run: 60 seconds of real audio-clock capture with control/UI load, 1,200 events at the 60-second checkpoint, durable recovery verified. Replay: zero events over 25 ms late, worst 14.6 ms. This is not a long physical recording session or a bit-exact replay certification.
- Synthetic meter qualification: 300 passed; generated tempo fixtures: 7 passed. Licensed-programme and independent certification gates remain open.
- Preview routes: `/studio`, `/shop` and `/api/inventory` return 200; unknown routes return 404. Hashed Studio JS/CSS return 200.

Reports from this run: `/tmp/stemdeck-audio-qa.json`, `/tmp/stemdeck-session-qa/report.json`, `/tmp/stemdeck-deploy-preview-qa/report.json` (temporary machine-local evidence).

## Corrections made during validation

- Removed the extra information-link row from above the viewport-sized app; links remain in the status drawer.
- Reduced mobile toolbar stacking, corrected master meter/stem layout, and positioned inspectors from the actual toolbar height.
- Added honest UI callback-delay and browser latency estimates, without representing them as CPU or acoustic round-trip measurements.
- Stable deck-filter automation now uses audio timestamps and a shared live/replay curve. Type-changing sweeps remain conservatively dispatched.
- Fixed audio QA to await complete suites and validate 48 kHz range exports at 48 kHz instead of the device's resampled 44.1 kHz output.

## Not signed off

Exact replay of every graph/topology change, input-monitor effect and pre-recording tail; physical loopback latency; real interface unplug/reconnect; extended hardware capture; native plugin integration and native installation. Preserve printed safety takes. Do not call this 10/10 or a fully certified professional release on the basis of these checks.
