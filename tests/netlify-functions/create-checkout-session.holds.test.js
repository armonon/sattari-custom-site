// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAIN, checkoutSession, stripeEvent, webhookCall } from './helpers/checkoutFixtures.js';

const blobs = vi.hoisted(() => ({ current: null }));
const stripe = vi.hoisted(() => ({ create: vi.fn(), listLineItems: vi.fn(), retrieve: vi.fn() }));

vi.mock('@netlify/blobs', async () => {
  const { createMemoryBlobs } = await import('./helpers/memoryBlobs.js');
  blobs.current = createMemoryBlobs();
  return blobs.current.module;
});

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: { constructEvent: (body) => JSON.parse(body) },
      checkout: { sessions: stripe },
    };
  }),
}));

const { handler: createCheckout } =
  await import('../../netlify/functions/create-checkout-session.js');
const { handler: inventory } = await import('../../netlify/functions/inventory.js');
const { handler: webhook } = await import('../../netlify/functions/stripe-webhook.js');
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');
const { FLAT_SHIPPING_CENTS } = await import('../../src/data/shipping.js');

const KEY = stockKey(PLAIN);
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const MINUTE = 60 * 1000;

function setStock(stock) {
  blobs.current.write('inventory', 'stock', stock);
}

function holds() {
  return blobs.current.read('inventory', 'stock')?.[HOLDS_FIELD] || {};
}

function post(items) {
  return createCheckout({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: typeof items === 'string' ? items : JSON.stringify({ items }),
  });
}

