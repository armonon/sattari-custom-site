// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAIN,
  fakeCheckoutSessions,
  lineItem,
  stripeEvent,
  webhookCall,
} from './helpers/checkoutFixtures.js';

const blobs = vi.hoisted(() => ({ current: null }));
const stripe = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  listLineItems: vi.fn(),
}));

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
const { handler: webhook } = await import('../../netlify/functions/stripe-webhook.js');
const { handler: inventory } = await import('../../netlify/functions/inventory.js');
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');

// A second tracked product: the 16" effect cymbal.
const SIZED = 'sattari-effect-cymbal';
const KEY = stockKey(PLAIN);
const SIZED_KEY = stockKey(SIZED, '16"');
const NOW = new Date('2026-10-01T12:00:00Z').getTime();

const CYMBAL = [{ slug: PLAIN, quantity: 1 }];

let stripeSessions;

function holds() {
  return blobs.current.read('inventory', 'stock')?.[HOLDS_FIELD] || {};
}

function holdIdOf(sessionId) {
  return stripeSessions.sessions.get(sessionId).metadata.holdId;
}

async function available(key = KEY) {
  return JSON.parse((await inventory({ httpMethod: 'GET' })).body).stock[key];
}

async function post(items, extra = {}) {
  const response = await createCheckout({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items, ...extra }),
  });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  blobs.current.reset();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('URL', 'https://sattarimusic.com');

  stripeSessions = fakeCheckoutSessions(stripe);
  stripe.listLineItems.mockResolvedValue({ data: [lineItem()] });
  blobs.current.write('inventory', 'stock', { [KEY]: 1, [SIZED_KEY]: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('checking out again after backing out of Stripe', () => {
  it('lets the shopper re-reserve the last unit their abandoned checkout was holding', async () => {
    const first = await post(CYMBAL);
    expect(first.status).toBe(200);

    // Without naming it, their own hold is in the way.
    expect((await post(CYMBAL)).status).toBe(409);

    const again = await post(CYMBAL, { replacesSessionId: first.body.id });

    expect(again.status).toBe(200);
    expect(stripe.expire).toHaveBeenCalledWith(first.body.id);
    expect(stripeSessions.sessions.get(first.body.id).status).toBe('expired');
    expect(Object.keys(holds())).toEqual([holdIdOf(again.body.id)]);
    expect(holds()[holdIdOf(again.body.id)]).toMatchObject({
      state: 'active',
      sessionId: again.body.id,
      lines: [{ key: KEY, quantity: 1 }],
    });
    expect(await available()).toBe(0);
  });

  it('still blocks a shopper from a unit someone else is checking out', async () => {
    const someoneElse = await post(CYMBAL);
    const mine = await post([{ slug: SIZED, size: '16"', quantity: 1 }]);
    expect(await available(SIZED_KEY)).toBe(0);

    // Back from Stripe, the shopper swaps the 16" for the last Pirouz cymbal.
    const swapped = await post(CYMBAL, { replacesSessionId: mine.body.id });

    expect(swapped.status).toBe(409);
    expect(swapped.body.error).toMatch(/being checked out by another customer/);
    expect(holds()[holdIdOf(someoneElse.body.id)].state).toBe('active');
    expect(stripeSessions.sessions.get(someoneElse.body.id).status).toBe('open');
    // Their own abandoned checkout is gone either way.
    expect(stripeSessions.sessions.get(mine.body.id).status).toBe('expired');
    expect(holds()[holdIdOf(mine.body.id)]).toBeUndefined();
    expect(await available(SIZED_KEY)).toBe(1);
    expect(await available()).toBe(0);
  });

  it.each([
    ['paid', 'sold'],
    ['unpaid', 'pending'],
  ])('never takes units back from a completed checkout (%s)', async (paymentStatus, state) => {
    const first = await post(CYMBAL);
    await webhook(
      webhookCall(
        stripeEvent(
          'checkout.session.completed',
          stripeSessions.complete(first.body.id, paymentStatus)
        )
      )
    );
    const before = blobs.current.read('inventory', 'stock');

    const again = await post(CYMBAL, { replacesSessionId: first.body.id });

    expect(again.status).toBe(409);
    expect(stripe.expire).not.toHaveBeenCalled();
    expect(holds()[holdIdOf(first.body.id)].state).toBe(state);
    expect(blobs.current.read('inventory', 'stock')).toEqual(before);
  });

  it('checks out as usual when the replaced session is malformed or cannot be looked up', async () => {
    blobs.current.write('inventory', 'stock', { [KEY]: 3 });
    const first = await post(CYMBAL);

    expect((await post(CYMBAL, { replacesSessionId: 'not-a-session' })).status).toBe(200);
    expect(stripe.retrieve).not.toHaveBeenCalled();

    stripe.retrieve.mockRejectedValueOnce(new Error('Stripe is having a moment'));
    expect((await post(CYMBAL, { replacesSessionId: first.body.id })).status).toBe(200);
    // Not confirmed expired, so its hold stays until it lapses.
    expect(holds()[holdIdOf(first.body.id)].state).toBe('active');
    expect(await available()).toBe(0);
  });
});
