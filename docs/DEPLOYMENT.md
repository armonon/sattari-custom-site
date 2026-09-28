# Deployment Guide - Sattari Music

This guide covers deploying Sattari Music to production on Netlify using the current built-in checkout function flow.

## Pre-Deployment Checklist

- [ ] All required environment variables configured in Netlify
- [ ] Stripe keys (both public and secret) verified
- [ ] Sentry account created and DSN added
- [ ] All tests passing (`npm run test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Product images optimized
- [ ] Meta descriptions and Open Graph images ready

## Step 1: Prepare Repository

```bash
# Ensure all code is committed
git status

# Create deployment branch
git checkout -b deploy/production

# Run final checks
npm run type-check
npm run lint
npm run test
npm run build
```

## Step 2: Setup Netlify

### Create Netlify Account
1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub account
3. Authorize Netlify to access your repositories

### Connect Repository
1. Click "New site from Git"
2. Choose "GitHub"
3. Select `sattari-custom-site` repository
4. Choose main branch (or preferred branch)

### Configure Build Settings
- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node version:** 22.x (pinned in `netlify.toml`; Node 20 reached end of life on 2026-04-30)

## Step 3: Set Environment Variables

In Netlify dashboard, go to **Site settings → Build & deploy → Environment**

Add these variables:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

VITE_SENTRY_DSN=https://[key]@[domain].ingest.sentry.io/[id]

VITE_CHECKOUT_URL=
VITE_CHECKOUT_STATUS_URL=
VITE_API_URL=

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
ORDER_NOTIFICATION_EMAIL=orders@example.com
ORDER_NOTIFICATION_FROM=orders@your-domain.com
IP_HASH_SECRET=choose-a-long-random-secret
```

Optional automatic rebuilds: product pages and the sitemap are rendered at build
time, so catalog edits, stock changes that sell an item out or bring it back,
restores, and sales of the last unit request a rebuild. One rebuild runs once
changes have been quiet for 5 minutes, at most once an hour. Set
`BUILD_HOOK_URL` to the Build & Deploy workflow's dispatch endpoint
(`https://api.github.com/repos/<owner>/<repo>/actions/workflows/build-deploy.yml/dispatches`)
and `BUILD_HOOK_TOKEN` to a fine-grained GitHub token for this repository with
"Actions: Read and write", so the rebuild goes through the release gate like
any deploy. (A Netlify build hook works only if you deploy from Netlify builds,
see Step 5.) Each rebuild uses CI minutes and a deploy.

Staff sign-in (`STAFF_*`), studio bookings (`STUDIO_BOOKING_*`, `TWILIO_*`) and
the Instagram feed have their own variables; `.env.example` lists every variable
with what it does, and [INVENTORY.md](INVENTORY.md) covers staff setup.

## Step 4: Configure Checkout

### Default: Netlify Function

Every function in [netlify/functions](../netlify/functions) is a Netlify v2 function that declares its own URLs in `config.path` (and schedules in `config.schedule`), so `/api/create-checkout-session` works on the deployed site without configuration. `netlify.toml` has no `/api` redirects on purpose.

Required for this flow:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Optional notification settings:

```env
RESEND_API_KEY=re_...
ORDER_NOTIFICATION_EMAIL=orders@example.com
ORDER_NOTIFICATION_FROM=orders@your-domain.com
```

Optional overrides:

```env
VITE_CHECKOUT_URL=https://your-external-checkout-endpoint
VITE_CHECKOUT_STATUS_URL=https://your-external-status-endpoint
VITE_API_URL=https://your-api-base-url
```

Use `VITE_CHECKOUT_URL`, `VITE_CHECKOUT_STATUS_URL`, or `VITE_API_URL` only if you intentionally want checkout to run somewhere other than the same Netlify site.

### Stripe Webhook

In the Stripe dashboard, add a webhook endpoint that points to:

```text
https://your-domain.com/api/stripe-webhook
```

Subscribe to all four of these — stock holds and bank-transfer-style payments
depend on them:

- `checkout.session.completed`
- `checkout.session.expired` (releases the stock an unpaid checkout was holding)
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Then copy the Stripe signing secret into `STRIPE_WEBHOOK_SECRET` in Netlify.
A restricted Stripe key needs write access to Checkout Sessions (checkout both
creates and expires them).

### Order Persistence

Orders are stored in a Netlify Blobs store named `orders`, one record per
checkout, claimed when the webhook first sees the session. Stock and the owner
email are tracked as steps on that record, so retried or duplicate Stripe
deliveries complete only what is still pending. The scheduled
`checkout-maintenance` function (every 10 minutes, production deploys only)
releases lapsed stock holds and retries pending owner emails. No extra
site-level configuration is required on Netlify for this storage.

The webhook answers 200 once an order and its stock are saved; failed owner
emails are retried by `checkout-maintenance`. That sweep also records completed
checkouts from the last 72 hours that have no order (in case webhooks were
down), and parks orders that fail 6 times in a row: they are retried daily and
shown on the staff page's Orders tab.

For local development, `npm run dev:api` runs the same functions and keeps Blobs
on disk in `.local-data/blobs/` (override with `LOCAL_BLOBS_PATH`).

### Admin Order Lookup

`/api/admin/orders` takes a staff session token (from signing in on the staff
page, or `POST /api/staff/login`), so access expires and can be revoked:

```bash
curl -H "Authorization: Bearer $STAFF_TOKEN" \
   https://your-domain.com/api/admin/orders

curl -H "Authorization: Bearer $STAFF_TOKEN" \
   "https://your-domain.com/api/admin/orders?session_id=cs_test_123"
```

### Rate limits

Netlify allows 2 code-based rate-limit rules per project on Free/Starter/Personal
plans (5 on Pro). They are used on `site-event` and `service-inquiry`; a test
fails if more are added. Sign-in, bookings, the Instagram feed and admin lookups
enforce their own limits in code.

## Step 5: Deploy

Production has exactly one deploy path: **GitHub Actions** (Step 9). On a push to
`main` it runs the full release gate, then uploads that exact qualified build
with `netlify deploy --prod --no-build`. The **Run workflow** button on the
workflow page repeats this on demand.

Netlify's own production builds are switched off in code: the `ignore` command
in `netlify.toml` skips a Netlify build in the production context, so a Git push
cannot race the qualified deploy with an unqualified build. Deploy previews and
branch deploys still build on Netlify.

To deploy from Netlify builds instead, set `NETLIFY_PRODUCTION_BUILDS=on` in the
Netlify site's environment variables **and** remove the `deploy` job (or the
`NETLIFY_AUTH_TOKEN` secret) from GitHub, so only one path remains.

