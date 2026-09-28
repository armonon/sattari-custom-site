import crypto from 'node:crypto';
import Stripe from 'stripe';
import {
  availableHours,
  bookingPrice,
  bookingSummary,
  holdsTime,
  localDate,
  overlaps,
  studioTimestamp,
  validBookingEmail,
  validDate,
} from '../src/utils/studioBooking.js';
import { bookingConfig } from './studioBookingConfig.js';
import { patchBooking, readBookings, updateBookings } from './studioBookingStore.js';
import { deliverBookingNotifications, queueNotifications } from './studioBookingNotifications.js';
import { getClientIp } from './staffAuth.js';
import { hashIp } from './ipHash.js';
import { logError } from './log.js';

// `expose` marks a message written for the person reading it. Anything else
// (Stripe errors also carry a statusCode) is logged and replaced with a
// generic answer by the functions.
export function bookingError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode, expose: true });
}

export function bookingJson(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
    body: JSON.stringify(body),
  };
}

// Every request emails the owner (on the same Resend key as order emails) and
// texts each alert number, and both the IP address and the email address of a
// request are cheap to rotate. So beyond the per-sender limit there is a
// ceiling for the whole site, and texts stop well before it.
export const BOOKING_LIMITS = {
  perSenderHourly: 5,
  siteHourly: 10,
  siteDaily: 30,
  textHourly: 4,
  textDaily: 12,
};

// Bots fill in every field they find; people never see these.
export function honeypotFilled(payload) {
  return ['website', 'bot-field'].some((field) => String(payload?.[field] ?? '').trim() !== '');
}

function requireReady() {
  const config = bookingConfig();
  if (!config.publicConfig.enabled)
    throw bookingError(
      'Online studio booking is not available yet. Please call (424) 465-3020.',
      503
    );
  return config;
}

function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', { timeout: 15000, maxNetworkRetries: 1 });
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function requestBooking(event, payload) {
  const { publicConfig: config } = requireReady();
  if (honeypotFilled(payload)) {
    // Answer like a real request so the bot learns nothing, and store, email
    // and text nothing.
    console.log(JSON.stringify({ type: 'studio-booking-honeypot' }));
    const echoedId = clean(payload.requestId, 80);
    const hours = Number(payload.hours);
    return {
      id: `studio_${/^[a-f0-9-]{36}$/i.test(echoedId) ? echoedId : crypto.randomUUID()}`,
      status: 'requested',
      amountCents: bookingPrice(config.durations.includes(hours) ? hours : config.durations[0]),
    };
  }
  const requestId = clean(payload.requestId, 80);
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw bookingError('Please refresh and try again.');
  const date = clean(payload.date, 10);
  const hours = Number(payload.hours);
  const startHour = Number(payload.startHour);
  const name = clean(payload.name, 120).replace(/[\r\n]/g, ' ');
  const email = clean(payload.email, 180).toLowerCase();
  const phone = clean(payload.phone, 40);
  const notes = clean(payload.notes, 2000);
  const purpose = ['Rehearsal', 'Recording', 'Teaching', 'Other'].includes(payload.purpose)
    ? payload.purpose
    : 'Rehearsal';
  if (!name || !validBookingEmail(email))
    throw bookingError('Enter your name and a valid email address.');
  if (payload.accepted !== true)
    throw bookingError('Please acknowledge that approval and payment are required.');
  if (
    !validDate(date) ||
    date > localDate(Date.now() + config.advanceDays * 86400000) ||
    !config.durations.includes(hours) ||
    !availableHours(date, hours, config).includes(startHour)
  )
    throw bookingError('Choose an available future time within the next 90 days.');
  const id = `studio_${requestId}`;
  const input = { date, startHour, hours, name, email, phone, notes, purpose };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const ipHash = hashIp(getClientIp(event));
  const now = Date.now();
  const result = await updateBookings(event, (doc) => {
    if (doc[id]) {
      if (doc[id].fingerprint !== fingerprint)
        throw bookingError(
          'This request was already submitted. Refresh before making another request.',
          409
        );
      return null;
    }
    const all = Object.values(doc);
    const lastHour = all.filter((b) => Date.parse(b.createdAt) > now - 3600000);
    const lastDay = all.filter((b) => Date.parse(b.createdAt) > now - 86400000);
    if (
      lastHour.filter((b) => b.ipHash === ipHash || b.email === email).length >=
      BOOKING_LIMITS.perSenderHourly
    )
      throw bookingError(
        'Too many booking requests. Please call the shop or try again later.',
        429
      );
    if (lastHour.length >= BOOKING_LIMITS.siteHourly || lastDay.length >= BOOKING_LIMITS.siteDaily)
      throw bookingError(
        'We are receiving an unusual number of booking requests. Please call (424) 465-3020 or try again later.',
        429
      );
    if (all.some((b) => holdsTime(b) && overlaps(input, b)))
      throw bookingError('That time was just reserved. Please choose another time.', 409);
    const textOwner =
      lastHour.length < BOOKING_LIMITS.textHourly && lastDay.length < BOOKING_LIMITS.textDaily;
    const booking = {
      ...input,
      id,
      fingerprint,
      ipHash,
      amountCents: bookingPrice(hours),
      currency: 'usd',
      startsAt: studioTimestamp(date, startHour),
      status: 'requested',
      createdAt: new Date(now).toISOString(),
    };
    return {
      ...doc,
      [id]: {
        ...booking,
        notifications: queueNotifications(booking, 'request', { text: textOwner }),
      },
    };
  });
  // The durable request is the source of truth. A provider outage is retried by
  // the scheduled job and exposed to staff, never disguised as sent.
  await deliverBookingNotifications(event, id).catch(() => {});
  return { id, status: result[id].status, amountCents: result[id].amountCents };
}

