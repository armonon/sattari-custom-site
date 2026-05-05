import process from 'node:process';
import { connectLambda, getStore } from '@netlify/blobs';
import Stripe from 'stripe';
import {
  createOrderRecord,
  getOrderStoreKey,
} from '../../src/utils/orderProcessing.js';
import { sendOrderNotification } from '../../server/orderNotifications.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

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

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
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

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing STRIPE_WEBHOOK_SECRET.' }),
    };
  }

  const signature = getHeader(event.headers || {}, 'stripe-signature');
  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing Stripe signature header.' }),
    };
  }

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      getRawBody(event),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      connectLambda(event);
      const orderStore = getStore('orders');
      const orderKey = getOrderStoreKey(session.id);
      const existingOrder = await orderStore.get(orderKey, { type: 'json' });

      if (!existingOrder) {
        const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
        });

        const orderRecord = createOrderRecord(session, lineItemsResponse.data, {
          source: 'netlify-stripe-webhook',
        });

        await orderStore.setJSON(orderKey, orderRecord, {
          metadata: {
            customerEmail: orderRecord.customerEmail,
            paymentStatus: orderRecord.paymentStatus,
          },
        });

        try {
          const notification = await sendOrderNotification(orderRecord);
          console.log(
            JSON.stringify({
              type: stripeEvent.type,
              sessionId: session.id,
              paymentStatus: session.payment_status,
              customerEmail: orderRecord.customerEmail,
              amountTotal: orderRecord.amountTotal,
              currency: orderRecord.currency,
              persisted: true,
              notificationSkipped: notification.skipped,
            })
          );
        } catch (notificationError) {
          console.error(
            JSON.stringify({
              type: 'order-notification-error',
              sessionId: session.id,
              message: notificationError.message,
            })
          );
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message || 'Invalid webhook signature.' }),
    };
  }
}