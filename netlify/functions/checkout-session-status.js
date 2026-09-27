import process from 'node:process';
import { maskEmail } from '../../src/utils/orderProcessing.js';
import { errorMessage, logError } from '../../server/log.js';
import { getStripe } from '../../server/stripeClient.js';

const SESSION_ID = /^cs_[A-Za-z0-9_]{8,250}$/;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// Anyone holding the session id can call this — it sits in the success URL,
// so it ends up in browser history, screenshots, and referrer logs. The
// response is limited to what the confirmation page needs: no name, no full
// email, no address.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: 'Missing STRIPE_SECRET_KEY.' });
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return json(400, { error: 'Missing session_id.' });
  }
  if (!SESSION_ID.test(sessionId)) {
    return json(400, { error: 'Invalid session_id.' });
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    return json(200, {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email_masked: maskEmail(session.customer_details?.email || session.customer_email),
    });
  } catch (error) {
    logError('checkout-session-status-error', { message: errorMessage(error) });
    if (error?.code === 'resource_missing') {
      return json(404, { error: 'Checkout session not found.' });
    }
    return json(502, { error: 'Unable to verify checkout session right now.' });
  }
}
