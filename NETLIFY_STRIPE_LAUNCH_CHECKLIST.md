# Netlify + Stripe Launch Checklist

Use this checklist before pointing the live domain at the site.

## 1. Netlify environment variables

Set these in Netlify → Site configuration → Environment variables:

- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_SENTRY_DSN` (optional but recommended)
- `VITE_CHECKOUT_URL` (optional; only needed if checkout is hosted somewhere other than the same Netlify site)
- `VITE_API_URL` (optional fallback; not needed if using the Netlify function route)
- `VITE_CHECKOUT_STATUS_URL` (optional; only needed if checkout verification is hosted somewhere other than the same Netlify site)
- `RESEND_API_KEY` (optional; only needed for business order emails)
- `ORDER_NOTIFICATION_EMAIL` (optional order-alert recipient)
- `ORDER_NOTIFICATION_FROM` (optional verified sender address)
- `ORDER_LOOKUP_TOKEN` (optional admin API token for stored-order lookup)

## 2. Stripe dashboard setup

- Create or confirm a live Stripe account
- Add your production domain to allowed origins if needed
- Verify business details, payout account, and public support info
- Review checkout branding so Stripe matches the Sattari storefront
- Add a webhook endpoint in Stripe pointing to `/api/stripe-webhook`
- Subscribe at minimum to `checkout.session.completed`
- Copy the Stripe signing secret into `STRIPE_WEBHOOK_SECRET` in Netlify
- Verify the sending domain in Resend if you want order alert emails

## 3. Netlify function routing

- Confirm [netlify.toml](netlify.toml) includes redirects for create-session, session-status, and Stripe webhook routes
- Confirm [netlify.toml](netlify.toml) includes the admin order lookup route if you plan to use it
- Confirm the function directory is `netlify/functions`
- Redeploy after changing any Stripe environment variable
- Remember that completed orders are stored in a Netlify Blobs store named `orders`

## 4. Production verification flow

- Open the deployed homepage
- Visit the shop, a category page, and at least one product page
- Add a product to cart
- Start checkout and confirm redirect to Stripe Checkout
- Confirm success and cancel URLs return to the correct site routes
- Complete a test payment and confirm the success page shows a verified payment state
- Confirm Stripe delivers `checkout.session.completed` successfully to the webhook endpoint
- If notification env vars are configured, confirm the order alert email arrives
- If `ORDER_LOOKUP_TOKEN` is configured, confirm `/api/admin/orders` returns recent order summaries with a valid bearer token

## 5. SEO verification

- Confirm page titles and descriptions update on Home, Shop, Category, Product, and Services pages
- Confirm product pages output JSON-LD product schema
- Submit the sitemap to Google Search Console after launch

## 6. Final content check

- Verify phone number, Instagram link, and location are correct
- Replace any remaining placeholder service copy if needed
- Confirm pricing, product names, and product images match the real catalog

## 7. Post-launch monitoring

- Watch Netlify function logs for checkout errors
- Watch Stripe dashboard for failed payment attempts
- Watch Sentry for runtime issues after launch

## Recommended launch order

1. Set environment variables
2. Trigger a fresh Netlify deploy
3. Test checkout end-to-end
4. Verify metadata and structured data
5. Connect domain if everything passes