```bash
git push origin main   # GitHub Actions tests, qualifies and deploys
```

Monitor deployment:
- **GitHub → Actions → Build & Deploy** for the gate and the deploy job
- **Netlify → Deploys** shows the published deploy ("Deploy from GitHub Actions")
- Netlify shows production Git builds as skipped by the ignore command; that is expected

## Step 6: Post-Deployment

### Verify Production
1. Open `/api/inventory` and confirm it reports `"consistency": "strong"`; in
   **Logs → Functions**, confirm the three scheduled functions appear
   (`checkout-maintenance`, `nightly-backup`, `studio-booking-maintenance`)
1. Visit https://sattarimusic.com (or your domain)
2. Test navigation
3. Test adding items to cart
4. Test checkout (use Stripe test card: 4242 4242 4242 4242)
5. Confirm the success page shows a verified payment state
6. Confirm Stripe webhook deliveries succeed
7. If notifications are configured, confirm the business email arrives
8. Verify meta tags and SEO

### Security headers

`netlify.toml` sets `nosniff`, a Permissions-Policy (microphone and MIDI only on
this site, for the Studio), and blocks other sites from framing any page. The
staff page gets a strict, enforced Content-Security-Policy.

The site-wide Content-Security-Policy starts in **report-only** mode: browsers
log what it would block without blocking anything. After deploying, open the
home page, shop, a product page, the cart, a checkout, `/services` (map),
`/learn`, `/studio` (load a track, record, export) and `/stem-separator` in
Chrome or Firefox (Safari ignores a report-only policy that has no reporting
endpoint), and check the DevTools console for `Content-Security-Policy-Report-Only`
violations. When there are none, rename the header in `netlify.toml` from
`Content-Security-Policy-Report-Only` to `Content-Security-Policy` to enforce it.
If you change the inline theme script in `index.html` or the staff page's
script, `tests/security-headers.test.js` prints the new hash to put in
`netlify.toml`.

