import process from 'node:process';
import Stripe from 'stripe';
import { products, resolveSelectedOption } from '../../src/data/catalog.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

function getClientUrl(event) {
  if (process.env.URL) return process.env.URL;
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL;
  if (process.env.SITE_URL) return process.env.SITE_URL;

  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host;
  return `${proto}://${host}`;
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

  try {
    const body = JSON.parse(event.body || '{}');
    const payloadItems = Array.isArray(body.items) ? body.items : [];

    if (!payloadItems.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Cart is empty.' }),
      };
    }

    const clientUrl = getClientUrl(event);

    const lineItems = payloadItems.map((item) => {
      const product = products.find((entry) => entry.slug === item.slug);
      if (!product) {
        throw new Error(`Unknown product slug: ${item.slug}`);
      }

      const { size, unitPrice } = resolveSelectedOption(product, item.size ?? null);
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: session.id, url: session.url }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message || 'Failed to create checkout session.' }),
    };
  }
}
