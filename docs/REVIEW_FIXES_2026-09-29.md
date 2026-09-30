# Website Review Fixes

## Current Status

Published to https://sattarimusic.com on September 29, 2026 (Pacific time).
Production serves commit `a8b7df34560440a793b19fefbff40667a7ef273b` after both
release gates and artifact integrity verification passed. All ten live smoke
checks passed. Booking remains disabled pending the provider setup below.
The release attempts below are retained as a historical record.

## Implemented

- Learn invalidates pending microphone requests on cancellation, navigation,
  or leaving the live-feedback tab. Late streams are immediately stopped.
  Failed audio setup closes its stream/context, and repeated clicks cancel the
  pending connection instead of opening another microphone.
- Learn binds analysis progress and results to a cancellable request. Changing
  the source or leaving the page aborts it. The shared analysis queue checks
  cancellation and terminates active analysis workers. Older errors/completions
  cannot replace a newer result or clear a newer job's busy state.
- Source changes also invalidate an in-progress Studio handoff; an old asset
  cannot be attached to the new file's music map.
- Practice actions open a focused exercise containing the existing playable
  chord, bass, and drum arranger, with the appropriate instrument selected and
  exercise tempo. Completion stops that workspace, offers retry/next actions,
  and is explicitly self-reported rather than a fabricated performance score.
  Pending arranger audio setup is invalidated on unmount.
- Studio's workspace is a named, focusable section inside the application's
  single main landmark. Its keyboard skip link is retained.
- The prepared appointment-only wording is included across Home, Services,
  Visit, local landing pages, shared business text, and structured data.

## Regression Coverage

Focused unit tests cover stale results/progress, cancellation, late microphone
permission, pending connection cancellation, setup failure, active cleanup,
tab changes, stale Studio handoff, exercise progression, and arranger lifetime.
Existing Studio, Services, and SEO tests are also part of the targeted run.

`scripts/qualify-learn-review.mjs` checks desktop/mobile exercises, measures
nonzero browser audio output, verifies that the contexts actually producing
exercise audio close on completion, and checks the next exercise. It also
reproduces both original async scenarios with controlled mocks and checks
Studio's single main landmark and functional skip link. It never requests a
real microphone. The existing shared Tone context is intentionally not closed
by an individual exercise.

This browser qualification is now included in the existing release gate after
the audio and Studio UI checks. No audio threshold or release requirement was
relaxed.

## Booking Setup Still Required

Authenticated, read-only production configuration inspection on September 29
confirmed that Stripe, staff authentication, daily 18:00-24:00 hours, the booking
email recipient, and both SMS recipients are configured. These provider settings
are missing:

- `RESEND_API_KEY`
- `STUDIO_BOOKING_FROM` (or an existing supported verified sender fallback)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Add these securely through Netlify's production Functions environment settings.
Do not paste credentials into source code or chat. The sender/domain and SMS
sender must be verified with their providers. The existing launch gate remains
closed until provider delivery, staff approval, a Stripe test payment, and paid
confirmation have been validated. No email, SMS, charge, or real booking was
created by these fixes.

## Publication

A separate release checkout at `/private/tmp/sattari-review-fixes-20260929`
contains only the fixes and appointment-only changes on top of the latest
remote main. Unfinished Loop analysis, Studio packaging, and other shared
working-tree changes are not included. Production still goes through the
existing GitHub Actions release gate; a successful local build is not treated
as permission to bypass a failed audio qualification.

## Initial Release Attempt

Scoped commit `11baf4ab31d27c21d1c6ddc203606377f1d6bcfd` was pushed to
`origin/main`. The shared development checkout remains on its existing branch;
unrelated in-progress changes were not committed or reverted.

