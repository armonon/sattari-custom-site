import process from 'node:process';
import Stripe from 'stripe';
import { flushSiteRebuild } from '../../server/buildHook.js';
import { sweepCheckouts } from '../../server/checkoutOrders.js';
import { errorMessage, logError, logEvent } from '../../server/log.js';

// Backstop for lost or failed Stripe webhooks: releases stock held by checkouts
// that ended without an event, recovers paid sessions nobody recorded, and
// finishes orders whose stock update or owner email did not complete. Also
// starts the debounced site rebuild that staff edits and sales ask for.
// Scheduled functions run on published deploys only and cannot be called over
// HTTP.
export const config = { schedule: '*/10 * * * *' };

// Netlify stops a scheduled function at 30 seconds. The run's clock starts
// here, so the build hook call counts too: no outside call (the hook, Stripe,
// the owner email) starts after RUN_BUDGET_MS, and each gives up within
// 7 seconds (the hook within 5), so the last one ends well inside the limit.
// Whatever is left over runs ten minutes later; every step can resume.
const RUN_BUDGET_MS = 20000;
const STRIPE_TIMEOUT_MS = 7000;

export default async function checkoutMaintenance() {
  const startedAt = Date.now();
  const deadline = startedAt + RUN_BUDGET_MS;

  try {
    const rebuild = await flushSiteRebuild(undefined, { deadline });
    if (rebuild.triggered) logEvent({ type: 'site-rebuild', reasons: rebuild.reasons });
  } catch (error) {
    logError('site-rebuild-error', { message: errorMessage(error) });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    logError('checkout-maintenance', { ok: false, message: 'Missing STRIPE_SECRET_KEY.' });
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: STRIPE_TIMEOUT_MS,
    maxNetworkRetries: 0,
  });

  try {
    const summary = await sweepCheckouts(undefined, { stripe, deadline });
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