// Each approval gets its own Stripe idempotency key: retrying the same
// approval must reuse it, but after Stripe refused one (see approveBooking) a
// fresh approval must not be answered with that stored refusal. The first
// attempt keeps the original key format, so approvals in flight across a
// deploy still recover their session.
function approvalKey(booking) {
  const attempt = Number(booking.approvalAttempt) || 1;
  return attempt > 1 ? `studio-booking-${booking.id}-${attempt}` : `studio-booking-${booking.id}`;
}

// Stripe answered and said no, so no payment link exists. Not a 409 (the
// same request still being processed) or an idempotency error (an earlier
// request with this key did something), and not a timeout or 5xx, where the
// link may well have been created.
function stripeRefused(error) {
  const status = Number(error?.statusCode);
  return (
    status >= 400 &&
    status < 500 &&
    status !== 409 &&
    error?.type !== 'StripeIdempotencyError' &&
    error?.rawType !== 'idempotency_error'
  );
}

export async function approveBooking(event, id, staff) {
  const { origin } = requireReady();
  const now = Date.now();
  const doc = await updateBookings(event, (records) => {
    const b = records[id];
    if (!b) throw bookingError('Booking not found.', 404);
    if (['paid', 'awaiting_payment', 'approving', 'needs_review'].includes(b.status)) return null;
    if (b.status !== 'requested')
      throw bookingError('This request can no longer be approved.', 409);
    if (b.startsAt < now + 3600000)
      throw bookingError(
        'This time is too close or has passed. Ask the customer to request another time.',
        409
      );
    if (
      Object.values(records).some(
        (other) => other.id !== id && holdsTime(other) && overlaps(b, other)
      )
    )
      throw bookingError('An approved booking already holds this time.', 409);
    return {
      ...records,
      [id]: {
        ...b,
        status: 'approving',
        approvedBy: staff,
        approvedAt: new Date(now).toISOString(),
        approvalAttempt: (Number(b.approvalAttempt) || 0) + 1,
        checkoutExpiresAt:
          Math.floor(Math.min(now + 23 * 3600000, b.startsAt - 60000) / 1000) * 1000,
      },
    };
  });
  let b = doc[id];
  if (b.status === 'paid' || b.status === 'needs_review') return b;
  if (b.status === 'approving') {
    if (b.checkoutExpiresAt < Date.now() + 31 * 60000)
      throw bookingError(
        'Payment-link preparation needs review. Cancel this unpaid request and ask for a new time.',
        409
      );
    // Retries use identical Stripe parameters and idempotency key, including
    // the saved deadline. An uncertain network response cannot create two links.
    let session;
    try {
      session = await createPaymentLink(b, origin);
    } catch (error) {
      if (!stripeRefused(error)) throw error;
      // Stripe refused, so no link exists: put the request back rather than
      // leave it stuck in 'approving', which decline and cancel both refuse.
      logError('studio-booking-approval-refused', {
        bookingId: id,
        type: error?.type,
        code: error?.code,
        statusCode: error?.statusCode,
        message: error?.message,
      });
      // The attempt is recorded even for an approval started before attempts
      // were counted, so the next one moves to a fresh idempotency key rather
      // than having Stripe replay this refusal for 24 hours.
      await patchBooking(event, id, (current) =>
        current.status === 'approving' && current.approvalAttempt === b.approvalAttempt
          ? {
              status: 'requested',
              approvalAttempt: Number(b.approvalAttempt) || 1,
              approvalError: {
                at: new Date().toISOString(),
                code: error?.code || error?.rawType || String(error?.statusCode),
              },
            }
          : {}
      );
      throw bookingError(
        'Stripe refused to create the payment link, so nothing was sent or charged. The request is back to awaiting approval. Check the booking details and the Stripe settings, then approve again.',
        502
      );
    }
    b = await patchBooking(event, id, (current) => {
      if (current.status !== 'approving') return {};
      const approved = {
        ...current,
        status: 'awaiting_payment',
        checkoutSessionId: session.id,
        checkoutUrl: session.url,
        checkoutExpiresAt: session.expires_at * 1000,
      };
      return { ...approved, notifications: queueNotifications(approved, 'approved') };
    });
  }
  await deliverBookingNotifications(event, id).catch(() => {});
  return (await readBookings(event))[id];
}

