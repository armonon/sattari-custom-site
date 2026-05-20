import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSessionMock = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: createSessionMock,
      },
    },
  })),
}));

const { handler } = await import('../../netlify/functions/create-checkout-session.js');

function post(body) {
  return handler({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify(body),
  });
}

describe('create-checkout-session Netlify function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.URL = 'https://sattarimusic.com';
    delete process.env.DEPLOY_PRIME_URL;
    delete process.env.SITE_URL;
    createSessionMock.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/session',
    });
  });

  it('rejects non-POST requests', async () => {
    const response = await handler({ httpMethod: 'GET', body: '' });

    expect(response.statusCode).toBe(405);
    expect(JSON.parse(response.body)).toEqual({ error: 'Method not allowed.' });
  });

  it('requires the Stripe secret key', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await post({ items: [{ slug: 'pirouz-series-cymbals', quantity: 1 }] });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Missing STRIPE_SECRET_KEY.' });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('creates a Stripe checkout session with safe quantities, encoded product images, and shipping', async () => {
    const response = await post({
      items: [{ slug: 'pirouz-series-cymbals', quantity: 2.8 }],
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.test/session',
    });

    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        shipping_address_collection: { allowed_countries: ['US', 'CA'] },
        shipping_options: [
          expect.objectContaining({
            shipping_rate_data: expect.objectContaining({
              fixed_amount: { amount: 795, currency: 'usd' },
              display_name: 'Standard shipping',
            }),
          }),
        ],
        success_url: 'https://sattarimusic.com/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://sattarimusic.com/checkout/cancel',
      })
    );

    const checkoutPayload = createSessionMock.mock.calls[0][0];
    expect(checkoutPayload.line_items[0].quantity).toBe(2);
    expect(checkoutPayload.line_items[0].price_data.product_data.images[0]).toBe(
      'https://sattarimusic.com/sattari%20site/crash.png'
    );
  });
});
