import process from 'node:process';
import { releaseCheckoutSession } from '../../server/checkoutOrders.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';
import { errorMessage, logError, logEvent } from '../../server/log.js';
import { getStripe } from '../../server/stripeClient.js';

// A custom path replaces the default URL, so both are listed.
export const config = {
  path: ['/api/checkout-release', '/.netlify/functions/checkout-release'],
};

const SESSION_ID = /^cs_[A-Za-z0-9_]{8,250}$/;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// Called by the cancel page when a shopper leaves Stripe without paying, so the
// units their checkout reserved go back on sale now instead of when the session
// times out. Expires the session at Stripe first, so it can no longer be paid.
//
// The session id is the only credential: an unguessable value that only the
// shopper's browser was given. The answer is the same whatever happened, so it
// tells a caller nothing about a session. Completed checkouts are never touched
// (see releaseCheckoutSession), and repeating a call changes nothing.
export default async function checkoutRelease(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: 'Missing STRIPE_SECRET_KEY.' });
  }

  let sessionId;
  try {
    sessionId = JSON.parse(event.body || '{}')?.sessionId;
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    return json(400, { error: 'Invalid request.' });
  }

  try {
    if (await releaseCheckoutSession(event, sessionId, { stripe: getStripe() })) {
      logEvent({ type: 'checkout-hold-released-early', sessionId });
    }
  } catch (error) {
    // The hold still lapses on its own, or through the expiry webhook.
    if (error?.code !== 'resource_missing') {
      logError('checkout-release-error', { message: errorMessage(error) });
    }
  }

  return json(200, { received: true });
}
