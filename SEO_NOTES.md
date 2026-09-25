# Sattari Search Setup

See `SEARCH_GROWTH.md` for the new question-led guides, tool reference pages,
real demonstrations, opt-in referral measurement, and remaining Google setup.

## Search Intent

| Search intent | Primary page |
| --- | --- |
| Music store in Woodland Hills | `/` and `/woodland-hills-music-store` |
| Music store near Encino | `/encino-music-store` |
| Music store near Calabasas | `/calabasas-music-store` |
| Los Angeles instruments and music services | `/los-angeles-music-store` |
| Buy cymbals, drumsticks, violins, guitars or accessories | `/shop` and category/product pages |
| Local instrument repair, rentals and lessons | `/services` and individual service pages |
| Online stem separator, vocal remover, batch audio separation | `/stem-separator` |
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
before release. The prerender step reads the public production inventory API and
fails if it cannot get a valid snapshot. Republish after catalog/stock changes
to refresh initial HTML and the sitemap; runtime inventory still updates in the
browser. Do not commit `dist` or build snapshots.

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
