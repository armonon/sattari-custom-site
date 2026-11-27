# Practice memory, saved loops and keyboard shortcuts (2026-11-24)

Branch `feat/practice-memory`.

## What changes

Before this, a reload kept a separated song but forgot everything set in the
player. Now the Stem Separator (and its Split alias) remembers, per song, in this
browser:

- the mix: levels, mute, solo, master and Prevent clipping
- speed and key
- the current A–B loop
- **saved loops**: up to 12 named loops ("Verse", "Solo") to jump between
- click, count-in, snap-to-beats and the bar start

**Keyboard shortcuts** for hands-on-instrument practice: Space, ← →, `[` `]`, `\`,
1–9, 0 and C (listed in the player under "Keyboard shortcuts").

## How it is stored

A separate small IndexedDB database (`sattari-practice-state`): JSON only, no
audio, never sent anywhere. Removing a song forgets its setup and **Clear saved
work** clears all of them. Stored values are validated and clamped on the way
back in; anything that does not fit the audio is dropped.

## Verification

- Real-model QA (CPU): 38/38, evidence in `2026-11-practice-memory-evidence/`. New
  check: mute the bass, set a 0:02–0:04 loop, save it as "Riff", turn snap off,
  reload; all of it is restored, the `\`, `1` and Space shortcuts work, and Clear
  saved work leaves no practice setups in storage.
- Unit tests: new `practiceState.test.js` and five player tests (restore, damaged
  record, save/rename/recall/remove loops, shortcuts, preview player). Every test
  file passes; the full parallel run had load timeouts in 11 files that all pass
  when rerun on their own.
- ESLint, `tsc` and the production build pass.
- Not verified: Safari/Firefox, phones (the
shortcuts need a hardware keyboard), and behaviour when two tabs edit the same
song at once (the last write wins).

## Production deploy (2026-11-24 21:42 UTC)

Published deploy `6b0603f4d906fdc28eea200a` on the `sattari` site
(sattarimusic.com). Rollback: publish `6b060230e176dd28e66479f2`.

Production had changed since the 2026-11-22 overhaul deploy: it was running
"Sattari comprehensive SEO and product option discovery Nov 24"
(`6b060230e176dd28e66479f2`), built from three commits that are not on GitHub
`main` (`33feae5`, `b409b17`, `e594d83` in
`sattari-comprehensive-seo-20261124/source`). Deploying `main` alone would have
removed that work, so this release was built from a local merge of `main`
(`8a060d3`, with #51) and `e594d83`: commit `28617d4` on
`release/seo-plus-practice-memory`. Compared with the live source the merge adds
exactly the practice-memory change (13 files) and no backend file.

- **Build:** `npm run build` (the guarded inventory build): 94 canonical URLs, 101
  prerendered pages match the live stock snapshot. The sitemap is byte-identical
  to production's; sampled pages differ from production only in bundle file names.
- **Static:** all 831 live files kept; the build replaces or adds. 916 files.
- **Backend:** all 24 live function archives reused by digest
  (`scripts/overlay_deploy.py … reuse`), no function uploaded; routes, memory,
  region, rate limits, the 3 schedules and the edge function identical.
  Production runtime values bound in memory; the receipt lists key names only.
- **Checks on the draft, then on production:** 94 sitemap pages return 200; 15
  legacy/redirect URLs match; site-configured security headers match; inventory
  (`consistency: strong`), checkout guard, booking config and admin auth
  responses match. Browser on the draft: separate the example, mute the bass,
  save a loop as "Riff", turn snap off, reload; all restored, Space plays and
  pauses, no script errors. On production the new bundle and the chunk holding
  the practice store are served.
- **Not done:** the three SEO commits and this merge are not pushed to GitHub, so
  `main` is still behind production.
