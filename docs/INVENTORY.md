# Stock tracking & staff product editing

Adds two things to the existing site: the storefront shows **Out of stock** and
refuses to sell what isn't there, and employees can edit stock and listings from
a password-protected page.

Nothing here uses a separate inventory app or a database. Data lives in Netlify
Blobs, which this repo already used for orders and service inquiries.

---

## Setting it up

**1. Generate the staff credentials:**

```bash
node scripts/hash-staff-password.mjs "a-real-password-you-choose"
```

It prints three values. Set them in **Netlify → Site configuration →
Environment variables**:

| Variable | What it is |
| --- | --- |
| `STAFF_PASSWORD_SALT` | Salt for the password hash |
| `STAFF_PASSWORD_HASH` | scrypt hash — the password itself is never stored |
| `STAFF_SESSION_SECRET` | Signs session tokens. Changing it signs everyone out immediately, which is your fastest revocation. |

**2. Deploy.** Functions read these at runtime, so they need a deploy after the
variables are set.

**3. Open the staff page:** `https://sattarimusic.com/staff-cc6436694e.html`

Bookmark it. It is not linked from anywhere.

---

## How it fits together

```
Staff page  ──▶  /api/staff/*  ──▶  Netlify Blobs  ◀──  Storefront (/api/inventory)
(password)       (auth'd)           inventory: stock
                                    catalog:   employee edits
                      ▲             catalog-images: photos
              Stripe webhook
           (decrements on sale)
```

`src/data/catalog.js` stays the base catalog. The blob holds only what employees
changed — overrides, additions, and a hidden flag. They are merged at read time
by `src/utils/catalogMerge.js`, which runs both in the browser and in
`create-checkout-session`, so the price shown is the price charged.

### Stock keys

Stock is per **variant**, not per product: `slug::size::color`. A 15" and a 17"
cymbal are different physical items. `src/utils/inventory.js` owns this.

**A variant with no entry is "not tracked", which reads as available.** That is
what let this ship without the whole catalog going dark — employees opt each
item in by entering a count. Untracking a variant deletes its key rather than
storing zero.

---

## Rules that are load-bearing

1. **Stock is enforced in `create-checkout-session`, not in the UI.** The badge
   is a courtesy; anyone can POST to the endpoint directly.

2. **Prices are read server-side from the merged catalog.** Never trust a price
   in a request body.

3. **The webhook decrements inside the existing `if (!existingOrder)` guard.**
   Stripe retries webhooks; a decrement outside it would subtract twice.

4. **Storefront reads fail open, login fails closed.** A blob outage costs stock
   badges, not sales — but if the throttle can't be read, sign-in is refused,
   because otherwise password guessing is unbounded.

5. **The login throttle lives in a blob, not in memory.** A module-level `Map`
   silently does nothing on Netlify: each invocation may get fresh memory. Its
   expiry keys on the last failure, never on `until` — an unlocked record has
   `until = 0`, so an `until`-based check clears the counter every attempt.

6. **The staff path is never named in `robots.txt` or `sitemap.xml`.** Both are
   public files. `netlify.toml` sets `X-Robots-Tag: noindex` on that path
   instead.

7. **The staff page is a standalone file in `public/`, not a React route.**
   Routes in `App.tsx` ship to every visitor in the JS bundle. This one doesn't
   appear in the bundle at all. The URL is still only friction — the password
   is the lock.

8. **Removing a product sets a hidden flag.** Nothing is deleted, so a misclick
   is one click from undone.

9. **Categories are a closed set.** A product in an invented category would
   appear on no category page and would crash the detail page's copy lookup.

---

## Known limits

- **The oversell race is open.** Stock is checked when the checkout session is
  created and decremented when payment completes. Two customers can both pass
  the check on the last item and both pay. Closing it needs stock reservations
  with expiry — deliberately not built. At this volume it is rare; handle it by
  emailing the customer.

- **The counter depends on the internet.** Data lives in Netlify, so an outage
  at the shop means no stock lookups until it's back.

- **Sizes and colors can't be edited from the staff page yet.** You can edit
  name, category, price, description, and photo. Products with per-size pricing
  show their base price only; changing size prices still means editing
  `catalog.js`.

- **`node_modules` is committed to this repo** (it predates this work, which is
  why `.gitignore` looks like it isn't working). Worth removing with
  `git rm -r --cached node_modules` at some point — unrelated to inventory, but
  it makes every diff noisy.

---

## Cost notes

Bandwidth is the largest recurring credit line. Two things already account for
it: the staff page shrinks photos in the browser before upload, and uploaded
images are served with a one-year immutable cache (keys are random per upload,
so they're safe to cache hard).

Production deploys cost 15 credits each — batch them and test with
`netlify dev` rather than deploying to check a change.
