// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAIN,
  checkoutSession,
  createMailbox,
  lineItem,
  stripeEvent,
  webhookCall,
} from './helpers/checkoutFixtures.js';

const blobs = vi.hoisted(() => ({ current: null }));
const stripe = vi.hoisted(() => ({ create: vi.fn(), listLineItems: vi.fn(), retrieve: vi.fn() }));
const mail = vi.hoisted(() => ({ send: vi.fn(), box: null }));

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

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mail.send } };
  }),
}));

const { default: runMaintenance, config } =
  await import('../../netlify/functions/checkout-maintenance.js');
const { handler: createCheckout } =
  await import('../../netlify/functions/create-checkout-session.js');
const { handler: webhook } = await import('../../netlify/functions/stripe-webhook.js');
const { handler: inventory } = await import('../../netlify/functions/inventory.js');
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');

const KEY = stockKey(PLAIN);
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const MINUTE = 60 * 1000;

function stockDoc() {
  return blobs.current.read('inventory', 'stock');
}

function order(id = 'cs_test_created_1') {
  return blobs.current.read('orders', `orders/${id}.json`);
}

function outbox() {
  return blobs.current.keys('orders').filter((key) => key.startsWith('outbox/'));
}

async function available() {
  return JSON.parse((await inventory({ httpMethod: 'GET' })).body).stock[KEY];
}

// A checkout whose session id is cs_test_created_1, like every Stripe call
// in these tests.
async function startCheckout() {
  await createCheckout({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items: [{ slug: PLAIN, quantity: 1 }] }),
  });
  return stripe.create.mock.calls.at(-1)[0].metadata.holdId;
}

