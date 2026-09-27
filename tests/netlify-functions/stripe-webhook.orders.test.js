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
const stripe = vi.hoisted(() => ({
  create: vi.fn(),
  listLineItems: vi.fn(),
  retrieve: vi.fn(),
}));
const mail = vi.hoisted(() => ({ send: vi.fn(), box: null }));

vi.mock('@netlify/blobs', async () => {
  const { createMemoryBlobs } = await import('./helpers/memoryBlobs.js');
  blobs.current = createMemoryBlobs();
  return blobs.current.module;
});

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: {
        constructEvent: (body, signature) => {
          if (signature === 'forged') {
            throw new Error('No signatures found matching the expected signature for payload');
          }
          return JSON.parse(body);
        },
      },
      checkout: { sessions: stripe },
    };
  }),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mail.send } };
  }),
}));

const { handler: webhook } = await import('../../netlify/functions/stripe-webhook.js');
const { handler: createCheckout } =
  await import('../../netlify/functions/create-checkout-session.js');
const { handler: inventory } = await import('../../netlify/functions/inventory.js');
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');

const KEY = stockKey(PLAIN);
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const MINUTE = 60 * 1000;

function setStock(count) {
  blobs.current.write('inventory', 'stock', { [KEY]: count });
}

function stockDoc() {
  return blobs.current.read('inventory', 'stock');
}

function order(id = 'cs_test_order_one') {
  return blobs.current.read('orders', `orders/${id}.json`);
}

function outbox() {
  return blobs.current.keys('orders').filter((key) => key.startsWith('outbox/'));
}

async function available() {
  return JSON.parse((await inventory({ httpMethod: 'GET' })).body).stock[KEY];
}

async function startCheckout(quantity = 1) {
  const response = await createCheckout({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items: [{ slug: PLAIN, quantity }] }),
  });
  const params = stripe.create.mock.calls.at(-1)?.[0];
  return { response, holdId: response.statusCode === 200 ? params.metadata.holdId : null };
}