async function available(key = KEY) {
  return JSON.parse((await inventory({ httpMethod: 'GET' })).body).stock[key];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  blobs.current.reset();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('URL', 'https://sattarimusic.com');

  let created = 0;
  stripe.create.mockImplementation(async () => {
    created += 1;
    return { id: `cs_test_created_${created}`, url: 'https://checkout.stripe.test/pay' };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('reserving stock for a checkout', () => {
  it('holds the units for the life of a 31-minute Stripe session', async () => {
    setStock({ [KEY]: 5 });

    const response = await post([{ slug: PLAIN, quantity: 2 }]);

    expect(response.statusCode).toBe(200);
    const [params, options] = stripe.create.mock.calls[0];
    const expiresAt = Math.floor(NOW / 1000) + 31 * 60;
    expect(params.expires_at).toBe(expiresAt);
    expect(params.metadata).toEqual({ kind: 'shop_order', holdId: expect.any(String) });
    expect(options).toEqual({ idempotencyKey: `checkout-${params.metadata.holdId}` });

    expect(holds()[params.metadata.holdId]).toMatchObject({
      state: 'active',
      lines: [{ key: KEY, quantity: 2 }],
      sessionId: 'cs_test_created_1',
      checkoutExpiresAt: expiresAt * 1000,
      expiresAt: expiresAt * 1000 + 15 * MINUTE,
    });
    // The shelf count is untouched until the sale is paid.
    expect(blobs.current.read('inventory', 'stock')[KEY]).toBe(5);
  });

  it('subtracts held units from what the storefront shows as available', async () => {
    setStock({ [KEY]: 3 });
    expect(await available()).toBe(3);

    await post([{ slug: PLAIN, quantity: 2 }]);

    expect(await available()).toBe(1);
  });

  it('lets exactly one of two simultaneous checkouts for the last unit through', async () => {
    setStock({ [KEY]: 1 });

    const responses = await Promise.all([
      post([{ slug: PLAIN, quantity: 1 }]),
      post([{ slug: PLAIN, quantity: 1 }]),
    ]);

    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([200, 409]);

    const refused = JSON.parse(responses.find((r) => r.statusCode === 409).body);
    expect(refused.code).toBe('out_of_stock');
    expect(refused.error).toMatch(/being checked out by another customer/);
    expect(refused.shortfalls[0]).toMatchObject({ slug: PLAIN, requested: 1, available: 0 });
    expect(stripe.create).toHaveBeenCalledTimes(1);
  });

  it('says "sold out" when there is nothing on the shelf at all', async () => {
    setStock({ [KEY]: 0 });

    const body = JSON.parse((await post([{ slug: PLAIN, quantity: 1 }])).body);

    expect(body.error).toMatch(/just sold out/);
  });

  it('does not hold products that are not stock-tracked', async () => {
    setStock({});

    expect((await post([{ slug: PLAIN, quantity: 4 }])).statusCode).toBe(200);
    expect(holds()).toEqual({});
  });

  it('releases the hold when checkout expires', async () => {
    setStock({ [KEY]: 1 });
    await post([{ slug: PLAIN, quantity: 1 }]);
    const holdId = stripe.create.mock.calls[0][0].metadata.holdId;
    expect(await available()).toBe(0);

    const response = await webhook(
      webhookCall(
        stripeEvent(
          'checkout.session.expired',
          checkoutSession({ holdId, status: 'expired', payment_status: 'unpaid' })
        )
      )
    );

    expect(response.statusCode).toBe(200);
    expect(holds()).toEqual({});
    expect(await available()).toBe(1);
  });

  it('stops reserving once the hold lapses, even if no webhook or sweep ever runs', async () => {
    setStock({ [KEY]: 1 });
    await post([{ slug: PLAIN, quantity: 1 }]);

    vi.setSystemTime(NOW + 45 * MINUTE);
    expect(await available()).toBe(0);

    vi.setSystemTime(NOW + 47 * MINUTE);
    expect(await available()).toBe(1);
    expect((await post([{ slug: PLAIN, quantity: 1 }])).statusCode).toBe(200);
  });

  it('releases the hold and hides the provider error when Stripe refuses the session', async () => {
    setStock({ [KEY]: 1 });
    stripe.create.mockRejectedValue(new Error('Invalid API Key provided: sk_live_****9876'));

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Failed to create checkout session.' });
    expect(holds()).toEqual({});
    expect(await available()).toBe(1);
  });

  it('refuses rather than selling unreserved when stock writes keep conflicting', async () => {
    setStock({ [KEY]: 5 });
    blobs.current.state.conflict = ({ store }) => store === 'inventory';

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/busy/);
    expect(stripe.create).not.toHaveBeenCalled();
  });
});

describe('catalog and validation', () => {
  it('fails closed with a customer-friendly 503 when the edited catalog cannot be read', async () => {
    setStock({ [KEY]: 5 });
    blobs.current.state.fault = ({ store }) =>
      store === 'catalog' ? new Error('blob store 500 from internal host') : null;

    const response = await post([{ slug: PLAIN, quantity: 1 }]);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(503);
    expect(body.error).toBe(
      'Checkout is temporarily unavailable. Please try again in a few minutes.'
    );
    expect(stripe.create).not.toHaveBeenCalled();
    expect(holds()).toEqual({});
  });

  it('tells the cart which items are no longer for sale, with a stable code', async () => {
    const response = await post([
      { slug: 'no-such-thing', quantity: 1 },
      { slug: PLAIN, quantity: 1 },
      { slug: 'also-gone', quantity: 2 },
    ]);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Some items in your cart are no longer available. Please remove them and try again.',
      code: 'product_unavailable',
      slug: 'no-such-thing',
      slugs: ['no-such-thing', 'also-gone'],
    });
    expect(stripe.create).not.toHaveBeenCalled();
  });

  it('answers malformed requests with 400', async () => {
    const invalidJson = await post('{not json');
    expect(invalidJson.statusCode).toBe(400);
    expect(JSON.parse(invalidJson.body)).toEqual({ error: 'Invalid request.' });

    const noSlug = await post([{ quantity: 1 }]);
    expect(noSlug.statusCode).toBe(400);
    expect(JSON.parse(noSlug.body)).toEqual({ error: 'Invalid request.' });

    const empty = await post([]);
    expect(empty.statusCode).toBe(400);
    expect(JSON.parse(empty.body)).toEqual({ error: 'Cart is empty.' });
  });

  it('charges the shared flat shipping rate', async () => {
    await post([{ slug: PLAIN, quantity: 1 }]);

    const [params] = stripe.create.mock.calls[0];
    expect(FLAT_SHIPPING_CENTS).toBe(795);
    expect(params.shipping_options[0].shipping_rate_data.fixed_amount).toEqual({
      amount: FLAT_SHIPPING_CENTS,
      currency: 'usd',
    });
  });
});