function sessionAtStripe(overrides) {
  return checkoutSession({ id: 'cs_test_created_1', ...overrides });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  blobs.current.reset();

  mail.box = createMailbox();
  mail.send.mockImplementation((...args) => mail.box.send(...args));

  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('URL', 'https://sattarimusic.com');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('ORDER_NOTIFICATION_FROM', 'orders@sattarimusic.com');
  vi.stubEnv('ORDER_NOTIFICATION_EMAIL', 'owner@example.com');

  stripe.create.mockResolvedValue({ id: 'cs_test_created_1', url: 'https://checkout.test/p' });
  stripe.listLineItems.mockResolvedValue({ data: [lineItem()] });
  blobs.current.write('inventory', 'stock', { [KEY]: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it('runs every ten minutes', () => {
  expect(config).toEqual({ schedule: '*/10 * * * *' });
});

describe('holds whose checkout ended without a webhook', () => {
  it('releases the hold once Stripe confirms the session expired', async () => {
    const holdId = await startCheckout();
    stripe.retrieve.mockResolvedValue(
      sessionAtStripe({ holdId, status: 'expired', payment_status: 'unpaid' })
    );

    // Still inside the session: the sweep does not even ask.
    vi.setSystemTime(NOW + 20 * MINUTE);
    await runMaintenance();
    expect(stripe.retrieve).not.toHaveBeenCalled();
    expect(await available()).toBe(0);

    vi.setSystemTime(NOW + 34 * MINUTE);
    await runMaintenance();

    expect(stripe.retrieve).toHaveBeenCalledWith('cs_test_created_1');
    expect(stockDoc()[HOLDS_FIELD]?.[holdId]).toBeUndefined();
    expect(await available()).toBe(1);
  });

  it('records a paid checkout whose completion webhook never arrived', async () => {
    const holdId = await startCheckout();
    stripe.retrieve.mockResolvedValue(sessionAtStripe({ holdId }));

    vi.setSystemTime(NOW + 34 * MINUTE);
    await runMaintenance();

    expect(order()).toMatchObject({
      paymentStatus: 'paid',
      stock: { state: 'applied' },
      notification: { state: 'sent' },
    });
    expect(stockDoc()[KEY]).toBe(0);
    expect(mail.send).toHaveBeenCalledTimes(1);

    // The late webhook, when it does arrive, changes nothing.
    await webhook(
      webhookCall(stripeEvent('checkout.session.completed', sessionAtStripe({ holdId })))
    );
    expect(stockDoc()[KEY]).toBe(0);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('leaves a session Stripe still has open alone', async () => {
    const holdId = await startCheckout();
    stripe.retrieve.mockResolvedValue(
      sessionAtStripe({ holdId, status: 'open', payment_status: 'unpaid' })
    );

    vi.setSystemTime(NOW + 34 * MINUTE);
    await runMaintenance();

    expect(stockDoc()[HOLDS_FIELD][holdId].state).toBe('active');
  });
});

describe('orders with unfinished work', () => {
  it('retries a failed owner email after its backoff and sends it exactly once', async () => {
    const holdId = await startCheckout();
    mail.box.failNext(1);
    await webhook(
      webhookCall(stripeEvent('checkout.session.completed', sessionAtStripe({ holdId })))
    );
    expect(order().notification.state).toBe('failed');

    await runMaintenance();
    expect(mail.send).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW + 2 * MINUTE);
    await runMaintenance();
    expect(order().notification.state).toBe('sent');
    expect(outbox()).toEqual([]);

    vi.setSystemTime(NOW + 60 * MINUTE);
    await runMaintenance();
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.box.delivered).toHaveLength(1);
    expect(stockDoc()[KEY]).toBe(0);
  });

  it('recovers an order whose claim marker was written but whose record never was', async () => {
    const holdId = await startCheckout();
    blobs.current.state.fault = ({ store, method, key }) =>
      store === 'orders' && method === 'setJSON' && key.startsWith('orders/')
        ? new Error('function timed out')
        : null;
    const first = await webhook(
      webhookCall(stripeEvent('checkout.session.completed', sessionAtStripe({ holdId })))
    );
    expect(first.statusCode).toBe(500);
    expect(order()).toBeNull();
    expect(outbox()).toEqual(['outbox/cs_test_created_1']);

    blobs.current.state.fault = null;
    stripe.retrieve.mockResolvedValue(sessionAtStripe({ holdId }));
    await runMaintenance();

    expect(order()).toMatchObject({ stock: { state: 'applied' }, notification: { state: 'sent' } });
    expect(stockDoc()[KEY]).toBe(0);
    expect(outbox()).toEqual([]);
  });

  it('settles a delayed payment whose success webhook was lost', async () => {
    const holdId = await startCheckout();
    await webhook(
      webhookCall(
        stripeEvent(
          'checkout.session.completed',
          sessionAtStripe({ holdId, payment_status: 'unpaid' })
        )
      )
    );
    stripe.retrieve.mockResolvedValue(sessionAtStripe({ holdId, payment_status: 'paid' }));

    await runMaintenance();

    expect(stripe.retrieve).toHaveBeenCalledWith('cs_test_created_1', {
      expand: ['payment_intent'],
    });
    expect(order()).toMatchObject({ paymentStatus: 'paid', stock: { state: 'applied' } });
    expect(stockDoc()[KEY]).toBe(0);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('releases stock for a delayed payment whose failure webhook was lost', async () => {
    const holdId = await startCheckout();
    await webhook(
      webhookCall(
        stripeEvent(
          'checkout.session.completed',
          sessionAtStripe({ holdId, payment_status: 'unpaid' })
        )
      )
    );
    stripe.retrieve.mockResolvedValue({
      ...sessionAtStripe({ holdId, payment_status: 'unpaid' }),
      payment_intent: { id: 'pi_test', status: 'requires_payment_method' },
    });

    await runMaintenance();

    expect(order()).toMatchObject({ paymentStatus: 'failed', stock: { state: 'released' } });
    expect(await available()).toBe(1);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('asks Stripe about a still-pending payment at most hourly', async () => {
    const holdId = await startCheckout();
    await webhook(
      webhookCall(
        stripeEvent(
          'checkout.session.completed',
          sessionAtStripe({ holdId, payment_status: 'unpaid' })
        )
      )
    );
    stripe.retrieve.mockResolvedValue({
      ...sessionAtStripe({ holdId, payment_status: 'unpaid' }),
      payment_intent: { id: 'pi_test', status: 'processing' },
    });

    await runMaintenance();
    vi.setSystemTime(NOW + 10 * MINUTE);
    await runMaintenance();
    expect(stripe.retrieve).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW + 61 * MINUTE);
    await runMaintenance();
    expect(stripe.retrieve).toHaveBeenCalledTimes(2);
    expect(order().paymentStatus).toBe('unpaid');
    expect(await available()).toBe(0);
  });
});
