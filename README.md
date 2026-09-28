# Sattari Music — sattarimusic.com

The website of Sattari Music, a musician-owned music store in Woodland Hills, Los Angeles:

- **Shop** — instruments and gear with Stripe Checkout, live stock, and a staff page for stock, listings, photos, orders, inquiries and backups.
- **Local services** — repairs, rentals, lessons, rehearsal and studio bookings, with local landing pages.
- **Sattari Hub** — free browser music tools:
  - **StemDeck** (`/studio`): a four-deck stem DJ and arranger, the browser port of the native StemDeck app.
  - **Learn** (`/learn`) and an in-browser **stem separator** (`/stem-separator`).

Vite + React 18, prerendered to static HTML and hosted on Netlify (Functions, Edge Functions, Blobs, scheduled functions).

## Quick start

```bash
npm install
cp .env.example .env      # every variable is documented there
npm run dev               # site at http://localhost:5173
npm run dev:api           # optional: the production API functions on :4242, with Netlify Blobs on disk
```

Stripe test mode works with card `4242 4242 4242 4242`. The staff page is at
`/staff-cc6436694e.html`; create its credentials with
`node scripts/hash-staff-password.mjs "username"` (it asks for the password).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:api` | Runs the real Netlify functions on the same `/api` paths, Blobs on disk (`LOCAL_BLOBS_PATH`) |
| `npm run build` | Production build, then prerenders every route and writes the sitemap |
| `npm run type-check` / `npm run lint` | TypeScript (strict, `.ts`/`.tsx` only) and ESLint + Prettier |
| `npm test` | All unit and function tests (Vitest). The Studio UI suites are heavy: on a busy machine use `npx vitest run --maxWorkers=1` |
| `npm run test:seo` | Checks the prerendered pages' titles, canonicals, structured data and sitemap |
| `npm run test:studio-release` | The full release gate (lint, unit, types, loudness and tempo qualification, build, prerender, browser QA, soak). Needs a clean, committed tree |

CI (`.github/workflows/build-deploy.yml`) runs the release gate on pushes and pull
requests to `main` and `develop`, and deploys the exact qualified build from `main`.

## Where things live

```
src/
  pages/, components/        storefront and tool pages
  components/studio/         StemDeck UI components (decks, library, arranger, master)
  studio/                    StemDeck app modules: session/, transport/, mixer/, hooks/, views/, arrangement/
  context/, hooks/           cart, inventory, checkout
  utils/                     audio + arrangement engines, performance capture/replay, checkout, inventory, SEO
  data/                      catalog, SEO copy, shipping
netlify/functions/           API: checkout, Stripe webhook, inventory, staff-*, bookings, inquiries, maintenance
netlify/edge-functions/      404 status for unknown product URLs
server/                      shared server modules; checkout-server.js powers `npm run dev:api`
scripts/                     prerender, SEO checks, browser QA harnesses, release gate
tests/netlify-functions/     function tests (component and util tests sit next to their code)
docs/                        operational docs; docs/notes/ holds dated engineering logs
```

## Shop and operations

- **Checkout.** Prices come from the server-side merged catalog, never the request. Checkout reserves stock for 31 minutes, and the webhook completes each order step (stock, owner email) exactly once. See [docs/INVENTORY.md](docs/INVENTORY.md).
- **Stripe webhook events.** It needs `checkout.session.completed`, `.expired`, `.async_payment_succeeded` and `.async_payment_failed`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Staff sign-in.** Sessions expire after 12 hours and can be revoked, one at a time or everywhere. Admin order lookups (`/api/admin/orders`) use the same staff session.
- **Studio bookings.** See [docs/STUDIO_BOOKINGS.md](docs/STUDIO_BOOKINGS.md).
- **Rate limits.** Netlify allows two code-based rate-limit rules on Free/Personal plans. They're on `site-event` and `service-inquiry`, and a test keeps it that way; the other public endpoints enforce limits in code.
- **Launch checklist.** [docs/NETLIFY_STRIPE_LAUNCH_CHECKLIST.md](docs/NETLIFY_STRIPE_LAUNCH_CHECKLIST.md).

## StemDeck (`/studio`)

- **Perform:** four decks with stems, beat sync, key lock, cues and loops, pads and XY effects.
- **Arrange:** multitrack clips, automation, instruments, and capture/replay of whole performances with WAV export.
- **Library:** your local music collection.
- **Mixer dock** (`M` or `F9`, under any workspace): a strip for every deck and arrangement track, two send returns (A: reverb, B: tempo-synced delay), and the master with limiter gain reduction. Each strip has peak/RMS meters with a clip light. Decks get an insert chain that uses the arranger's effects; tracks open their devices in Arrange. "Meters" mode shrinks the dock to meters only. Headphone cue can be off, split (program left, cue right) or outputs 3–4 on a 4-channel interface. Cue and the output device are saved on this device, not in the project.

Sends, returns and inserts are recorded in performance takes and replayed. Arrangement playback and WAV export render the returns too. Return buses are built on first use, so a mix without sends renders exactly as it did before the mixer existed.

Everything runs locally in the browser. Audio lives in IndexedDB and project files save to disk.

Release qualification follows [docs/STABLE_CANDIDATE_PROTOCOL.md](docs/STABLE_CANDIDATE_PROTOCOL.md).

## Notes

- Most of the codebase is JavaScript/JSX and is not type-checked. TypeScript strict covers the `.ts`/`.tsx` files only.
- `public/downloads/` holds the Sattari audio-plugin installers served from `/downloads`.
