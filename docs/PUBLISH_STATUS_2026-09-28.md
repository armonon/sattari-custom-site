# Publication Status: September 28, 2026

## Outcome

Completed website updates are pushed to GitHub `main`, but the full production
release gate has not passed. No new website release was published by this task.
Do not deploy this build manually to bypass the failed audio checks.

- `7a9201b`: preserves the verified Google ownership file and its regression test,
  records successful sitemap processing, and prepares Business Profile content.
- `1399e1e`: runs the audio and UI qualification suites sequentially and adds
  numerical diagnostics to the existing gain-cancellation assertion.
- Validation worktree: `/private/tmp/sattari-publish-20260928`.
- In-progress Learn/Loop edits in the shared workspace were not included.
- Last confirmed production deploy: `6abaf069ec4ca061a1fe6987`, the previous
  tested website plus the Google verification file.

## Release Evidence

- [First run](https://github.com/armonon/sattari-custom-site/actions/runs/36497506455):
  Node 24 failed on a live-source underrun and gain cancellation; matrix
  fail-fast cancelled Node 22 and skipped deployment.
- [Sequential qualification run](https://github.com/armonon/sattari-custom-site/actions/runs/36499501907):
  Node 24 failed on pitch-locked sync and gain cancellation; Node 22 was cancelled
  and deployment was skipped again.
- Final gain cancellation measurement: maximum sample difference
  `0.00003476254642009735` versus the existing `0.00001` limit; RMS delta
  `0.00003127217240819712` dB. This may be platform-dependent numerical behavior;
  the cause has not been established. No tolerance was relaxed.
- Final sync measurement: key lock off passed at `0.020833333334024928` ms;
  key lock on failed at `24.270833333332575` ms versus the existing `<20` ms limit.
  Both channels contained 31 transients in the failing case.
- The unchanged master-processing suite passed all seven checks locally in the
  in-app browser. Local success is not a substitute for a passing release gate.
- Dependencies/security checks passed on both CI Node versions. Lint, unit,
  type, meter, tempo, production build, prerender and SEO stages reached the
  browser gate in the Node 24 run. Later soak qualification was not reached.

Next engineering work: reproduce the Linux/Chromium numerical mismatch and the
pitch-lock transition sync error in focused tests, determine whether each is
application behavior or a test-measurement issue, and fix without hiding failed
musical deadlines. Rerun the complete unchanged release requirements before
publishing. Keep the Google verification file in every release.

## Business Profile

`armonnasiri@gmail.com` currently manages zero Business Profiles. The user was
asked to sign into the owner account for the existing SATTARI Musical Instruments
listing. The owner subsequently confirmed appointment-only store visits; fixed
shop hours should not be published. The studio's schedule remains separate.

Ready-to-apply content is in [BUSINESS_PROFILE_READY.md](BUSINESS_PROFILE_READY.md).
No listing description, categories, hours, products, photos or posts have been
changed on Google. No duplicate listing or ownership request was created.