function deliver(type, session) {
  return webhook(webhookCall(stripeEvent(type, session)));
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

  let created = 0;
  stripe.create.mockImplementation(async () => {
    created += 1;
    return { id: `cs_test_created_${created}`, url: 'https://checkout.stripe.test/pay' };
  });
  stripe.listLineItems.mockResolvedValue({ data: [lineItem()] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('recording a paid checkout', () => {
  it('saves the order, takes the unit out of stock, and emails the owner once', async () => {
    setStock(3);
    const { holdId } = await startCheckout();

    const response = await deliver('checkout.session.completed', checkoutSession({ holdId }));

    expect(response.statusCode).toBe(200);
    expect(stockDoc()[KEY]).toBe(2);
    expect(stockDoc()[HOLDS_FIELD][holdId].state).toBe('sold');
    expect(order()).toMatchObject({
      paymentStatus: 'paid',
      stock: { state: 'applied', holdId, oversold: [] },
      notification: { state: 'sent', attempts: 1 },
    });
    expect(mail.box.delivered).toHaveLength(1);
    expect(outbox()).toEqual([]);
  });

  it('decrements once and emails once when duplicate deliveries run concurrently', async () => {
    setStock(3);
    const { holdId } = await startCheckout();
    const event = stripeEvent('checkout.session.completed', checkoutSession({ holdId }));

    const responses = await Promise.all([
      webhook(webhookCall(event)),
      webhook(webhookCall(event)),
      webhook(webhookCall(event)),
    ]);

    // All three got past "is this order recorded yet?" before any of them
    // recorded it, so only the conditional claim kept them apart.
    expect(stripe.listLineItems).toHaveBeenCalledTimes(3);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
    expect(stockDoc()[KEY]).toBe(2);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(order().notification.state).toBe('sent');
  });

  it('finishes stock and email exactly once when the first delivery dies after saving', async () => {
    setStock(3);
    const { holdId } = await startCheckout();
    const event = stripeEvent('checkout.session.completed', checkoutSession({ holdId }));

    // The claim is written, then the function dies before touching stock.
    blobs.current.state.fault = ({ store }) =>
      store === 'inventory' ? new Error('function timed out') : null;
    const first = await webhook(webhookCall(event));

    expect(first.statusCode).toBe(500);
    expect(order()).toMatchObject({
      paymentStatus: 'paid',
      stock: { state: 'pending' },
      notification: { state: 'pending' },
    });
    expect(stockDoc()[KEY]).toBe(3);
    expect(mail.send).not.toHaveBeenCalled();

    // Stripe's retry used to be swallowed by the "already recorded" guard.
    blobs.current.state.fault = null;
    const retry = await webhook(webhookCall(event));

    expect(retry.statusCode).toBe(200);
    expect(stockDoc()[KEY]).toBe(2);
    expect(mail.send).toHaveBeenCalledTimes(1);

    const later = await webhook(webhookCall(event));
    expect(later.statusCode).toBe(200);
    expect(stockDoc()[KEY]).toBe(2);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('does not decrement twice when the function dies between the stock write and the order update', async () => {
    setStock(3);
    const { holdId } = await startCheckout();
    const event = stripeEvent('checkout.session.completed', checkoutSession({ holdId }));

    blobs.current.state.fault = ({ store, method, value }) =>
      store === 'orders' && method === 'setJSON' && value?.stock?.state === 'applied'
        ? new Error('function timed out')
        : null;
    expect((await webhook(webhookCall(event))).statusCode).toBe(500);
    expect(stockDoc()[KEY]).toBe(2);
    expect(order().stock.state).toBe('pending');

    blobs.current.state.fault = null;
    expect((await webhook(webhookCall(event))).statusCode).toBe(200);

    expect(stockDoc()[KEY]).toBe(2);
    expect(order().stock.state).toBe('applied');
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('does not email twice when the function dies after the email was accepted', async () => {
    setStock(3);
    const { holdId } = await startCheckout();
    const event = stripeEvent('checkout.session.completed', checkoutSession({ holdId }));

    blobs.current.state.fault = ({ store, method, value }) =>
      store === 'orders' && method === 'setJSON' && value?.notification?.state === 'sent'
        ? new Error('function timed out')
        : null;
    expect((await webhook(webhookCall(event))).statusCode).toBe(500);
    blobs.current.state.fault = null;
    expect(order().notification.state).toBe('sending');

    // Inside the lease another delivery leaves the send to its owner.
    expect((await webhook(webhookCall(event))).statusCode).toBe(200);
    expect(mail.send).toHaveBeenCalledTimes(1);

    // After the lease lapses the retry reuses the idempotency key, so the
    // provider returns the original send rather than a second email.
    vi.setSystemTime(NOW + 6 * MINUTE);
    expect((await webhook(webhookCall(event))).statusCode).toBe(200);

    expect(mail.box.delivered).toHaveLength(1);
    const keys = mail.send.mock.calls.map(([, options]) => options.idempotencyKey);
    expect(new Set(keys)).toEqual(new Set(['sattari-order-cs_test_order_one']));
    expect(order().notification.state).toBe('sent');
  });

  it('leaves orders recorded by the previous webhook alone', async () => {
    setStock(3);
    blobs.current.write('orders', 'orders/cs_test_legacy.json', {
      id: 'cs_test_legacy',
      paymentStatus: 'paid',
      items: [],
    });

    const response = await deliver(
      'checkout.session.completed',
      checkoutSession({ id: 'cs_test_legacy' })
    );

    expect(response.statusCode).toBe(200);
    expect(stockDoc()[KEY]).toBe(3);
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('payment status', () => {
  it('records an unpaid completion as pending without selling or emailing, and keeps the unit reserved', async () => {
    setStock(1);
    const { holdId } = await startCheckout();

    const response = await deliver(
      'checkout.session.completed',
      checkoutSession({ holdId, payment_status: 'unpaid' })
    );

    expect(response.statusCode).toBe(200);
    expect(order()).toMatchObject({
      paymentStatus: 'unpaid',
      stock: { state: 'awaiting_payment' },
      notification: { state: 'awaiting_payment' },
    });
    expect(stockDoc()[KEY]).toBe(1);
    expect(mail.send).not.toHaveBeenCalled();

    const hold = stockDoc()[HOLDS_FIELD][holdId];
    expect(hold.state).toBe('pending');
    expect(hold.expiresAt).toBeGreaterThan(NOW + 6 * 24 * 60 * MINUTE);

    // Long past the checkout window, the unit is still reserved for the
    // customer whose bank payment is clearing.
    vi.setSystemTime(NOW + 3 * 60 * MINUTE);
    expect(await available()).toBe(0);
    expect((await startCheckout()).response.statusCode).toBe(409);
  });

  it('completes the sale when the delayed payment succeeds, exactly once', async () => {
    setStock(1);
    const { holdId } = await startCheckout();
    await deliver(
      'checkout.session.completed',
      checkoutSession({ holdId, payment_status: 'unpaid' })
    );

    const success = stripeEvent(
      'checkout.session.async_payment_succeeded',
      checkoutSession({ holdId, payment_status: 'paid' })
    );
    expect((await webhook(webhookCall(success))).statusCode).toBe(200);
    expect((await webhook(webhookCall(success))).statusCode).toBe(200);

    expect(order()).toMatchObject({
      paymentStatus: 'paid',
      stock: { state: 'applied' },
      notification: { state: 'sent' },
    });
    expect(stockDoc()[KEY]).toBe(0);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('marks the order failed and releases the hold when the delayed payment fails', async () => {
    setStock(1);
    const { holdId } = await startCheckout();
    await deliver(
      'checkout.session.completed',
      checkoutSession({ holdId, payment_status: 'unpaid' })
    );

    const response = await deliver(
      'checkout.session.async_payment_failed',
      checkoutSession({ holdId, payment_status: 'unpaid' })
    );

    expect(response.statusCode).toBe(200);
    expect(order()).toMatchObject({
      paymentStatus: 'failed',
      stock: { state: 'released' },
      notification: { state: 'not_required' },
    });
    expect(stockDoc()[HOLDS_FIELD]?.[holdId]).toBeUndefined();
    expect(stockDoc()[KEY]).toBe(1);
    expect(await available()).toBe(1);
    expect(mail.send).not.toHaveBeenCalled();
    expect(outbox()).toEqual([]);
  });

  it('never moves a paid order back to pending when events arrive out of order', async () => {
    setStock(2);
    const { holdId } = await startCheckout();

    await deliver(
      'checkout.session.async_payment_succeeded',
      checkoutSession({ holdId, payment_status: 'paid' })
    );
    await deliver(
      'checkout.session.completed',
      checkoutSession({ holdId, payment_status: 'unpaid' })
    );

    expect(order().paymentStatus).toBe('paid');
    expect(stockDoc()[KEY]).toBe(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});

describe('overselling', () => {
  it('records a paid order stock cannot cover and alerts the owner, without taking another customer’s unit', async () => {
    setStock(1);
    const late = await startCheckout();

    // Customer A's hold lapses (session + grace) before their payment is
    // recorded; customer B reserves the unit in the meantime.
    vi.setSystemTime(NOW + 50 * MINUTE);
    const next = await startCheckout();
    expect(next.response.statusCode).toBe(200);

    await deliver(
      'checkout.session.completed',
      checkoutSession({ id: 'cs_test_late', holdId: late.holdId })
    );

    expect(order('cs_test_late').stock.oversold).toEqual([
      expect.objectContaining({ key: KEY, requested: 1, available: 0 }),
    ]);
    expect(stockDoc()[KEY]).toBe(1);
    expect(stockDoc()[HOLDS_FIELD][next.holdId].state).toBe('active');

    const alert = mail.box.delivered[0];
    expect(alert.subject).toMatch(/^ACTION NEEDED/);
    expect(alert.text).toContain('Pirouz Series Cymbals: ordered 1, only 0 available');

    await deliver(
      'checkout.session.completed',
      checkoutSession({ id: 'cs_test_on_time', holdId: next.holdId })
    );
    expect(order('cs_test_on_time').stock.oversold).toEqual([]);
    expect(stockDoc()[KEY]).toBe(0);
    expect(mail.box.delivered[1].subject).not.toMatch(/ACTION NEEDED/);
  });
});

describe('owner notification reliability', () => {
  it('retries a rejected email on the next delivery and sends it exactly once', async () => {
    setStock(3);
    const { holdId } = await startCheckout();
    const event = stripeEvent('checkout.session.completed', checkoutSession({ holdId }));
    mail.box.failNext(1);

    const first = await webhook(webhookCall(event));
    expect(first.statusCode).toBe(500);
    expect(order().notification).toMatchObject({ state: 'failed', attempts: 1 });
    expect(order().stock.state).toBe('applied');
    expect(outbox()).toEqual(['outbox/cs_test_order_one']);

    expect((await webhook(webhookCall(event))).statusCode).toBe(200);
    expect(order().notification).toMatchObject({ state: 'sent', attempts: 2 });

    expect((await webhook(webhookCall(event))).statusCode).toBe(200);
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect(mail.box.delivered).toHaveLength(1);
    expect(stockDoc()[KEY]).toBe(2);
    expect(outbox()).toEqual([]);
  });
});

describe('error responses', () => {
  it('answers a forged signature without echoing the verifier', async () => {
    const response = await webhook({
      httpMethod: 'POST',
      headers: { 'stripe-signature': 'forged' },
      body: '{}',
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Invalid webhook signature.' });
  });

  it('answers a processing failure with a generic error Stripe will retry', async () => {
    blobs.current.state.fault = () => new Error('ECONNRESET internal-blob-host.example:443');

    const response = await deliver('checkout.session.completed', checkoutSession());

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('internal-blob-host');
    expect(JSON.parse(response.body)).toEqual({ error: 'Webhook processing failed.' });
  });
});
