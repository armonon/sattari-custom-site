# Search and AI Discovery

## Current Audit: September 28, 2026

Local changes are not published yet. The owner confirmed in this task that Google
Search Console is verified; Bing Webmaster Tools is not yet verified. This updates
the historical September 23 verification status below. We have not inspected the
current Search Console reports or submitted another sitemap in this task.

Onsite improvements:

- Eight answer-first guides, including karaoke vocal removal, drumless practice,
  song key/BPM analysis and batch separation. Tool claims match the implemented
  file, memory, model and analysis limits. No perfect-isolation claims.
- Visible Sattari Music publisher attribution, section permalinks, three-level
  guide breadcrumbs and matching Article metadata. No invented expert reviewer,
  rating or automatically refreshed publication date.
- One shared MusicStore and WebSite identity on every rendered page. Tool and
  article metadata link back to those identities; no fictional city storefronts.
- All eight guides have distinct, allowlisted reporting buckets. About and the
  new local drum/violin pages are also covered. Consent, GPC/DNT, coarse source
  labels and private-page exclusions are preserved; no extra personal data.
- The build's SEO checks now enforce the site identities, visible guide publisher
  and working section links, and run after prerendering in the automated release
  gate. Crawl-policy tests protect public search access and
  keep private APIs excluded without changing the training-bot policy.

Read-only production probes returned 200 for robots, sitemap, home, separator and
separator reference pages using normal, Googlebot, bingbot and OAI-SearchBot user
agents. HTML content, canonicals and snippet/indexing eligibility are checked by
`scripts/audit-search-access.mjs`. User-agent probes are not real crawler-IP tests
and do not establish indexing or inclusion in generated answers. Live production
still has the previous Stem Separator metadata until the local changes are deployed.

Remaining account work:

1. In the verified Google Search Console property, check sitemap status, indexing
   and selected canonical URLs. Submit the live sitemap after publishing updates;
   it should contain 74 canonical URLs for the currently built catalog.
2. Add/verify Sattari in Bing Webmaster Tools, using the verified Google property
   import or Bing's ownership flow. Submit the sitemap and review crawl/indexing
   health, then AI Performance when data is available. Import requires the owner's
   account authorization; no credentials or ownership tokens were invented.
3. Have the current Google Business Profile owner confirm the real shop hours and
   services. Studio hours must not become the shop's opening-hours claim.
4. Check hosting firewall logs/settings for actual crawler-IP access without
   disabling general security protections. CLI publishing access alone does not
   establish this dashboard check.

Measure 28-day trends in indexed pages, relevant queries, inquiries and successful
tool actions. Identifiable AI referrals are only a subset of traffic; suppressed
referrers and zero-click citations are not measured by the site's opt-in collector.
Google AI traffic cannot be reliably separated from ordinary Google referrals here.
Bing's AI Performance report supplements this with citation data; it is not a
visitor-level conversion report. No ranking or citation guarantee is implied.

No special AI schema or `llms.txt` file is required by Google's current guidance.
Continue publishing useful, product-specific evidence: real tool demonstrations,
honest limitations and owner-approved service details. Do not mass-produce city
or question pages, hide crawler-only copy, or add instructions aimed at AI bots.

```sh
npm run build
npm run test:seo
npx vitest run tests/search-access.test.js src/utils/seo.test.jsx src/pages/StemSeparatorSeo.test.jsx src/utils/siteMetrics.test.js src/utils/siteMeasurement.test.js tests/netlify-functions/site-metrics.test.js
SEARCH_AUDIT_REPORT=/tmp/sattari-search-access.json node scripts/audit-search-access.mjs
SEO_URL=http://127.0.0.1:4199 node scripts/qualify-stem-separator-seo.mjs
```

Current primary guidance:

- [Google: optimizing for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [OpenAI: search crawlers and independent training controls](https://developers.openai.com/api/docs/bots)
- [Bing: webmaster guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a)
- [Bing: AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)

## Initial Rollout: September 23, 2026

- `/guides`: a linked index with four substantial, answer-first articles.
- `/guides/how-to-separate-vocals-drums-bass`
- `/guides/practice-bass-with-isolated-stems`
- `/guides/instrument-repairs-near-encino`
- `/guides/choose-your-first-cymbals`
- `/tools/stem-separator`, `/tools/learn`, `/tools/studio`: supported inputs,
  outputs, browser requirements, privacy, current free access, storage, limits,
  real interface captures and an original downloadable audio demonstration.
- `/visit`: shared business identity and explicit distinction between shop visits
  and daily 6 PM-midnight studio/rehearsal hours.
- `/privacy`: local audio handling and opt-in aggregate measurement controls.
- Article and breadcrumb structured data; tool help and screenshot references;
  prerendered HTML and sitemap coverage for all ten new public pages.
- Staff dashboard `Site insights`, authenticated with the existing staff session.

No customer audio was used for screenshots. `scripts/create-tool-demo.mjs`
synthesizes an original eight-second 120 BPM Am-F-C-G example. Learn's reference
run estimated C major and 117 BPM; the visible caption documents this rather than
claiming exact transcription. Microphone/MIDI support is described conditionally,
not as tested across every device.

The separator reference includes genuine eight-second HTDemucs bass and drum WAV
outputs from a browser CPU run. The reference page lets visitors hear the mix and
both estimates without downloading the model. This is a synthetic workflow sample,
not a claim about separation quality on vocals or every commercial recording.

## Business Identity

Source of truth: `src/data/siteSeo.js`.

- Public name: Sattari Music; alternate: SATTARI Musical Instruments.
- One address: 4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364.
- Public shop telephone: (424) 465-3020.
- Areas served: Woodland Hills, Encino, Calabasas, Los Angeles, San Fernando Valley.
- Shop hours: not yet owner-confirmed; ask customers to contact the shop.
- Studio/rehearsal: daily 6 PM-midnight, Los Angeles time, by confirmed booking.

The owner's booking-alert email and two mobile numbers remain server-side and
are NOT substituted for the established public shop contacts. The studio's
booking schedule is NOT asserted as the MusicStore's opening hours. No extra
city storefronts, ratings, review counts or guaranteed repair times are invented.

The existing Google Maps listing was inspected on 2026-09-23. Its public name is
SATTARI Musical Instruments; address, phone and website match the shared record.
Google displays "Add hours", not a published opening schedule. Keep the real-world
listing name; do not rename it for keywords or substitute studio hours for shop
hours. The signed-in account does not manage this listing. Google identifies its
owner only as `in...@...`; no ownership request or duplicate listing was created.

Ready for the current Business Profile owner:

- Keep the existing name, address, telephone and `https://sattarimusic.com/`.
- Confirm and add actual shop opening hours; do not use the studio schedule.
- Review services for instrument repair/setup, instrument rentals, lessons/classes,
  and studio/rehearsal inquiries. Only add services currently offered.
- Add current shop/interior/instrument photos, not software screenshots.
- Suggested description: "SATTARI Musical Instruments is a music store in
  Woodland Hills serving musicians in Encino, Calabasas, Los Angeles and the
  San Fernando Valley. Shop instruments, cymbals, drumsticks and accessories,
  or contact us about instrument repairs, setups, rentals, music lessons and
  studio or rehearsal space. Visit our website for the current catalog,
  local service inquiries and Sattari's browser-based music tools."

## Search Console and Hosting Audit

On September 28, 2026, after the owner's explicit approval, Google confirmed
**Ownership verified** for `armonnasiri@gmail.com` on the URL-prefix property
`https://sattarimusic.com/`, using the HTML-file method.

- Keep `public/google42e3d2164ecfc40d.html` in every future build. The live root
  URL responds HTTP 200 with Google's verification text. The search-access test
  guards against removing or changing the file.
- Verification-only production deploy: `6abaf069ec4ca061a1fe6987`, based on
  the existing tested release `6ababac9846a154c55561a17`. Its 319 existing static
  files, 24 function bundles/configurations and three schedules were unchanged.
  Newer local application changes were not published as part of verification.
- Google accepted `https://sattarimusic.com/sitemap.xml`. After an initial
  **Couldn't fetch** response, one resubmission following the successful live
  test resulted in **Success**, type **Sitemap**, and **70 discovered pages**.
  The live XML validates. Discovered pages are not necessarily indexed pages.
- Google's live URL Inspection test at 3:57 PM Pacific confirmed **URL is
  available to Google**, **Crawl allowed: Yes**, and **Page fetch: Successful**
  for the sitemap.
- The overview's indexing report is still processing data. Business Profile
  management remains separate and requires the account that owns the listing.

Next checks:

1. Keep the verification file in future deployments and check the Sitemaps report
   after releases for continued successful processing.
2. Inspect `/`, `/guides`, the four articles and the tool reference pages. Check
   the indexed canonical and rendered content, then request indexing where useful.
3. Use the Performance report for query impressions, clicks, CTR and position;
   compare 28-day periods. Do not promise a particular indexing date or ranking.

On 2026-09-23, live `/stem-separator` responded 200 with readable content and no
X-Robots-Tag restriction to normal, Googlebot, bingbot and OAI-SearchBot user-agent
probes. The Netlify site API showed no site password. This is not proof of access
from every crawler IP. Firewall/bot rules were not exposed by that site endpoint;
finish the Netlify security dashboard audit after browser sign-in. The browser
dashboard currently shows its login screen; CLI publishing access is available.
Do not disable general security protections to invite crawlers. Fresh production
probes of `/tools/stem-separator` also returned 200 to Googlebot, bingbot and
OAI-SearchBot user agents after publication.

`robots.txt` explicitly allows OAI-SearchBot on public paths while retaining API
exclusions. GPTBot inherits the existing wildcard policy; training policy has not
been changed or conflated with search access. No speculative `llms.txt` requirement
or special AI schema is introduced.

## Measurement Contract

The first-party `/api/site-event` collector only accepts three allowlisted fields:
`event`, `page` (a coarse group), and `source`. Consent is required before the
browser sends anything. Global Privacy Control and Do Not Track disable it.
Browser and server request-hostname checks exclude local/draft visits. This does
not depend on Netlify's build-only `CONTEXT` variable being available at runtime.
No user ID, raw URL, search query, referrer URL, filename, audio, name, email,
phone, booking ID, or IP is persisted in the report. Netlify still handles ordinary
network traffic and its own operational logs separately.

Reports use conditional writes to aggregate daily counts, in 90 reusable day
slots. The reporting window is 90 days; inactive old aggregate slots are replaced
on reuse, not promised to be physically purged at day 90. Reports are staff-only.
The endpoint has an exported Netlify IP/domain rate-limit rule (60/minute) and a
100,000/day count ceiling. A deployment audit found that Netlify ignored the
in-source configuration on the old Lambda-style handler. The collector now uses
the current Request/Response function format, with explicit paths for both
`/api/site-event` and `/.netlify/functions/site-event`; the old redirect is removed.
A bounded draft GET probe confirmed 429 responses on both paths after the
threshold/counting delay, while `/guides` still returned 200. GET probes create
no measurements. Runtime storage setup supports the current function context and
the legacy authenticated staff report separately.

Recognized sources: ChatGPT, Perplexity, Claude, Copilot, Gemini, Google and Bing;
other referrals and direct/unknown are separate buckets. Known AI `utm_source`
labels can identify a referral without a referrer. These labels are indications,
not cryptographic proof of origin; users, bots and referrer suppression affect
counts. Google AI Overview/Mode traffic cannot be isolated from regular Google
referrals here. Search Console includes those features in overall Web traffic.

Events:

| Event | Meaning |
| --- | --- |
| page_view | A measured route view, not a unique visitor |
| inquiry_sent | Inquiry endpoint/form returned success, not a sale |
| booking_requested | Booking request accepted, not approved or paid |
| contact_click / directions_click | A clicked contact action, not a completed call or visit |
| separator_started | A nonempty batch was started |
| separator_completed / separator_failed | Per-track result or failure, not a batch count |
| stem_download | A WAV/ZIP download was initiated, not confirmation that the user saved it |
| learn_started / learn_completed / learn_failed | Local song analysis lifecycle |
| studio_imported | An audio file was successfully loaded into a deck lane |
| studio_exported | A portable project download was initiated |

Review recognized AI sources against inquiries and successful tool actions using
the staff report's 7/28/90-day and source filters. These are opt-in event counts,
not complete traffic, visitor-level conversion rates or financial records. No
paid analytics subscription, Google Analytics property or synthetic production
traffic was created for this work.

## Verification Commands

Validated on 2026-09-23: production build, TypeScript, focused ESLint, all 66 public
pages' metadata/rendered content, ten resource routes at desktop/mobile widths in
both themes, consent controls, and the staff report with mocked authenticated data.
The broader focused run had nine Studio test timeouts while CPU inference was
running; all 18 Studio tests passed in isolation with a 20-second timeout, without
source/test expectation changes. The 17 other suites in that run passed (172 tests).
The 24 measurement-specific tests passed again after the request-host guard fix.

Published: https://sattarimusic.com/guides

Production deploy: `6ab4aafb5435b9c360ab3f65`.
Rate-limit validation draft: `6ab4aa565257222c6d2f5778`.
The frontend artifact was compared with the previously tested release and frozen
for deployment, avoiding unrelated in-progress Studio source changes. All public
frontend file hashes matched; Netlify's generated configuration file is separate.
The final release uses production environment configuration.

Deployed checks confirmed public pages, redirects, 404/private headers, responsive
layouts, three playable eight-second demo WAVs, unauthenticated report rejection,
discarded draft measurements and active analytics rate limiting. All ten new
routes have live canonical HTML and sitemap coverage. Production rejects
cross-origin/malformed metrics. No synthetic analytics events were recorded.
All 167 tests in the 16 focused server/measurement suites passed after the runtime
fix; focused ESLint also passed. Studio booking remains disabled pending working
email/SMS providers. Google verification, Business Profile owner access, confirmed
shop hours and the authenticated hosting firewall review remain outstanding.

```sh
npm run build
npm run test:seo
npm run type-check
npx vitest run tests/netlify-functions src/utils/siteMetrics.test.js src/utils/siteMeasurement.test.js src/utils/seo.test.jsx --maxWorkers=2
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/qualify-music-resources.mjs
```

For reproducible tool screenshots, run `scripts/capture-tool-reference.mjs`
against the local app. `scripts/capture-separator-demo.mjs` uses genuine HTDemucs
inference; run it against a stable production preview server to avoid dev HMR
interruptions. Do not substitute fake output states or change analysis labels.

## Primary References

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI crawler purposes](https://developers.openai.com/api/docs/bots)
- [Google: Search Console ownership verification](https://support.google.com/webmasters/answer/9008080)
- [Google: Business Profile representation guidelines](https://support.google.com/business/answer/3038177)
- [Netlify function rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)
- [MDN: Web MIDI browser and security requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API)
