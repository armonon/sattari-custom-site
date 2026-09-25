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
  validDate,
} from '../src/utils/studioBooking.js';
import { bookingConfig } from './studioBookingConfig.js';
import { patchBooking, readBookings, updateBookings } from './studioBookingStore.js';
import { deliverBookingNotifications, queueNotifications } from './studioBookingNotifications.js';
import { getClientIp } from './staffAuth.js';

export function bookingError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
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
  if (payload.website) throw bookingError('Unable to submit this request.');
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
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
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
  const ipHash = crypto.createHash('sha256').update(getClientIp(event)).digest('hex');
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
    const recent = Object.values(doc).filter(
      (b) => Date.parse(b.createdAt) > now - 3600000 && (b.ipHash === ipHash || b.email === email)
    );
    if (recent.length >= 5)
      throw bookingError(
        'Too many booking requests. Please call the shop or try again later.',
        429
      );
    if (Object.values(doc).some((b) => holdsTime(b) && overlaps(input, b)))
      throw bookingError('That time was just reserved. Please choose another time.', 409);
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
    return { ...doc, [id]: { ...booking, notifications: queueNotifications(booking, 'request') } };
  });
  // The durable request is the source of truth. A provider outage is retried by
  // the scheduled job and exposed to staff, never disguised as sent.
  await deliverBookingNotifications(event, id).catch(() => {});
  return { id, status: result[id].status, amountCents: result[id].amountCents };
}

export async function approveBooking(event, id, staff) {
  const { origin } = requireReady();
  const now = Date.now();
  const doc = await updateBookings(event, (records) => {
    const b = records[id];
    if (!b) throw bookingError('Booking not found.', 404);
    if (['paid', 'awaiting_payment', 'approving'].includes(b.status)) return null;
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
        checkoutExpiresAt:
          Math.floor(Math.min(now + 23 * 3600000, b.startsAt - 60000) / 1000) * 1000,
      },
    };
  });
  let b = doc[id];
  if (b.status === 'paid') return b;
  if (b.status === 'approving') {
    if (b.checkoutExpiresAt < Date.now() + 31 * 60000)
      throw bookingError(
        'Payment-link preparation needs review. Cancel this unpaid request and ask for a new time.',
        409
      );
    // Retries use identical Stripe parameters and idempotency key, including
    // the saved deadline. An uncertain network response cannot create two links.
    const session = await stripeClient().checkout.sessions.create(
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
      { idempotencyKey: `studio-booking-${id}` }
    );
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

export async function applyBookingPayment(event, session) {
  const id = session.metadata?.bookingId;
  if (session.metadata?.kind !== 'studio_booking' || !id) return null;
  let booking = await patchBooking(event, id, (current) => {
    if (current.checkoutSessionId !== session.id)
      throw bookingError('Booking payment session does not match.', 409);
    if (session.currency !== 'usd' || session.amount_total !== current.amountCents)
      throw bookingError('Booking payment amount does not match.', 409);
    if (current.status === 'paid') return {};
    if (session.payment_status === 'paid' && session.status === 'complete') {
      if (current.status !== 'awaiting_payment')
        throw bookingError('Payment needs staff review.', 409);
      const paid = {
        ...current,
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
      };
      return { ...paid, notifications: queueNotifications(paid, 'paid') };
    }
    if (session.status === 'expired' && current.status === 'awaiting_payment')
      return { status: 'expired' };
    return {};
  });
  if (booking.status === 'paid')
    booking = (await deliverBookingNotifications(event, id)) || booking;
  return booking;
}

export async function reconcileBooking(event, id) {
  let booking = (await readBookings(event))[id];
  if (!booking) throw bookingError('Booking not found.', 404);
  if (booking.status === 'approving') {
    // Recover a Stripe success followed by a failed local write. Do not create
    // a fresh session after its original idempotency window or unlock a slot
    // while an unrecorded session could still take payment.
    const stripe = stripeClient();
    let after;
    let found;
    for (let page = 0; page < 20; page += 1) {
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
  if (!booking.checkoutSessionId) return booking;
  return applyBookingPayment(
    event,
    await stripeClient().checkout.sessions.retrieve(booking.checkoutSessionId)
  );
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

export async function lookupBookingPayment(event, sessionId) {
  if (!/^cs_(?:test_|live_)?[a-zA-Z0-9_]{10,250}$/.test(sessionId || ''))
    throw bookingError('Invalid payment reference.');
  const b = Object.values(await readBookings(event)).find(
    (item) => item.checkoutSessionId === sessionId
  );
  if (!b) throw bookingError('Booking payment not found.', 404);
  return publicBooking(await reconcileBooking(event, b.id));
}
