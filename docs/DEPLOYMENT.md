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
- **Node version:** 20.x (in netlify.toml or site settings)

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
ORDER_LOOKUP_TOKEN=choose-a-long-random-secret
```

## Step 4: Configure Checkout

### Default: Netlify Function

The project already includes [netlify/functions/create-checkout-session.js](netlify/functions/create-checkout-session.js) and a redirect in [netlify.toml](netlify.toml) so `/api/create-checkout-session` works on the deployed site.

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

Optional admin lookup setting:

```env
ORDER_LOOKUP_TOKEN=choose-a-long-random-secret
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

Subscribe at minimum to:

- `checkout.session.completed`

Then copy the Stripe signing secret into `STRIPE_WEBHOOK_SECRET` in Netlify.

### Order Persistence

Completed orders are stored in a Netlify Blobs store named `orders` when the webhook receives a verified `checkout.session.completed` event. No extra site-level configuration is required on Netlify for this storage path.

For local development with `npm run dev:api`, completed webhook events are also written to `.local-data/orders/` unless `LOCAL_ORDER_STORAGE_PATH` overrides that location.

### Admin Order Lookup

When `ORDER_LOOKUP_TOKEN` is configured, admins can inspect stored orders without opening Netlify internals:

```bash
curl -H "Authorization: Bearer $ORDER_LOOKUP_TOKEN" \
   https://your-domain.com/api/admin/orders

curl -H "Authorization: Bearer $ORDER_LOOKUP_TOKEN" \
   "https://your-domain.com/api/admin/orders?session_id=cs_test_123"
```

## Step 5: Deploy Frontend

```bash
# Push code to main branch (or configured branch)
git push origin main

# Netlify automatically builds and deploys
# Monitor build in Netlify dashboard
```

Monitor deployment:
- Check **Deployments** tab for build progress
- View build logs for any errors
- Check deployment preview URL

## Step 6: Post-Deployment

### Verify Production
1. Visit https://sattarimusic.com (or your domain)
2. Test navigation
3. Test adding items to cart
4. Test checkout (use Stripe test card: 4242 4242 4242 4242)
5. Confirm the success page shows a verified payment state
6. Confirm Stripe webhook deliveries succeed
7. If notifications are configured, confirm the business email arrives
8. Verify meta tags and SEO

### Test Stripe
- Use test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC
- Check Stripe dashboard for test transactions

### Monitor Errors
1. Setup Sentry at [sentry.io](https://sentry.io)
2. Create React project
3. Add DSN to environment variables
4. Verify error tracking is working

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

Pushes to `main` branch will automatically deploy.

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

**Last Updated:** April 23, 2026  
**Production URL:** https://sattarimusic.com
