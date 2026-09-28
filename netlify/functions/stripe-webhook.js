import { Buffer } from 'node:buffer';
import process from 'node:process';
import { handleCheckoutEvent } from '../../server/checkoutOrders.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';
import { errorMessage, logError, logEvent } from '../../server/log.js';
import { getStripe } from '../../server/stripeClient.js';
import { applyBookingPayment } from '../../server/studioBookings.js';

// v2, like everything that touches the booking store: strong reads, which it
// requires, are only available to v2 functions. A custom path replaces the
// default URL, so both are listed.
export const config = {
  path: ['/api/stripe-webhook', '/.netlify/functions/stripe-webhook'],
};

function getHeader(headers, name) {
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || null;
}

function getRawBody(event) {
  if (!event.body) {
    return '';
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }

  return event.body;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const BOOKING_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.expired',
];

// The signature is checked over the body exactly as Stripe sent it, which
// request.text() returns unaltered.
export default async function stripeWebhook(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: 'Missing STRIPE_SECRET_KEY.' });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return json(500, { error: 'Missing STRIPE_WEBHOOK_SECRET.' });
  }

  const signature = getHeader(event.headers || {}, 'stripe-signature');
  if (!signature) {
    return json(400, { error: 'Missing Stripe signature header.' });
  }

  let stripeEvent;
  try {
    stripeEvent = getStripe().webhooks.constructEvent(
      getRawBody(event),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    logError('stripe-webhook-signature-error', { message: errorMessage(error) });
    return json(400, { error: 'Invalid webhook signature.' });
  }

  try {
    if (stripeEvent.data.object?.metadata?.kind === 'studio_booking') {
      if (BOOKING_EVENTS.includes(stripeEvent.type)) {
        try {
          // A payment that does not match its booking is flagged for staff
          // inside, rather than thrown: no redelivery can fix it.
          await applyBookingPayment(event, stripeEvent.data.object);
        } catch (error) {
          // Neither can a booking that no longer exists. Storage failures and
          // write contention can be fixed by a retry, so they still throw.
          if (error?.statusCode !== 404) throw error;
          logError('stripe-webhook-booking-missing', {
            eventId: stripeEvent.id,
            sessionId: stripeEvent.data.object?.id,
          });
        }
      }
      return json(200, { received: true });
    }

    const { order, retry } = await handleCheckoutEvent(event, stripeEvent, {
      stripe: getStripe(),
    });

    if (order) {
      logEvent({
        type: stripeEvent.type,
        eventId: stripeEvent.id,
        sessionId: order.id,
        paymentStatus: order.paymentStatus,
        amountTotal: order.amountTotal,
        currency: order.currency,
        stock: order.stock?.state,
        notification: order.notification?.state,
      });
    }

    // Recorded, but the stock step did not finish: a non-2xx makes Stripe
    // redeliver, and the redelivery finishes only what is still outstanding.
    // A failed owner email alone is left to the maintenance sweep.
    if (retry) return json(500, { error: 'Webhook processing incomplete; will retry.' });

    return json(200, { received: true });
  } catch (error) {
    logError('stripe-webhook-error', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      sessionId: stripeEvent.data.object?.id,
      message: errorMessage(error),
    });
    return json(500, { error: 'Webhook processing failed.' });
  }
}
