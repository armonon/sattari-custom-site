# Integrated music apps — 2026-10-11

Published at https://stemdeck.thecreatingco.com/studio and https://sattarimusic.com/studio.

Qualified application source: `16d8e45d495ddd40411450e28e25694081cbcde0` (merged account-wide integration, including PR 31).
Final deployment: `6acbaf989a12b0487c1029a3`.

Adds the current Studio, Split, Key/BPM, Vox, Canvas, Pocket, Lyric, Clean, Press and Learn application updates while retaining the published storefront, product SEO, download pages and old hashed assets. The official Netlify build packaged 24 Node 22 streaming functions and the product-not-found edge function. All three scheduled jobs remain unchanged.

Validation:
- Official hosting build passed.
- Local, hosted draft and published Chromium checks passed at 1440/615/390 widths: six-track project import, workspace/mixer navigation, MIDI notes, playback, WAV mixdown and ZIP stem export, with reload recovery and no fatal errors.
- Nine tool routes passed at 1440/390/320 widths; Pocket produces real WAV loop downloads at every width.
- All 145 scoped file updates and the retained full manifest were verified; unknown product URLs return real 404 and staff endpoints reject unauthenticated access.
- Final runtime-only deploy retains all 995 static files and all 24 function digests, scheduled jobs and the edge bundle. It explicitly binds this production release to the existing production runtime configuration so production-only booking destinations and Stripe webhook configuration survive promotion of a draft.
- Live inventory is not degraded. No paid checkout, mail/SMS send, stock mutation or forced maintenance job was used for qualification.

Evidence: `/Users/lillypad/Projects/remaining-app-releases-20261011`. Runtime values stayed in memory and Netlify; they were not included in evidence or committed.

Native Modular installers remain separately gated on Windows/AU/DAW/signing qualification. This hosted release does not certify native audio delivery or physical-device performance.

## Latest Canvas and worker updates

PR 40's Canvas MP4 duration and shared-suite cache refresh fixes are now included in deployment `6acbb1371e087b8582bf072f`. Application source is the qualified integration tree at `005ebf8` (the only new application changes are PR 40's five files).

All 29 focused Canvas/export/service-worker cases pass, production compilation/prerender/worker generation pass, and real desktop/390px UI exports produce MP4 with 120 frames and 3.999965-second duration for a four-second silent loop, with no page errors. The same export passed on the published StemDeck custom domain. Optional audio slicing is unit-tested; this browser run does not claim a paid service, physical device or DAW qualification.

The final update retains the 24 qualified backend digests, existing production runtime bindings, all scheduled jobs, edge bundle and storefront. The previous missing-archive deployment blocker from PR 40 has been resolved with the exact archives packaged during this release.
