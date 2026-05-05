import process from 'node:process';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed.' }),
    };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY.' }),
    };
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing session_id.' }),
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_details?.email || session.customer_email || null,
        customer_name: session.customer_details?.name || null,
        amount_total: session.amount_total,
        currency: session.currency,
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message || 'Failed to fetch checkout session.' }),
    };
  }
}