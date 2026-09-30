# Sattari Website Review

Reviewed September 29, 2026. Scope: current local working tree and the public
site at https://sattarimusic.com. This is a review, not a deployment or a
certification. Application code was not changed during this review.

## Findings

### 1. P1: Online studio booking is not enabled in production

**Verified live operational blocker; not an unexplained frontend crash.**

The live `/api/studio-bookings` endpoint returned HTTP 200 with `enabled: false`.
It correctly reported daily availability hours of 18:00 to 24:00 in
America/Los_Angeles, but the booking form disables its fields while booking is
disabled. Customers cannot complete the online request, owner approval, payment
link, and final confirmation workflow.

The launch gate requires notification providers, Stripe, staff authentication,
the schedule, and an explicit launch switch. The public response does not reveal
which prerequisites are missing; this review does not assume a specific missing
credential. The call-the-shop fallback remains available.

Sources:
- [Configuration gate](/Users/lillypad/Downloads/sattari-custom-site/site/server/studioBookingConfig.js:29)
- [Disabled form and fallback](/Users/lillypad/Downloads/sattari-custom-site/site/src/components/StudioBookingForm.jsx:183)
- [Live booking availability](https://sattarimusic.com/api/studio-bookings)

Next action: inspect the staff setup checklist and production configuration.
Validate owner email, both requested SMS recipients, approval, customer payment
email, Stripe test payment, webhook confirmation, and retry behavior before
enabling the public workflow. Mocked UI success is not evidence of delivery.

### 2. P1: A late microphone permission grant can outlive the Learn page

**Reproduced in the current local browser using a synthetic audio stream.**

Start microphone connection in Learn, navigate to Hub while permission is
pending, then resolve permission. The stream remains `live` on `/hub`.
Unmount cleanup only stops the stream already in `micRuntimeRef`; while
permission is pending that ref is empty. The asynchronous connection then
creates a context and installs a pitch-analysis loop after the component has
unmounted. A real microphone could remain active without Learn's stop control.
No microphone audio was captured or uploaded in this test.

Sources:
- [Unmount cleanup](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariLearnPage.jsx:254)
- [Late stream assignment](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariLearnPage.jsx:394)

Next action: invalidate pending connections on unmount, immediately stop late
streams, serialize connection attempts, and clean up streams/contexts when setup
fails. Add delayed-permission and repeated-click regression tests.

### 3. P2: Changing songs during Learn analysis attaches the old results to the new song

**Reproduced in the current local browser with a deterministic delayed analyzer.**

Analyze `first-song.wav`, choose `second-song.wav` while analysis is pending,
then let the first analysis complete. The source label reads `second-song` and
`analyzed locally`, but its displayed D-minor result belongs to the first file.
The uploader remains enabled and `handleTeach` applies the resolved result
without checking the source generation. This can also contaminate the music map
sent to Studio, which combines the current file with the current analysis.

Sources:
- [File replacement](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariLearnPage.jsx:266)
- [Unconditional result commit](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariLearnPage.jsx:301)
- [Studio handoff](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariLearnPage.jsx:429)

Next action: bind analysis and progress to a file/request generation, discard
stale completions, and invalidate pending work on file replacement and unmount.
Test both the displayed result and the persisted Studio handoff.

### 4. P2: Learn's exercise-start controls do not start exercises

**Code-confirmed functional gap in `/learn`, not a claim about the separate Loop tool.**

Each Practice exercise offers a play icon named `Start <exercise>`. Its handler
only sets `activeExercise`; that value is used solely to apply an `is-active`
class. No lesson state, transport, metronome, input assessment, or completion
flow starts. A beginner following the invitation receives a highlighted
instruction rather than an interactive practice session.

Source:
- [Practice exercise controls](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariLearnPage.jsx:765)

Next action: connect each action to a real guided exercise with an audible
example, count-in, attempt, feedback, and replay, or rename the action to make
its instruction-only behavior explicit. The existing `/loop` practice work is
a useful implementation reference; do not discard it or pretend it is already
the behavior of every Learn exercise.

### 5. P2: Appointment-only store information is not yet published

**Verified release/content gap.**

The current source says `By appointment only. Call to arrange your visit.` and
the local Services page says `Visit by appointment`. The public Services page
still invites people to `Visit the shop`; the live Visit page/footer tell them
to confirm hours but do not clearly state the appointment-only policy. Someone
arriving from search could reasonably expect a walk-in visit.

Sources:
- [Business hours note](/Users/lillypad/Downloads/sattari-custom-site/site/src/data/siteSeo.js:10)
- [Services visit section](/Users/lillypad/Downloads/sattari-custom-site/site/src/components/ServicesPage.jsx:222)
- [Public Services page](https://sattarimusic.com/services)
- [Public visit details](https://sattarimusic.com/visit)

Next action: publish the already prepared appointment-only changes through the
release checks, then verify live pages and the actual owner-managed Business
Profile. Keep the store's appointment policy separate from studio hours.

### 6. P3: Studio has nested main landmarks

**Verified in local and production browser DOMs.**

The application wraps every route in `<main>`, and Studio renders another
`<main id="studio-workspace">` inside it. Both are exposed as main landmarks,
making landmark navigation ambiguous and producing invalid main nesting.
The skip target itself is present.

Sources:
- [Application landmark](/Users/lillypad/Downloads/sattari-custom-site/site/src/App.tsx:275)
- [Studio landmark](/Users/lillypad/Downloads/sattari-custom-site/site/src/pages/SattariStudioPage.jsx:273)

Next action: keep one main landmark per page and preserve the Studio skip-link
target and focus behavior using a section or another suitable container.

## Verification

| Area | Result |
| --- | --- |
| ESLint | Passed. |
| TypeScript | Passed. |
| Production client build | Passed, built into an isolated temporary output directory. |
| Prerender | Passed using the live inventory; generated 74 canonical public URLs. |
| Production SEO checks | Passed for all 74 generated public pages, including metadata, canonical URLs, structured data, rendered content, and private-page noindex. |
| Production dependency audit | Zero reported production dependency vulnerabilities. This is not a penetration test. |
| Live sitemap | All 70 published sitemap pages returned HTTP 200, with unique titles/descriptions, matching canonicals, one H1, and nonempty prerendered content. |
| Unknown URLs | Unknown general and product URLs returned HTTP 404. |
| Search verification file | Google's HTML verification file is published. Account verification/report access was not rechecked. |
| Browser layouts | Examined core local and live routes at 1440 and 390 pixels. No horizontal page overflow or visibly broken images in successfully loaded sampled views. |
| Cart | Passed add, quantity changes, persistence after reload, decrement, and removal at 320, 390, 768, and 1440 pixels in day and night themes. No checkout created. |
| Booking UI | Passed mocked request flow and service entry points at 390 and 1440 pixels in both themes; mobile staff approval UI also passed against a mock API. |
| Stem Separator | Local and live interfaces loaded; two-file upload queues worked. No full inference run was repeated during this broad review. |
| Learn race checks | Reproduced stale analysis and late microphone cleanup issues with controlled browser mocks. |
| Complete unit suite | Not completed. Stopped the broad run after roughly 20 minutes under severe host load; completed files had passed. This is not an all-tests-passing result. |
| Focused critical tests | 249 tests passed across 10 files: checkout creation/stock, Stripe order/stock webhooks, studio bookings, inquiry handling, staff authorization, security headers, consent tracking, and Learn's existing happy-path test. |
| Live linked media/downloads | All 128 inspected image/audio/download targets responded successfully. One image initially had a network failure and returned HTTP 200 on a separate retry. HEAD checks establish availability, not file-content correctness or installer safety. |

Initial browser attempts at Studio and Separator needed retries. One Studio
selector incorrectly assumed there was exactly one `main`; local Vite also
returned outdated dependency 504 responses during concurrent development.
Clean follow-up visits loaded local/live Studio, Separator, and Privacy without
page errors. The first local Studio screenshot showed only a loading screen and
was not counted as a successful visual inspection. Later screenshots show the
actual workspaces.

The local development server returns 404 for `/api/inventory`, so local commerce
UI checks use the built-in catalog. The production inventory API returned 200,
reported strong consistency, and was not degraded. Actual production inventory
must remain the authority for checkout; this review did not submit orders.

## Product And Design Follow-Ups

- Give Learn one clear beginner path: choose an instrument, hear a short example,
  perform one small task, receive understandable feedback, then advance. Its
  current source/map/arranger/challenge layout exposes many concepts at once.
- Keep the public store and the music workspaces visually related, but allow
  the dense Studio interface its own practical layout. The desktop storefront
  navigation currently wraps Cart onto a second row; a more deliberate layout
  would look cleaner.
- Keep instrument photos and specs precise. Some product descriptions are
  general; confirm actual cymbal sizes, included items, violin sizes, and stock
  variants before expanding persuasive copy. Do not invent specifications.
- Preserve honest tool limits. The live Separator states its first-use model
  download size, device-local processing, estimates, and session-only results.
  Avoid advertising reliable arbitrary-song transcription or phone performance
  beyond measured capabilities.
- Publish the already-removed Listening Desk only as part of a reviewed release.
  It is absent locally but remains on the public Hub at the time of inspection.

## Remaining Owner And Release Checks

- Complete an authorized Stripe test-mode customer journey, including webhook,
  inventory reservation/release, confirmation, and owner notification delivery.
  No real charges, stock holds, inquiry submissions, emails, or SMS were sent.
- Validate real stock counts. Every variant returned by the inspected live
  inventory snapshot had quantity 100. This may be intentional; it is an owner
  reconciliation question, not a confirmed inventory bug.
- Confirm Search Console ownership and inspect actual indexing and performance
  reports. A published verification file and valid sitemap do not prove Google
  has indexed every page or that owner access is complete.
- Confirm access to the correct existing Google Business Profile. The September
  28 preparation document records an account-access blocker; that historical
  account status was not independently rechecked here.
- Verify live analytics consent behavior and inquiry/purchase conversion data
  in the destination reports. Source review and unit coverage do not establish
  that production dashboards are receiving useful data.
- Rerun the complete unit suite and Studio audio/release qualification on an
  unloaded host against one stable release snapshot. Files were changing in
  other active work during this review. Existing release gates must not be
  bypassed because a frontend build passes.
- Test real Safari/iPhone, Android, microphone/MIDI hardware, long tracks,
  low-memory devices, interrupted downloads, full keyboard workflows, contrast,
  and screen readers. Chromium responsive screenshots are not device or WCAG
  certification, and host load made performance timings unrepresentative.

## Evidence

Temporary review evidence is stored under `/tmp/sattari-site-review`:
`http.json`, `report.json`, `tool-recheck.json`, `reproductions.json`, `assets.json`,
and desktop/mobile screenshots. Temporary files may be removed by the OS.
Cart screenshots are under `/tmp/sattari-cart-qa`; mocked booking screenshots
are under `/tmp/sattari-booking-qa`. The focused unit-test JSON report is
`/tmp/sattari-review-critical-tests.json`. The two race-condition reproductions
were separate browser checks and are not covered by Learn's one existing
happy-path unit test.

Recommended order: repair microphone lifetime and stale analysis, finish booking
provider setup and controlled end-to-end validation, make Learn's exercise
actions honest/useful, then publish the appointment-only and Hub changes after
release qualification. Resolve the landmark issue in the same focused cleanup.
