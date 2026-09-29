# Website Review Fixes

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
