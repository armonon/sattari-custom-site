import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import Stripe from 'stripe';
import { products, resolveSelectedOption } from '../src/data/catalog.js';
import {
  createOrderRecord,
  summarizeOrderRecord,
} from '../src/utils/orderProcessing.js';
import { listLocalOrders, readLocalOrder, saveLocalOrder } from './localOrderStore.js';
import { validateOrderLookupAccess } from './adminOrderAccess.js';
import { sendOrderNotification } from './orderNotifications.js';

const app = express();
const port = Number(process.env.PORT || 4242);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

if (!process.env.STRIPE_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Missing STRIPE_SECRET_KEY. Stripe checkout endpoint will fail until it is configured.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

app.use(cors({ origin: clientUrl }));

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Missing STRIPE_WEBHOOK_SECRET.' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature header.' });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const existingOrder = await readLocalOrder(session.id);

      if (!existingOrder) {
        const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
        });

        const orderRecord = createOrderRecord(session, lineItemsResponse.data, {
          source: 'local-stripe-webhook',
        });

        await saveLocalOrder(orderRecord);

        try {
          await sendOrderNotification(orderRecord);
        } catch (notificationError) {
          // eslint-disable-next-line no-console
          console.error('Order notification failed:', notificationError);
        }

        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            type: event.type,
            sessionId: orderRecord.id,
            paymentStatus: orderRecord.paymentStatus,
            customerEmail: orderRecord.customerEmail,
            amountTotal: orderRecord.amountTotal,
            currency: orderRecord.currency,
            persisted: true,
          })
        );
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/orders', async (req, res) => {
  const access = validateOrderLookupAccess(req.headers);
  if (!access.ok) {
    return res.status(access.statusCode).json({ error: access.error });
  }

  const sessionId = req.query.session_id;
  if (sessionId) {
    const order = await readLocalOrder(String(sessionId));

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    return res.json({ order });
  }

  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const orders = await listLocalOrders(limit);

  return res.json({
    orders: orders.map((orderRecord) => summarizeOrderRecord(orderRecord)),
  });
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!payloadItems.length) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    const lineItems = payloadItems.map((item) => {
      const product = products.find((p) => p.slug === item.slug);
      if (!product) {
        throw new Error(`Unknown product slug: ${item.slug}`);
      }

      const { size, unitPrice } = resolveSelectedOption(product, item.size);
      if (typeof unitPrice !== 'number') {
        throw new Error(`Price not configured for ${product.slug}`);
      }

      const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));

      return {
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(unitPrice * 100),
          product_data: {
            name: size ? `${product.name} (${size})` : product.name,
            description: product.description?.slice(0, 500),
            images: product.image ? [`${clientUrl}${product.image}`] : [],
            metadata: {
              slug: product.slug,
              size: size || 'default',
            },
          },
        },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'pay',
      line_items: lineItems,
      phone_number_collection: { enabled: true },
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },
      success_url: `${clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/checkout/cancel`,
    });

    return res.json({ id: session.id, url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create checkout session.' });
  }
});

app.get('/api/checkout-session-status', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY.' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id.' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));

    return res.json({
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email || session.customer_email || null,
      customer_name: session.customer_details?.name || null,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to fetch checkout session.' });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Stripe checkout server running on http://localhost:${port}`);
});