function createPaymentLink(b, origin) {
  return stripeClient().checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: b.email,
      client_reference_id: b.id,
      metadata: { kind: 'studio_booking', bookingId: b.id },
      payment_intent_data: { metadata: { kind: 'studio_booking', bookingId: b.id } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: b.amountCents,
            product_data: {
              name: 'Sattari studio / rehearsal time',
              description: bookingSummary(b),
            },
          },
        },
      ],
      expires_at: b.checkoutExpiresAt / 1000,
      success_url: `${origin}/studio-booking?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/studio-booking?cancelled=1`,
    },
    { idempotencyKey: approvalKey(b) }
  );
}

// Why a Stripe session cannot simply be applied to its booking, or null.
function paymentMismatch(current, session, paid) {
  if (current.checkoutSessionId !== session.id)
    return 'This payment was made on a payment link that is not the booking’s current one.';
  if (session.currency !== 'usd' || session.amount_total !== current.amountCents)
    return 'The amount paid does not match the booking price.';
  if (paid && !['awaiting_payment', 'paid', 'needs_review'].includes(current.status))
    return `The payment arrived after the booking was marked ${current.status}.`;
  return null;
}

// Money arrived that the booking cannot account for. No retry of the webhook
// can change that, so it is flagged for staff, and the time stays held while
// they check Stripe. A booking that is already paid keeps its status and gets
// the note alone.
function flagPaymentForReview(current, session, reason) {
  if (current.paymentReview?.sessionId === session.id) return {};
  logError('studio-booking-payment-review', {
    bookingId: current.id,
    sessionId: session.id,
    reason,
  });
  return {
    ...(current.status === 'paid' ? {} : { status: 'needs_review' }),
    paymentReview: {
      reason,
      sessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      amountTotal: session.amount_total,
      currency: session.currency,
      previousStatus: current.status,
      at: new Date().toISOString(),
    },
  };
}

// `delivery` ({ deadline, timeoutMs }) is handed to the confirmation email, so
// the scheduled job's time limit holds on this path too.
export async function applyBookingPayment(event, session, delivery = {}) {
  const id = session.metadata?.bookingId;
  if (session.metadata?.kind !== 'studio_booking' || !id) return null;
  const paid = session.payment_status === 'paid' && session.status === 'complete';
  let booking = await patchBooking(event, id, (current) => {
    const mismatch = paymentMismatch(current, session, paid);
    // Without money moving there is nothing to review: an expiry or an
    // unpaid session that does not match is simply ignored.
    if (mismatch) return paid ? flagPaymentForReview(current, session, mismatch) : {};
    if (current.status === 'paid' || current.status === 'needs_review') return {};
    if (paid) {
      const settled = {
        ...current,
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
      };
      return { ...settled, notifications: queueNotifications(settled, 'paid') };
    }
    if (session.status === 'expired' && current.status === 'awaiting_payment')
      return { status: 'expired' };
    return {};
  });
  if (booking.status === 'paid')
    booking = (await deliverBookingNotifications(event, id, delivery)) || booking;
  return booking;
}