### Test Stripe
- Use test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC
- Check Stripe dashboard for test transactions

### Monitor Errors
1. Setup Sentry at [sentry.io](https://sentry.io)
2. Create React project
3. Add DSN to environment variables (`VITE_SENTRY_DSN`, then redeploy)
4. Verify error tracking is working

The Sentry SDK (v11) loads once the page is idle, so it never delays a page's
first render; errors raised before then are queued and sent when it loads.
Without `VITE_SENTRY_DSN` it is never downloaded. Reports are grouped by route
(`/product/:slug`), not by every URL (`src/utils/monitoring.ts`).

### Setup Analytics
- Add Google Analytics tag (optional)
- Monitor user behavior and conversions
- Track key metrics (checkout completion, errors, etc.)

## Step 7: Configure Custom Domain

1. In Netlify, go to **Site settings → Domain management**
2. Click "Add custom domain"
3. Enter your domain (e.g., sattarimusic.com)
4. Follow DNS setup instructions
5. Point DNS records to Netlify nameservers

## Step 8: Setup HTTPS

Netlify automatically provisions SSL certificates. HTTPS is enabled by default.

## Step 9: Setup CI/CD

GitHub Actions pipeline is configured in `.github/workflows/build-deploy.yml`

For automatic deployments:
1. Generate Netlify auth token: https://app.netlify.com/user/applications
2. Get Site ID: Site settings → General → Site ID
3. Add to GitHub Secrets:
   - `NETLIFY_AUTH_TOKEN`
   - `NETLIFY_SITE_ID`

Pushes to `main` deploy automatically after the release gate passes; this is the
only production deploy path (see Step 5).

## Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Verify all environment variables are set
- Ensure Node version is compatible
- Check for missing dependencies

### Checkout Not Working
- Check Netlify function logs first
- Verify `STRIPE_SECRET_KEY` is set in Netlify
- Verify `VITE_CHECKOUT_URL`/`VITE_API_URL` are not accidentally overriding the built-in function route
- Verify Stripe keys are valid
- If using an external API, then check CORS settings there

### SEO Issues
- Verify meta tags in index.html
- Check robots.txt and sitemap.xml
- Test with Google Search Console
- Submit sitemap to search engines

### Performance Issues
- Check Netlify analytics
- Use Lighthouse in Chrome DevTools
- Optimize large images
- Consider CDN for images

## Rollback

If deployment has issues:

```bash
# Rollback to previous deployment
# In Netlify dashboard:
# 1. Go to Deployments tab
# 2. Find previous successful deployment
# 3. Click "Restore this deployment"
```

Or via git:
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Netlify will redeploy
```

## Monitoring & Maintenance

### Weekly
- Monitor error rates in Sentry
- Check Stripe for failed transactions
- Review analytics

### Monthly
- Update dependencies: `npm outdated`
- Audit for security issues: `npm audit`
- Review performance metrics

### Quarterly
- Full security audit
- Update Node version if needed
- Optimize bundle size

## Support

For deployment issues:
1. Check Netlify documentation
2. Review build logs
3. Check environment variables
4. Verify API connectivity
5. Monitor error tracking service

---

**Last Updated:** September 28, 2026  
**Production URL:** https://sattarimusic.com
