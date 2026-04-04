import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import Stripe from 'stripe';
import { products, resolveSelectedOption } from '../src/data/catalog.js';

const app = express();
const port = Number(process.env.PORT || 4242);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

if (!process.env.STRIPE_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Missing STRIPE_SECRET_KEY. Stripe checkout endpoint will fail until it is configured.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

app.use(cors({ origin: clientUrl }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Stripe checkout server running on http://localhost:${port}`);
});