// `stripe`, `deadline` and `timeoutMs` let the scheduled job use short
// timeouts and stop before Netlify's limit, including for the confirmation
// email a payment found here sends; it resumes where it stopped next run.
export async function reconcileBooking(
  event,
  id,
  _staff,
  { stripe = stripeClient(), deadline = Infinity, timeoutMs } = {}
) {
  let booking = (await readBookings(event))[id];
  if (!booking) throw bookingError('Booking not found.', 404);
  if (booking.status === 'approving') {
    // Recover a Stripe success followed by a failed local write. Do not create
    // a fresh session after its original idempotency window or unlock a slot
    // while an unrecorded session could still take payment.
    let after;
    let found;
    for (let page = 0; page < 20; page += 1) {
      if (Date.now() > deadline) return booking;
      const sessions = await stripe.checkout.sessions.list({
        created: { gte: Math.floor(Date.parse(booking.approvedAt) / 1000) - 60 },
        limit: 100,
        ...(after ? { starting_after: after } : {}),
      });
      found = sessions.data.find(
        (session) =>
          session.metadata?.kind === 'studio_booking' && session.metadata.bookingId === id
      );
      if (found) break;
      if (!sessions.has_more) {
        if (booking.checkoutExpiresAt + 60000 < Date.now())
          return patchBooking(event, id, (current) =>
            current.status === 'approving' ? { status: 'expired' } : {}
          );
        return booking;
      }
      after = sessions.data.at(-1)?.id;
    }
    if (!found)
      throw bookingError(
        'Unable to finish checking Stripe. This time remains held for review.',
        409
      );
    booking = await patchBooking(event, id, (current) => {
      if (current.status !== 'approving') return {};
      const recovered = {
        ...current,
        status: 'awaiting_payment',
        checkoutSessionId: found.id,
        checkoutUrl: found.url,
        checkoutExpiresAt: found.expires_at * 1000,
      };
      return { ...recovered, notifications: queueNotifications(recovered, 'approved') };
    });
  }
  if (!booking.checkoutSessionId || Date.now() > deadline) return booking;
  return applyBookingPayment(
    event,
    await stripe.checkout.sessions.retrieve(booking.checkoutSessionId),
    { deadline, ...(timeoutMs ? { timeoutMs } : {}) }
  );
}

