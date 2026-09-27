// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStore } from '@netlify/blobs';

const stripe = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn() }));

// The developer's real .env must not leak into a test run.
vi.mock('dotenv/config', () => ({}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return { checkout: { sessions: stripe } };
  }),
}));

const { ROUTES, createDevApp, startLocalBlobs } = await import('../../server/checkout-server.js');
const createCheckoutFunction = await import('../../netlify/functions/create-checkout-session.js');
const { FLAT_SHIPPING_CENTS } = await import('../../src/data/shipping.js');
const { stockKey } = await import('../../src/utils/inventory.js');

const KEY = stockKey('pirouz-series-cymbals');

let directory;
let blobs;
let listener;
let base;

function api(pathname, options = {}) {
  return fetch(`${base}${pathname}`, options);
}

function checkout() {
  return api('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ slug: 'pirouz-series-cymbals', quantity: 1 }] }),
  });
}

async function available() {
  return (await (await api('/api/inventory')).json()).stock[KEY];
}

beforeAll(async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('URL', 'http://localhost:5173');

  directory = await mkdtemp(path.join(os.tmpdir(), 'sattari-dev-api-'));
  blobs = await startLocalBlobs(directory);
  const app = createDevApp({ lambdaBlobs: blobs.lambdaBlobs, clientUrl: 'http://localhost:5173' });

  await new Promise((resolve) => {
    listener = app.listen(0, resolve);
  });
  base = `http://localhost:${listener.address().port}`;

  await getStore({ name: 'inventory', consistency: 'strong' }).setJSON('stock', { [KEY]: 2 });
});

afterAll(async () => {
  await new Promise((resolve) => listener.close(resolve));
  await blobs.server.stop();
  await rm(directory, { recursive: true, force: true });
  delete globalThis.netlifyBlobsContext;
  vi.unstubAllEnvs();
});

beforeEach(() => {
  let created = 0;
  stripe.create.mockImplementation(async () => {
    created += 1;
    return { id: `cs_test_dev_${created}`, url: 'https://checkout.stripe.test/pay' };
  });
});

describe('npm run dev:api', () => {
  it('mounts the production function modules, not copies of them', () => {
    expect(ROUTES['/api/create-checkout-session']).toBe(createCheckoutFunction);
  });

  it('runs the production checkout: catalog, holds, expiry, and the shared shipping rate', async () => {
    const response = await checkout();

    expect(response.status).toBe(200);
    const [params] = stripe.create.mock.calls.at(-1);
    expect(params.shipping_options[0].shipping_rate_data.fixed_amount.amount).toBe(
      FLAT_SHIPPING_CENTS
    );
    expect(params.metadata.holdId).toEqual(expect.any(String));
    expect(params.expires_at).toEqual(expect.any(Number));
    expect(params.success_url).toMatch(/^http:\/\/localhost:5173\/checkout\/success/);
    expect(await available()).toBe(1);
  });

  it('supports the conditional writes stock depends on across repeated writes', async () => {
    // The second reservation needs an ETag from the local Blobs server.
    expect((await checkout()).status).toBe(200);
    expect(await available()).toBe(0);

    const refused = await checkout();
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe('out_of_stock');
  });

  it('answers with the function’s own status codes and bodies', async () => {
    const response = await api('/api/create-checkout-session');

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Method not allowed.' });
  });

  it('serves the minimal session status', async () => {
    stripe.retrieve.mockResolvedValue({
      id: 'cs_test_dev_1',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 8795,
      currency: 'usd',
      customer_details: { email: 'jane@gmail.com', name: 'Jane Doe' },
    });

    const response = await api('/api/checkout-session-status?session_id=cs_test_dev_1');

    expect(await response.json()).toEqual({
      id: 'cs_test_dev_1',
      status: 'complete',
      payment_status: 'paid',
      amount_total: 8795,
      currency: 'usd',
      customer_email_masked: 'j•••@gmail.com',
    });
  });
});
