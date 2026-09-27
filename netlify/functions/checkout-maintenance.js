import process from 'node:process';
import Stripe from 'stripe';
import { sweepCheckouts } from '../../server/checkoutOrders.js';
import { errorMessage, logError, logEvent } from '../../server/log.js';

// Backstop for lost or failed Stripe webhooks: releases stock held by checkouts
// that ended without an event, recovers paid sessions nobody recorded, and
// finishes orders whose stock update or owner email did not complete.
// Scheduled functions run on published deploys only and cannot be called over
// HTTP.
export const config = { schedule: '*/10 * * * *' };

export default async function checkoutMaintenance() {
  if (!process.env.STRIPE_SECRET_KEY) {
    logError('checkout-maintenance', { ok: false, message: 'Missing STRIPE_SECRET_KEY.' });
    return;
  }

  const startedAt = Date.now();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 10000,
    maxNetworkRetries: 1,
  });

  try {
    const summary = await sweepCheckouts(undefined, { stripe });
    logEvent({ type: 'checkout-maintenance', ok: true, ...summary, ms: Date.now() - startedAt });
  } catch (error) {
    logError('checkout-maintenance', {
      ok: false,
      message: errorMessage(error),
      ms: Date.now() - startedAt,
    });
    throw error;
  }
}