[Release run 36629935216](https://github.com/armonon/sattari-custom-site/actions/runs/36629935216)
completed without deploying:

- Both Node 22 and Node 24 passed lint, TypeScript, build, prerender, SEO,
  metering, tempo qualification, and 1,705 unit tests (one test skipped).
- The new Learn browser checks passed at 390px and 1440px, including measured
  nonzero audio, playback cleanup, exercise progression, stale analysis, late
  microphone permission, and Studio landmark/skip-link checks.
- Existing Studio UI checks and 12 of 13 audio qualification groups passed.
  The master-output group repeated its earlier Linux Chromium failure:
  opposite -6/+6 dB trims produced a maximum sample difference of
  `0.00003476254642009735`, above the unchanged `0.00001` test limit.
  The other six checks in that group passed. The root cause is unresolved;
  local Chromium passed the same test, which does not invalidate the CI failure.
- The final windowed soak did not run because the browser gate failed.
- Netlify deployment was skipped. Appointment-only wording is prepared and
  verified in generated pages, but this run did not publish it or the code fixes.

The remaining blockers are the Studio master-output qualification failure and
the booking provider setup listed above. No release check was bypassed. The
temporary QA server was stopped; the existing local development server was left
running.

Local evidence: `/tmp/sattari-review-fix-release-qa22`,
`/tmp/sattari-review-fix-release-qa24`, and
`/tmp/sattari-learn-review-fixes`. This result section was added to the local
working copy after the release finished; it is not part of commit `11baf4a`.

## Audio Follow-Up Fixes

The master-output failure is resolved in commit `7d939c6`. Linux Chromium's
native biquad high-pass introduced excessive gain-dependent rounding in the
offline render. Offline snapshots now use an equivalent native IIR filter with
coefficients normalized before allocation; live filter automation is unchanged.
Regression coverage measures actual PCM magnitude and phase, stereo trim
cancellation, and multiple sample rates and cutoff frequencies. All nine master
browser checks passed on Linux without changing the original tolerances.

The next full run (`36636565932`) passed the master checks but exposed a source
underrun during cold seeks and loop changes. Commit `2cd6658` preserves current
playback read-ahead until a prepared change commits, prioritizes audible source
reads over speculative work, and skips obsolete queued reads. Decoding remains
serialized and the 128 MiB memory limit is unchanged. Unit tests cover commit,
cancellation, rejection, queue priority, deduplication, obsolete reads, and
prototype-backed loop controls.

Linux diagnostic run `36639042846` passed all nine master checks and both live
playback cases (normal and an additional 100 ms delay per decode), each with zero
source underruns. The slow-decoder case is now part of the production browser
gate. A focused local run passed 177 tests; the final loop-getter regression
then passed all 10 tests in its file. ESLint and TypeScript checks passed.

Commit `2cd6658f50bc716a27be771748771fc3cae7642f` is pushed to `origin/main`.
[Release run 36639639760](https://github.com/armonon/sattari-custom-site/actions/runs/36639639760)
passed 1,721 unit tests (one skipped), lint, types, build, SEO, normal live
playback, all nine master checks, Studio UI, and Learn browser checks on Node 22.
The added slow-decoder case caught eviction of the start of a prepared cold
seek before transport commit. This run did not deploy; Node 24 was cancelled.

Commit `c0641c173b03eb1ec896a29578e2b14e36366184` fixes that cache lifetime:
destination pages are retained until the transport callback finishes scheduling
its change. Cancellation, source replacement, disposal, and failure retire the
retention guard; page admission still respects the original memory budget.
Deterministic tests cover cache churn, shared and cached pages, and capacity
refusal. The focused suite now passes 181 tests across 16 files; lint and
TypeScript also pass. Release run `36640994817` passed the full software gate on
Node 24, but Node 22 exposed a separate upcoming-loop preparation deadline in
recorded-session replay. The run did not deploy.

Commit `8759700c35fad9bca5a7e5763958760624e40be1` orders replay launch preparation
by actual scheduled audio time, starts preparation earlier, prioritizes its
one-second launch windows, and retains those pages until native grains take
over. Stop, source replacement, and the elapsed deadline retire that protection.
The new slow-decoder replay case also exposed a sample-boundary issue:
`39.99999999999999` did not match an already decoded page starting at `40`.
Source reads now normalize only floating-point noise within a few ULPs of an
exact sample boundary; genuine fractional-sample offsets remain unchanged.
Tests cover this distinction at 8, 44.1, 48, and 96 kHz.

[Linux diagnostic 36643410015](https://github.com/armonon/sattari-custom-site/actions/runs/36643410015)
passed focused unit tests, all nine master tests, normal replay, slow-decoder
replay, and slow-decoder live playback. Both replay cases had zero underruns,
zero late events, and zero maximum lateness. Live playback had zero source
underruns. Peak admitted PCM was `132946296` bytes, below the unchanged
`134217728` byte limit. These six final release files exactly match that run.
Two later local unit attempts timed out starting workers and ran no tests;
they are not counted as passing. Formatting and diff checks passed locally.

Release run `36643861325` passed the entire Node 22 gate, including all 1,731
unit tests (one skipped), browser checks, and the 120-second audio soak. Node 24
passed the playback checks but failed the metering calibration with a false
held peak. It did not deploy.

Commit `25c946221f4c6ef77fadb76a3b6f5f159741da12` preserves continuous FIR/IIR
history while resetting loudness measurement counters. Resetting that history
mid-wave was independently reproduced as a false peak (for example, a steady
-20 dB tone measured -19.01 dB after one reset, versus -19.99 dB when history was
preserved). New tests cover resets at multiple phases and 44.1/48 kHz. All seven
local metering tests, including FFmpeg comparison, passed using the thread pool.
The browser calibration uses a defined short fade-in and resets the meter while
the tone is sounding. Tolerances are unchanged; its completion marker also lets
the runner report failure after cleanup without a redundant timeout.

[Linux diagnostic 36645600819](https://github.com/armonon/sattari-custom-site/actions/runs/36645600819)
passed focused unit tests, master output, normal/slow replay, slow live playback,
and three consecutive browser metering/tempo calibrations. The latest commit is
pushed to `origin/main`. Release run `36645974610` passed the complete gate on
both Node 22 and Node 24: 1,733 unit tests (one skipped), 15 audio groups, Learn
and Studio browser checks, and the mandatory playback soak. Deployment then
correctly refused a truncated uploaded artifact: 477 files were downloaded
instead of the qualified 479, because GitHub's artifact upload omitted the
hidden `.vite/manifest.json` and `.vite/prerender-template.html` files.

Commit `a8b7df34560440a793b19fefbff40667a7ef273b` enables hidden files only for the
`dist/` artifact upload. The byte-for-byte verification remains unchanged.
The artifact unit suite now includes a missing-hidden-file regression; all six
tests pass. Netlify secret names were confirmed present without exposing their
values. This packaging-only fix is pushed for full qualification and deployment.
Booking provider setup remains separate and the public booking endpoint still
correctly reports `enabled: false`.

## Published Result

[Release run 36647497996](https://github.com/armonon/sattari-custom-site/actions/runs/36647497996)
passed on Node 22 and Node 24 and deployed successfully to Netlify:

- Each runtime passed 1,734 tests, with one skipped, across 195 files.
- Lint, TypeScript, dependency security, build, prerender, metering, tempo,
  and SEO checks passed. SEO verification covered 74 public pages.
- All 15 browser audio groups, Learn regressions, and Studio responsive UI
  checks passed on both runtimes.
- Each mandatory 120-second playback soak recorded zero underruns and zero
  late events. Peak admitted PCM was 132,946,296 bytes, below the unchanged
  134,217,728-byte limit.
- The downloaded Node 22 build passed byte-for-byte artifact verification,
  including both hidden Vite files, before Netlify published it without a rebuild.
- The public release manifest matches the exact main commit above and reports
  `softwarePassed: true` and `unchanged: true`.

Post-deploy checks against the production domain passed all ten checks: exact
release identity; appointment-only wording on Home, Services, Visit, and the
Encino landing page; the closed booking launch gate; mobile and desktop Learn
audio, cleanup, progression, and overflow checks; late microphone permission
cleanup using only a synthetic stream; and Studio's single main landmark,
named workspace, and keyboard skip link. Mobile/desktop Learn and desktop
Studio screenshots were also visually inspected.

Evidence is available locally in `/tmp/sattari-published-release-22`,
`/tmp/sattari-published-release-24`, and
`/tmp/sattari-live-review-20260929/report.json`. Screenshots are in the latter
directory. No tests were bypassed or thresholds relaxed. No real microphone,
booking, email, SMS, or charge was used. Unrelated shared working-tree edits
and the user's existing development server were preserved.

This final result is a local release record added after publication; it is not
part of the deployed commit. Email/SMS provider configuration and an end-to-end
booking test remain necessary before public booking can be enabled.
