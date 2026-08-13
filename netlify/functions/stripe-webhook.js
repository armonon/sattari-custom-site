import process from 'node:process';
import { connectLambda, getStore } from '@netlify/blobs';
import Stripe from 'stripe';
import {
  createOrderRecord,
  getOrderStoreKey,
} from '../../src/utils/orderProcessing.js';
import { sendOrderNotification } from '../../server/orderNotifications.js';
import { applyStockDeltas } from '../../src/utils/inventory.js';
import { updateStock } from '../../server/stockStore.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Turns Stripe line items back into stock decrements. The slug/size/color were
// written into product metadata when the session was created; 'default' is the
// placeholder for an absent size or color, and stockKey normalizes it away.
export function buildStockDeltas(lineItems = []) {
  const deltas = [];

  for (const item of lineItems) {
    const metadata = item?.price?.product?.metadata;
    if (!metadata?.slug) continue;

    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) continue;

    deltas.push({
      slug: metadata.slug,
      size: metadata.size,
      color: metadata.color,
      delta: -quantity,
    });
  }

  return deltas;
}

async function applyStockForOrder(event, deltas) {
  let skipped = [];

  await updateStock(event, (stock) => {
    const result = applyStockDeltas(stock, deltas);
    skipped = result.skipped;
    return result.stock;
  });

  return { skipped };
}

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
          // The slug/size/color needed to find the right stock entry live in
          // product metadata, which is not returned unless the product is
          // expanded. createOrderRecord ignores the extra data.
          expand: ['data.price.product'],
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

        // Stock comes down here, inside the existing "have we already recorded
        // this order?" guard. Stripe retries webhooks on any non-2xx, so a
        // decrement outside this block would subtract the same sale twice.
        try {
          const deltas = buildStockDeltas(lineItemsResponse.data);
          if (deltas.length) {
            const { skipped } = await applyStockForOrder(event, deltas);
            if (skipped.length) {
              // Untracked variants are skipped rather than created: a sale says
              // one unit left, not how many there were. Logged so an employee
              // can see which products still need an opening count.
              console.log(
                JSON.stringify({ type: 'stock-untracked-skip', sessionId: session.id, skipped })
              );
            }
          }
        } catch (stockError) {
          // Never fail the webhook over stock. Stripe would retry, and the
          // retry would be swallowed by the idempotency guard above, so the
          // order would be recorded but the notification never sent.
          console.error(
            JSON.stringify({
              type: 'stock-decrement-error',
              sessionId: session.id,
              message: stockError?.message || String(stockError),
            })
          );
        }

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