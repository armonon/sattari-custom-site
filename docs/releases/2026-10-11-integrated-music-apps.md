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
