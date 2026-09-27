import { Buffer } from 'node:buffer';
import process from 'node:process';
import { handleCheckoutEvent } from '../../server/checkoutOrders.js';
import { errorMessage, logError, logEvent } from '../../server/log.js';
import { getStripe } from '../../server/stripeClient.js';
import { applyBookingPayment } from '../../server/studioBookings.js';

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

export async function handler(event) {
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
      if (
        [
          'checkout.session.completed',
          'checkout.session.async_payment_succeeded',
          'checkout.session.expired',
        ].includes(stripeEvent.type)
      ) {
        await applyBookingPayment(event, stripeEvent.data.object);
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

    // Recorded, but a step failed: a non-2xx makes Stripe redeliver, and the
    // redelivery finishes only what is still outstanding.
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
