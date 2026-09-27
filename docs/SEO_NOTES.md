# Sattari Search Setup

See `SEARCH_GROWTH.md` for the new question-led guides, tool reference pages,
real demonstrations, opt-in referral measurement, and remaining Google setup.

## Search Intent

| Search intent | Primary page |
| --- | --- |
| Music store in Woodland Hills | `/` and `/woodland-hills-music-store` |
| Music store near Encino | `/encino-music-store` |
| Music store near Calabasas | `/calabasas-music-store` |
| Woodland Hills drum shop, cymbals, sticks and practice pads | `/woodland-hills-drum-shop` |
| Violin shop near Encino, first violin and acoustic/electric comparison | `/encino-violin-shop` |
| Los Angeles instruments and music services | `/los-angeles-music-store` |
| Buy cymbals, drumsticks, violins, guitars or accessories | `/shop` and category/product pages |
| Local instrument repair, rentals and lessons | `/services` and individual service pages |
| Los Angeles instrument repair shop | `/services/instrument-repair-los-angeles` |
| Violin repair and setup near Encino and Woodland Hills | `/services/violin-repair-los-angeles` |
| Guitar and bass setup for Woodland Hills and Calabasas players | `/services/guitar-setup-los-angeles` |
| Online stem separator, vocal remover, song key and BPM finder | `/stem-separator` |
| Browser DAW, StemDeck, music arrangement and recording | `/studio` |
| Song key, chord and tempo analysis for practice | `/learn` |

The business has one stated location: 4881 Topanga Canyon Blvd #202,
Woodland Hills, CA 91364. Encino and Calabasas are service areas, not additional
storefronts. Telephone: (424) 465-3020. No opening hours, reviews, star ratings,
travel times, or availability guarantees were invented for structured data.

## Technical Implementation

- Short, distinct titles and descriptions; canonical, Open Graph and social tags.
- One shared MusicStore identity with address, telephone and service areas.
- Product/collection, breadcrumb, service and music-tool WebApplication data.
- Actual React routes rendered at build time, including body content and metadata.
- Build-generated sitemap includes public categories and current product URLs;
  aliases, cart, checkout, callback and error pages are excluded.
- Permanent redirects consolidate service aliases and the common
  `/stem-seperator` misspelling. Unknown paths return a 404 on Netlify.
- New staff-added products retain a client-rendered fallback with no incorrect
  homepage canonical. The live shop still refreshes inventory normally.

Run `npm run build`, `npm run test:seo`, `npm run type-check` and the Vitest suite
before release. The prerender step reads the public production inventory API.
If it falls back to the built-in catalog, it emits a warning; review it before
publishing because hidden products, prices and stock can differ. Republish after catalog/stock changes
to refresh initial HTML and the sitemap; runtime inventory still updates in the
browser. Do not commit `dist` or build snapshots.

## Local Search Refresh

The September 2026 refresh adds four focused pages, not a city-by-instrument
matrix. Drum shoppers get practice-setup and cymbal-selection guidance; violin
shoppers get beginner requirements and acoustic/electric comparisons. Repair
pages explain what information to send, assessment before quotes, and scheduling
limitations. Catalog recommendations read the current inventory rather than
maintaining a second stock list. No full-kit availability or same-day repairs
are promised.

Core pages, catalog categories and existing local pages now have more focused
titles, descriptions and headings. Category pages link to relevant local help;
local-page recommendations match their subject instead of always showing the
first six entries. FAQs are visible and match their JSON-LD. All pages reference
the same Woodland Hills business. `/shop/violins-los-angeles` still canonicalizes
to `/shop/violins`; do not reintroduce it into the sitemap.

Validation for this refresh:

- Production build with a successful live-inventory read: 70 canonical public URLs.
- `npm run test:seo`: generated HTML, sitemap, unique metadata, canonical URLs,
  structured data, incoming links, image files and private-page exclusions.
- `npx vitest run src/utils/seo.test.jsx src/components/LocalSeoPage.test.jsx src/components/AboutPage.test.jsx`:
  32 passing tests, including inventory visibility and matching FAQ content.
- `node scripts/qualify-local-seo.mjs`: 66 desktop/mobile checks at 320, 390 and
  1440 pixels, both themes, working FAQs/inquiry anchors and client-side navigation.

This refresh has not been published. After deployment, inspect the four new
URLs in Search Console and monitor actual search terms and inquiries. Do not
claim rankings, search volume or indexed status from the local checks.

## Owner Actions

1. Verify the `sattarimusic.com` domain in Google Search Console, then submit
   `https://sattarimusic.com/sitemap.xml` after deployment. Inspect the home,
   Encino, services and Stem Separator URLs and request indexing.
2. Claim or update the real Woodland Hills Google Business Profile. Match the
   site's name, address, phone and website. Confirm actual hours, services and
   current shop photos; do not create additional profiles for nearby cities.
3. Ask customers for honest reviews without incentives or filtering out unhappy
   customers. Publish genuinely useful instrument advice, repair examples and
   product comparisons as material becomes available.
4. Review Search Console impressions, search terms, clicks, indexed pages and
   leads. Tune copy from actual demand, not assumed search-volume numbers.

These changes improve eligibility and clarity, not guaranteed positions or
indexing dates. Search Console and Business Profile changes require owner access
and have not been performed by this code change.

## References

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google local-business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Google Search Essentials](https://developers.google.com/search/docs/essentials)
- [Google title-link guidance](https://developers.google.com/search/docs/appearance/title-link)
- [Google spam policies, including doorway abuse](https://developers.google.com/search/docs/essentials/spam-policies)
