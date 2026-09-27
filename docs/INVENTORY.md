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
node scripts/hash-staff-password.mjs "username" "a-real-password-you-choose"
```

It prints four values. Set them in **Netlify → Site configuration →
Environment variables**:

| Variable | What it is |
| --- | --- |
| `STAFF_USERNAME` | The sign-in name |
| `STAFF_PASSWORD_SALT` | Salt for the password hash |
| `STAFF_PASSWORD_HASH` | scrypt hash — the password itself is never stored |
| `STAFF_SESSION_SECRET` | Signs session tokens. Changing it signs everyone out. |

Sign-ins last 12 hours. **Sign out** on the staff page revokes that sign-in on
the server; **Sign out everywhere** revokes every sign-in at once without a
redeploy.

**2. Deploy.** Functions read these at runtime, so they need a deploy after the
variables are set.

**3. Open the staff page:** `https://sattarimusic.com/staff-cc6436694e.html`

Bookmark it. It is not linked from anywhere.

---

## How it fits together

```
Staff page  ──▶  /api/staff/*  ──▶  Netlify Blobs  ◀──  Storefront (/api/inventory)
(password)       (auth'd)           inventory: stock + checkout holds
                                    catalog:   employee edits
                      ▲             catalog-images: photos
                      │             orders:    one record per checkout
   create-checkout-session (reserves)   Stripe webhook (hold → sale)
   checkout-release (abandoned)         checkout-maintenance (every 10 min)
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

2. **Checkout reserves stock.** Creating a Checkout Session writes a *hold* into
   the stock blob in the same conditional write that checks availability, and
   the Stripe session expires after 31 minutes. Available = on hand − active
   holds, everywhere (`/api/inventory` and checkout). A second shopper going for
   the last unit gets a 409 while the first is paying. The hold becomes a sale
   when Stripe reports payment, and is released by `checkout.session.expired`,
   by the cancel link (`/api/checkout-release`), when the same browser starts a
   new checkout, or by the 10-minute sweep 15 minutes after its session ends.

3. **Prices are read server-side from the merged catalog.** Never trust a price
   in a request body. If the catalog can't be read, checkout returns 503 rather
   than selling from the base catalog.

4. **The webhook is exactly-once per step.** The order record is claimed with a
   create-only write before any side effect, and tracks two steps: stock
   (hold → sale, leaving a "sold" marker) and the owner email. Stripe retries and
   duplicate deliveries finish only the steps still pending, so a crash midway
   is repaired by the next delivery or the sweep, and nothing happens twice.
   Only `paid` / `no_payment_required` sessions become sales; async payments
   complete on `async_payment_succeeded` and release on `async_payment_failed`.

5. **Storefront reads fail open, login fails closed.** A blob outage costs stock
   badges, not sales — but if the throttle can't be read or written, sign-in is
   refused, because otherwise password guessing is unbounded.

6. **The login throttle lives in blobs, not in memory,** and counts an attempt
   *before* the password is checked, so parallel requests can't slip past it.
   Each address has its own record (keyed by an HMAC of the IP), with a
   site-wide ceiling on top; addresses that signed in recently are exempt from
   the ceiling so an attacker can't lock the shop out.

7. **The staff path is never named in `robots.txt` or `sitemap.xml`.** Both are
   public files. `netlify.toml` sets `X-Robots-Tag: noindex` on that path
   instead.

8. **The staff page is a standalone file in `public/`, not a React route.**
   Routes in `App.tsx` ship to every visitor in the JS bundle. This one doesn't
   appear in the bundle at all. The URL is still only friction — the password
   is the lock.

9. **Removing a product sets a hidden flag.** Nothing is deleted, so a misclick
   is one click from undone. A hidden product left in someone's cart is removed
   with a notice; checkout answers `409 product_unavailable` for it.

10. **Categories are a closed set.** A product in an invented category would
    appear on no category page and would crash the detail page's copy lookup.

---

## Orders & fulfilment

The **Orders** tab shows what sold, plus revenue by window. Orders are written
by the Stripe webhook the moment payment is confirmed; the dashboard reads that
same store, so there is no second source of truth.

**Fulfilment is stored separately from the order record**, in its own blob. An
order record is what Stripe told us happened; fulfilment is what the shop did
about it. Keeping them apart means re-reading an order from Stripe can never
wipe the fact that it shipped, and a fulfilment bug can never corrupt a payment
record.

Statuses: `new` → `packed` → `shipped` (with tracking) or `collected`, plus
`cancelled`. **There are deliberately no transition rules.** Shops hit
out-of-order cases constantly — a shipped order comes back, a pickup becomes a
delivery — and blocking them just teaches staff to work around the tool. Every
change records who made it and when, and the last 20 changes are kept, so the
sequence is always recoverable.

Marking an *unpaid* order shipped or picked up asks for confirmation first.

**Oversold orders are flagged, never silent.** Holds make this rare, but if a
paid order still can't be covered (for example, stock was lowered by hand while
the customer paid), the order records which items were short, the staff page
shows a red **Oversold** badge ("paid for N, only M available"), and the owner
email's subject starts with **ACTION NEEDED**. Stock is not driven below zero.

The **Inquiries** tab lists service inquiries newest first, flags any whose
notification email failed (they are always stored first), and lets staff mark
them handled.

Revenue counts only orders Stripe marked `paid`. Unpaid sessions are shown as a
separate count rather than hidden — a started-but-unpaid order is something to
chase.

### Sale notification emails

Every completed sale emails the addresses in `ORDER_NOTIFICATION_EMAIL`
(comma-separated). All three variables must be set or the webhook silently skips
the email and only logs it:

| Variable | Notes |
| --- | --- |
| `RESEND_API_KEY` | From resend.com |
| `ORDER_NOTIFICATION_FROM` | Must be on a domain verified with Resend |
| `ORDER_NOTIFICATION_EMAIL` | Comma-separated recipients |

Resend reports failures in the response body rather than throwing, so a
body-level error is raised explicitly — otherwise a rejected email would log as
a success. A failed email stays *pending* on the order and is retried by the
next Stripe delivery and by the 10-minute sweep until it goes out; a short lease
plus a Resend idempotency key keep it from being sent twice.

## Backups

A snapshot runs nightly (`netlify.toml` → `[functions."nightly-backup"]`, 09:00
UTC) and keeps the last 30. **Backups tab** in the staff page lists them, takes
one on demand, downloads one, and restores one.

What is snapshotted: stock counts, catalog edits, fulfilment state, and the list
of photo keys.

**Orders are deliberately excluded.** Stripe is the system of record for
payments; a second copy would only ever be the one that disagrees.

**Photo bytes are not included** — only their keys. Blob keys are immutable and
never reused, so the list tells you what should exist and what is missing.

Two things worth understanding:

1. **Stored snapshots live in the same Netlify account as the data.** They
   protect against a bad bulk edit or a bug. They do *not* protect against
   losing the account. **Download current** saves a file to the employee's
   machine — that is the copy that survives account loss, and it is the direct
   descendant of the original "one file you can copy to a USB stick".

2. **A restore takes a safety snapshot of the current state first**, so
   restoring the wrong backup is itself undoable. Restore also requires typing
   `RESTORE`, because it overwrites live prices for the whole shop.

3. **Restore reconciles instead of rewinding.** Stock is set to the backup's
   count *minus every sale recorded after the backup*, open checkout holds are
   kept, and fulfilment for orders placed after the backup is left as it is.
   All writes are conditional, so a sale landing mid-restore is still counted.
   The staff page shows the reconciliation report when the restore finishes.

Scheduled functions run on published production deploys only — not on previews
— and cannot be triggered over HTTP, which is why the staff-facing download and
restore are a separate function.

## Failing loudly

The staff page is built to make failure obvious, on the principle that a
silent failure at a counter costs more than an ugly one:

- A sticky red banner at the top of the page for any failed request, so an
  error is visible even if it happened in a panel the employee is not looking at
- Offline is detected and named as offline, rather than surfacing as a generic
  failure
- HTTP status codes are translated into sentences that say what to do
  (409 → someone else changed this, reload; 5xx → nothing was saved, try again)
- Image uploads reject the wrong file type *before* uploading, and name the
  type — including a specific hint for iPhone HEIC photos
- Every message says whether anything was saved

This is the opposite of the storefront's rule, which fails open and silently:
customers should never see the shop break, but staff should never be left
guessing whether a save landed.

## Known limits

- **A hold can outlive an abandoned checkout.** A shopper who closes the Stripe
  tab without using its cancel link keeps the units reserved until the session
  expires (31 minutes) — unless they start a new checkout in the same browser,
  which takes the hold over. In-store sales of a held item have to wait or be
  entered after the hold clears.

- **The counter depends on the internet.** Data lives in Netlify, so an outage
  at the shop means no stock lookups until it's back.

- **Refunds, payouts, and disputes stay in Stripe.** This records what sold and
  what the shop did about it; duplicating Stripe's money handling would mean two
  systems disagreeing about money.

- **Fulfilment state lives in one blob.** Fine at a shop's order volume — one
  read for the whole dashboard, atomic conditional writes. If orders ever reach
  the tens of thousands, split it by key.

- **Sizes and colors can't be edited from the staff page yet.** You can edit
  name, category, price, description, and photo. Products with per-size pricing
  show their base price only; changing size prices still means editing
  `catalog.js`.

---

## Cost notes

Bandwidth is the largest recurring credit line. Two things already account for
it: the staff page shrinks photos in the browser before upload, and uploaded
images are served with a one-year immutable cache (keys are random per upload,
so they're safe to cache hard).

Production deploys cost 15 credits each — batch them and test with
`netlify dev` rather than deploying to check a change.