// Staff checked a flagged payment in Stripe and are keeping the booking.
export async function confirmReviewedBooking(event, id, staff) {
  const doc = await updateBookings(event, (records) => {
    const current = records[id];
    if (!current) throw bookingError('Booking not found.', 404);
    if (current.status !== 'needs_review')
      throw bookingError('Only a booking whose payment needs review can be confirmed here.', 409);
    if (
      Object.values(records).some(
        (other) => other.id !== id && holdsTime(other) && overlaps(current, other)
      )
    )
      throw bookingError(
        'Another booking holds this time now. Refund this payment in Stripe and release it, or sort out the other booking first.',
        409
      );
    const paid = {
      ...current,
      status: 'paid',
      paidAt: current.paidAt || new Date().toISOString(),
      paymentIntentId: current.paymentIntentId || current.paymentReview?.paymentIntentId || null,
      paymentReview: {
        ...current.paymentReview,
        resolution: 'kept',
        resolvedBy: staff,
        resolvedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    return { ...records, [id]: { ...paid, notifications: queueNotifications(paid, 'paid') } };
  });
  await deliverBookingNotifications(event, id).catch(() => {});
  return doc[id];
}

// Staff refunded a flagged payment in Stripe and are freeing the time. No
// email goes out: the refund conversation is theirs to have.
export async function releaseReviewedBooking(event, id, staff) {
  return patchBooking(event, id, (current) => {
    if (current.status !== 'needs_review')
      throw bookingError('Only a booking whose payment needs review can be released here.', 409);
    return {
      status: 'cancelled',
      reviewedBy: staff,
      paymentReview: {
        ...current.paymentReview,
        resolution: 'released',
        resolvedBy: staff,
        resolvedAt: new Date().toISOString(),
      },
    };
  });
}

export async function declineBooking(event, id, staff) {
  const booking = await patchBooking(event, id, (current) => {
    if (current.status === 'declined') return {};
    if (current.status !== 'requested')
      throw bookingError(
        'Only an unapproved request can be declined. Use Cancel unpaid reservation for approved time.',
        409
      );
    const declined = { ...current, status: 'declined', reviewedBy: staff };
    return { ...declined, notifications: queueNotifications(declined, 'declined') };
  });
  await deliverBookingNotifications(event, id).catch(() => {});
  return booking;
}

export async function cancelUnpaidBooking(event, id, staff) {
  let b = (await readBookings(event))[id];
  if (!b) throw bookingError('Booking not found.', 404);
  // A partially-created session may have succeeded at Stripe. Keep the slot
  // locked until staff recover the idempotent creation; never guess unpaid.
  if (b.status === 'approving')
    throw bookingError(
      'Retry approval to recover the payment session before cancelling. If its deadline passed, review the idempotency key in Stripe before releasing this time.',
      409
    );
  if (b.status !== 'awaiting_payment')
    throw bookingError(
      'Only an unpaid reservation can be cancelled here. Paid bookings require refund review in Stripe.',
      409
    );
  const stripe = stripeClient();
  let session = await stripe.checkout.sessions.retrieve(b.checkoutSessionId);
  if (session.status === 'open') {
    try {
      session = await stripe.checkout.sessions.expire(session.id);
    } catch {
      session = await stripe.checkout.sessions.retrieve(session.id);
    }
  }
  if (session.payment_status === 'paid') {
    await applyBookingPayment(event, session);
    throw bookingError(
      'Payment already succeeded. The booking is finalized; review any refund in Stripe.',
      409
    );
  }
  if (session.status !== 'expired')
    throw bookingError('Stripe has not released this payment session. Try again.', 409);
  b = await patchBooking(event, id, (current) => {
    if (current.status === 'paid') throw bookingError('This booking has been paid.', 409);
    if (current.status === 'needs_review')
      throw bookingError('A payment for this booking needs review. Reload and check it.', 409);
    const cancelled = { ...current, status: 'cancelled', reviewedBy: staff };
    return { ...cancelled, notifications: queueNotifications(cancelled, 'declined') };
  });
  await deliverBookingNotifications(event, id).catch(() => {});
  return b;
}

export async function retryBookingNotifications(event, id) {
  await patchBooking(event, id, (b) => ({
    notifications: Object.fromEntries(
      Object.entries(b.notifications || {}).map(([key, item]) => [
        key,
        ['sent', 'skipped'].includes(item.state) || item.leaseUntil > Date.now()
          ? item
          : { ...item, attempts: 0, nextAttemptAt: 0 },
      ])
    ),
  }));
  return deliverBookingNotifications(event, id);
}

export function publicBooking(booking) {
  return {
    status: booking.status,
    date: booking.date,
    startHour: booking.startHour,
    hours: booking.hours,
    amountCents: booking.amountCents,
  };
}

// The payment page's status check. The URL is public, and a payment that is
// already settled (or waiting on staff) cannot change by asking Stripe again,
// so only a payment still outstanding costs a Stripe call; that call writes
// nothing unless the booking actually changes.
export async function lookupBookingPayment(event, sessionId) {
  if (!/^cs_(?:test_|live_)?[a-zA-Z0-9_]{10,250}$/.test(sessionId || ''))
    throw bookingError('Invalid payment reference.');
  const b = Object.values(await readBookings(event)).find(
    (item) => item.checkoutSessionId === sessionId
  );
  if (!b) throw bookingError('Booking payment not found.', 404);
  if (b.status !== 'awaiting_payment') return publicBooking(b);
  return publicBooking(await reconcileBooking(event, b.id));
}
