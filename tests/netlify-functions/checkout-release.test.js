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

const { handler: release } = await import('../../netlify/functions/checkout-release.js');
const { handler: createCheckout } =
  await import('../../netlify/functions/create-checkout-session.js');
const { handler: webhook } = await import('../../netlify/functions/stripe-webhook.js');
const { handler: inventory } = await import('../../netlify/functions/inventory.js');
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');

const KEY = stockKey(PLAIN);
const NOW = new Date('2026-10-01T12:00:00Z').getTime();

let stripeSessions;

function stockDoc() {
  return blobs.current.read('inventory', 'stock');
}

function holds() {
  return stockDoc()?.[HOLDS_FIELD] || {};
}

async function available() {
  return JSON.parse((await inventory({ httpMethod: 'GET' })).body).stock[KEY];
}

async function startCheckout() {
  const response = await createCheckout({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items: [{ slug: PLAIN, quantity: 1 }] }),
  });
  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body).id;
}

function holdIdOf(sessionId) {
  return stripeSessions.sessions.get(sessionId).metadata.holdId;
}

function releaseSession(sessionId) {
  return release({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ sessionId }) });
}

function deliver(type, session) {
  return webhook(webhookCall(stripeEvent(type, session)));
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
  blobs.current.write('inventory', 'stock', { [KEY]: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('releasing a checkout the shopper walked away from', () => {
  it('expires the open session at Stripe and puts its units back on sale at once', async () => {
    const sessionId = await startCheckout();
    expect(await available()).toBe(0);

    const response = await releaseSession(sessionId);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(stripe.expire).toHaveBeenCalledWith(sessionId);
    expect(stripeSessions.sessions.get(sessionId).status).toBe('expired');
    expect(holds()).toEqual({});
    expect(await available()).toBe(1);
    // Nobody has to wait for the session to time out.
    await startCheckout();
  });

  it('changes nothing when repeated, or when Stripe’s own expiry event follows', async () => {
    const abandoned = await startCheckout();
    await releaseSession(abandoned);
    const next = await startCheckout();
    const before = stockDoc();

    expect((await releaseSession(abandoned)).statusCode).toBe(200);
    await deliver('checkout.session.expired', stripeSessions.sessions.get(abandoned));

    expect(stockDoc()).toEqual(before);
    expect(holds()[holdIdOf(next)].state).toBe('active');
    expect(stripe.expire).toHaveBeenCalledTimes(1);
    expect(await available()).toBe(0);
  });

  it('never gives back the units of a paid checkout', async () => {
    const sessionId = await startCheckout();
    await deliver('checkout.session.completed', stripeSessions.complete(sessionId));
    expect(holds()[holdIdOf(sessionId)].state).toBe('sold');
    const before = stockDoc();

    expect((await releaseSession(sessionId)).statusCode).toBe(200);

    expect(stripe.expire).not.toHaveBeenCalled();
    expect(stockDoc()).toEqual(before);
    expect(stockDoc()[KEY]).toBe(0);
  });

  it('keeps a delayed payment’s units reserved while it settles', async () => {
    const sessionId = await startCheckout();
    await deliver('checkout.session.completed', stripeSessions.complete(sessionId, 'unpaid'));
    expect(holds()[holdIdOf(sessionId)].state).toBe('pending');

    await releaseSession(sessionId);

    expect(stripe.expire).not.toHaveBeenCalled();
    expect(holds()[holdIdOf(sessionId)].state).toBe('pending');
    expect(await available()).toBe(0);
  });

  it('keeps the hold when the shopper pays while the release is on its way', async () => {
    const sessionId = await startCheckout();
    stripe.expire.mockImplementationOnce(async (id) => {
      stripeSessions.complete(id);
      throw new Error('Only Checkout Sessions with a status in ["open"] can be expired.');
    });

    expect((await releaseSession(sessionId)).statusCode).toBe(200);

    expect(holds()[holdIdOf(sessionId)].state).toBe('active');
    await deliver('checkout.session.completed', stripeSessions.sessions.get(sessionId));
    expect(stockDoc()[KEY]).toBe(0);
    expect(holds()[holdIdOf(sessionId)].state).toBe('sold');
  });

  it('answers the same for ids Stripe does not know, and changes nothing', async () => {
    await startCheckout();
    const before = stockDoc();

    const response = await releaseSession('cs_test_nobody_has_this_one');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(stockDoc()).toEqual(before);
  });

  it('leaves a studio booking’s payment link alone', async () => {
    stripe.retrieve.mockResolvedValueOnce({
      id: 'cs_test_booking_1',
      status: 'open',
      metadata: { kind: 'studio_booking', bookingId: 'booking-1' },
    });

    expect((await releaseSession('cs_test_booking_1')).statusCode).toBe(200);
    expect(stripe.expire).not.toHaveBeenCalled();
  });

  it('refuses malformed requests without calling Stripe', async () => {
    expect((await releaseSession('../../v1/customers')).statusCode).toBe(400);
    expect((await release({ httpMethod: 'POST', body: '{not json' })).statusCode).toBe(400);
    expect((await release({ httpMethod: 'GET', body: '' })).statusCode).toBe(405);
    expect(stripe.retrieve).not.toHaveBeenCalled();
  });
});
