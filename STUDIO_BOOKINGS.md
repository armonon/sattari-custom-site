# Studio and rehearsal bookings

## Status

Implemented request -> staff approval -> emailed Stripe Checkout -> verified paid reservation.
Owner confirmed every day, 6 PM to midnight (America/Los_Angeles), and supplied
one email address and two SMS alert recipients. Recipients are kept in Netlify
Functions environment variables, not this document or the public website.
Online requests remain disabled until email and SMS providers are configured.
No live email, SMS, or payment test has been sent during implementation.

The production environment inspection found Stripe and staff authentication,
but no Resend email or Twilio SMS credentials. Do not turn on booking until both
channels have passed a real, owner-approved delivery test.

## Customer flow

- Services: choose Studio & rehearsal. The same booking form appears on both
  studio and rehearsal service pages and whenever those inquiry types are chosen.
- Hourly rate: $25. Four-hour package: $60. One, two, three, and four-hour
  durations are offered initially. Longer sessions require explicit configuration.
- Times are always America/Los_Angeles, including daylight saving time.
- Confirmed schedule: every day, 18:00 to 24:00 local time.
- Customers request at least one hour ahead and at most 90 days ahead.
- Pending requests do not reserve a time. Approval atomically reserves the shared
  room and sends a payment link. Stripe confirms payment before status is paid.
- Payment link lifetime: up to 23 hours, ending before the session starts.
- Only card payments are enabled to avoid delayed-settlement reservation races.
- Payment amount is computed server-side, never trusted from the customer.
- Confirmation email follows verified payment. An email or SMS provider accepting
  a message does not prove inbox or handset delivery.

One shared room/calendar is assumed for studio and rehearsal. Separate rooms,
buffers, cancellation/refund policies, tax treatment, and equipment guarantees
need owner decisions before they should be advertised. This implementation adds
no automatic taxes or refunds and makes no equipment-inclusion promises.

## Production setup

Set secrets through Netlify's environment-variable UI, with Functions scope and
production context. Never paste credentials into source code or a public form.

| Variable | Meaning |
| --- | --- |
| `STUDIO_BOOKING_OPEN_HOUR` | Confirmed local opening hour, e.g. `18` for 6 PM or `6` for 6 AM |
| `STUDIO_BOOKING_CLOSE_HOUR` | `24` for midnight, `12` for noon |
| `STUDIO_BOOKING_DAYS` | Comma-separated weekday numbers, Sunday `0` through Saturday `6` |
| `STUDIO_BOOKING_EXTRA_HOURS` | Optional `true`: four-hour package plus $25 for each extra hour |
| `STUDIO_BOOKING_EMAIL` | Owner alert email(s), comma-separated |
| `STUDIO_BOOKING_SMS_TO` | Owner SMS number(s) in E.164 format, e.g. `+1...` |
| `RESEND_API_KEY` | Resend email API credential |
| `STUDIO_BOOKING_FROM` | Sender on a verified Resend domain |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio API credential |
| `TWILIO_FROM_NUMBER` | SMS-capable Twilio sender, E.164 format |
| `STRIPE_SECRET_KEY` | Existing server-side Stripe credential |
| `STRIPE_WEBHOOK_SECRET` | Existing webhook signing secret |
| `STUDIO_BOOKING_ENABLED` | Set to `true` only after setup and delivery validation |

Email recipient/sender also fall back to existing service-inquiry/order notification
configuration, but currently none is configured in production. Staff authentication
must stay configured. Twilio sender registration/verification and trial recipient
restrictions must be resolved with the provider before launch.

Do not use live keys in preview deployments. For end-to-end testing use separate
test-mode Stripe credentials, provider test recipients, and an isolated site/store.
Netlify site-wide Blobs are shared across deploy contexts on the same site.

Stripe webhook endpoint: `/api/stripe-webhook`. Subscribe to:
- `checkout.session.completed` (existing product checkout event)
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded` (defensive support)

The scheduled function reconciles pending payment sessions even if an expiry
webhook was not delivered. No reservation is released just because a local
timer expired; Stripe must report it expired/unpaid first.

## Staff workflow

Open the existing unlisted staff page and use **Studio bookings**. Owner alerts
link directly to that tab; staff must still sign in. Approval/decline never
happens automatically when an email scanner follows a link.

- **Approve & email payment link**: checks for overlaps, reserves the room,
  creates an idempotent Stripe session and queues the customer approval email.
- **Decline**: for unapproved requests only; emails the customer.
- **Check payment / Check Stripe**: reconciles status with Stripe, including a
  session created before a failed local write.
- **Cancel unpaid reservation**: expires the Stripe session before freeing time.
  If payment already succeeded, cancellation is refused. Refund review stays in Stripe.
- **Retry notifications**: retries failed channels, not messages already accepted.

`studio-booking-maintenance` runs every five minutes on production. It retries
failed delivery with backoff up to eight attempts and checks unfinished payment
sessions. Failed channels remain visible in the staff panel. SMS retries can
duplicate an alert if the provider accepted a request but its response was lost;
booking requests and Stripe payments themselves are deduplicated.

Booking data is in the `studio-bookings` Netlify Blobs store, key `calendar-v1`.
Strong consistency and actual conditional writes are required; the SDK was
upgraded to 10.7.13 because 8.2.0 silently ignored conditional-write options.
Existing inventory, auth and order tests must pass after this dependency update.
This booking store is not part of the legacy stock/catalog backup-restore flow:
restoring an old reservation snapshot could contradict payments already made.
Export booking records from Netlify for disaster recovery and reconcile against
Stripe before any manual restore. No automated retention deletion is enabled.

## Release checklist

1. Confirm hours, days, recipient email/mobile, shared-room assumption and rates.
2. Configure and verify Resend and Twilio; configure required Stripe events.
3. Test a booking in an isolated test environment: owner email + actual handset
   receipt, approval email, test payment, paid confirmation and duplicate webhook.
4. Test a competing approval, decline, expired payment and cancelled checkout.
5. Deploy, verify staff setup checklist is empty, and inspect delivery logs.
6. Enable production booking and perform an owner-approved live smoke test.

## References

- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout/fulfill-orders
- https://resend.com/docs/api-reference/emails/send-email
- https://www.twilio.com/docs/messaging/api/message-resource
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
