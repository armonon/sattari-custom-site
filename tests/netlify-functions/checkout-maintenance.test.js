// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWith } from './helpers/invoke.js';
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
  list: vi.fn(),
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
const createCheckout = callWith(
  (await import('../../netlify/functions/create-checkout-session.js')).default
);
const webhook = callWith((await import('../../netlify/functions/stripe-webhook.js')).default);
const inventory = callWith((await import('../../netlify/functions/inventory.js')).default);
const staffOrders = callWith((await import('../../netlify/functions/staff-orders.js')).default);
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');
const { readOrderWorkQueue } = await import('../../server/orderStore.js');
const { createSession } = await import('../../server/staffAuth.js');

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
  stripe.list.mockResolvedValue({ data: [], has_more: false });
  stripe.listLineItems.mockResolvedValue({ data: [lineItem()] });
  blobs.current.write('inventory', 'stock', { [KEY]: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

describe('paid checkouts nobody recorded', () => {
  it('records a paid cart of untracked items whose webhooks all failed', async () => {
    // Nothing is stock-tracked, so the checkout holds nothing the hold check
    // could find.
    blobs.current.write('inventory', 'stock', {});
    const holdId = await startCheckout();
    expect(stockDoc()[HOLDS_FIELD]).toBeUndefined();
    stripe.list.mockResolvedValue({
      data: [
        sessionAtStripe({ holdId }),
        // Not a shop checkout: a studio booking is recorded elsewhere.
        { ...sessionAtStripe({ id: 'cs_test_booking' }), metadata: { kind: 'studio_booking' } },
      ],
      has_more: false,
    });

    await runMaintenance();

    expect(stripe.list).toHaveBeenCalledWith({
      status: 'complete',
      created: { gte: Math.floor((NOW - 72 * 60 * MINUTE) / 1000) },
      limit: 100,
    });
    expect(order()).toMatchObject({ paymentStatus: 'paid', notification: { state: 'sent' } });
    expect(order('cs_test_booking')).toBeNull();

    // Found again on the next run, and left alone.
    await runMaintenance();
    expect(stripe.listLineItems).toHaveBeenCalledTimes(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('pages through Stripe until it has seen the whole window', async () => {
    stripe.list
      .mockResolvedValueOnce({ data: [sessionAtStripe({ id: 'cs_test_page_1' })], has_more: true })
      .mockResolvedValueOnce({ data: [], has_more: false });

    await runMaintenance();

    expect(stripe.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ starting_after: 'cs_test_page_1' })
    );
  });
});

describe('a backlog of unfinished orders', () => {
  function stuck(count) {
    return Array.from({ length: count }, (_, index) => {
      const id = `cs_test_stuck_${String(index).padStart(2, '0')}`;
      blobs.current.write('orders', `outbox/${id}`, { orderId: id, markedAt: NOW - 1000 + index });
      return id;
    });
  }

  it('gives every order a turn instead of retrying the same first ones', async () => {
    const ids = stuck(30);
    stripe.retrieve.mockRejectedValue(new Error('Stripe is having a moment'));

    await runMaintenance();
    expect(stripe.retrieve).toHaveBeenCalledTimes(25);

    stripe.retrieve.mockClear();
    await runMaintenance();
    expect(stripe.retrieve.mock.calls.map(([id]) => id)).toEqual(ids.slice(25));
  });

  it('parks an order after repeated failures and retries it daily', async () => {
    const [id] = stuck(1);
    blobs.current.write('orders', `outbox/${id}`, { orderId: id, markedAt: NOW, failures: 5 });
    stripe.retrieve.mockRejectedValue(new Error('No such checkout.session'));

    await runMaintenance();
    expect(blobs.current.read('orders', `outbox/${id}`)).toMatchObject({
      parked: true,
      failures: 6,
      lastError: 'No such checkout.session',
    });

    vi.setSystemTime(NOW + 60 * MINUTE);
    await runMaintenance();
    expect(stripe.retrieve).toHaveBeenCalledTimes(1);

    vi.setSystemTime(NOW + 24 * 60 * MINUTE + 1);
    await runMaintenance();
    expect(stripe.retrieve).toHaveBeenCalledTimes(2);
  });
});

describe('staying inside the 30-second limit on scheduled functions', () => {
  // A slow answer: each call moves the clock on before it returns.
  function slow(ms, value) {
    return async () => {
      vi.setSystemTime(Date.now() + ms);
      return typeof value === 'function' ? value() : structuredClone(value);
    };
  }

  it('counts the build hook against the run and starts no Stripe call after the budget', async () => {
    vi.stubEnv('BUILD_HOOK_URL', 'https://api.netlify.com/build_hooks/test');
    blobs.current.write('site-build', 'rebuild', {
      pending: true,
      firstRequestedAt: NOW - 60 * MINUTE,
      lastRequestedAt: NOW - 60 * MINUTE,
      reasons: ['product edited'],
    });
    const hook = vi.fn(slow(15000, () => new Response('', { status: 200 })));
    vi.stubGlobal('fetch', hook);
    for (const id of ['cs_test_slow_a', 'cs_test_slow_b', 'cs_test_slow_c']) {
      blobs.current.write('orders', `outbox/${id}`, { orderId: id, markedAt: NOW - 1000 });
    }
    stripe.retrieve.mockImplementation(slow(7000, { status: 'open' }));

    await runMaintenance();

    expect(hook).toHaveBeenCalledTimes(1);
    // 15 seconds on the hook leave room to start one 7-second call, not three.
    expect(stripe.retrieve).toHaveBeenCalledTimes(1);
    expect(Date.now() - NOW).toBeLessThanOrEqual(30000);
  });

  it('leaves the owner email for the next run once the time is up', async () => {
    const holdId = await startCheckout();
    blobs.current.write('orders', 'outbox/cs_test_created_1', {
      orderId: 'cs_test_created_1',
      markedAt: NOW,
    });
    // Paid, but nobody recorded it, and Stripe takes most of the run.
    stripe.retrieve.mockImplementation(slow(19000, sessionAtStripe({ holdId })));
    stripe.listLineItems.mockImplementation(slow(2000, { data: [lineItem()] }));

    await runMaintenance();

    expect(order()).toMatchObject({
      stock: { state: 'applied' },
      notification: { state: 'pending' },
    });
    expect(mail.send).not.toHaveBeenCalled();
    expect(outbox()).toEqual(['outbox/cs_test_created_1']);

    vi.setSystemTime(Date.now() + 10 * MINUTE);
    await runMaintenance();

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(order().notification.state).toBe('sent');
    expect(outbox()).toEqual([]);
  });
});

describe('the queue of unfinished orders', () => {
  it('reads every marker, soonest due first, the same way every time', async () => {
    const markers = [
      { orderId: 'cs_test_c', markedAt: NOW - 3000 },
      { orderId: 'cs_test_a', markedAt: NOW - 1000, nextCheckAt: NOW + 5 * MINUTE },
      { orderId: 'cs_test_b', markedAt: NOW - 2000 },
    ];
    for (const marker of markers) {
      blobs.current.write('orders', `outbox/${marker.orderId}`, marker);
    }

    const first = await readOrderWorkQueue(undefined);
    const again = await readOrderWorkQueue(undefined);

    expect(first.total).toBe(3);
    expect(first.markers.map((marker) => marker.orderId)).toEqual([
      'cs_test_c',
      'cs_test_b',
      'cs_test_a',
    ]);
    expect(again).toEqual(first);
  });

  it('works through a backlog bigger than one read in fixed turns', async () => {
    for (let i = 0; i < 5; i += 1) {
      blobs.current.write('orders', `outbox/cs_test_${i}`, {
        orderId: `cs_test_${i}`,
        markedAt: i,
      });
    }
    const seen = new Set();
    for (let run = 0; run < 3; run += 1) {
      const { markers, total } = await readOrderWorkQueue(undefined, {
        limit: 2,
        now: run * 10 * MINUTE,
      });
      expect(total).toBe(5);
      expect(markers).toHaveLength(2);
      markers.forEach((marker) => seen.add(marker.orderId));
    }
    expect(seen.size).toBe(5);
  });
});

describe('dismissing a parked checkout', () => {
  function staff(method, body) {
    return staffOrders({
      httpMethod: method,
      headers: { authorization: `Bearer ${createSession('Armon')}` },
      body: body ? JSON.stringify(body) : '',
    });
  }

  beforeEach(() => {
    vi.stubEnv('STAFF_SESSION_SECRET', 'secret');
  });

  it('lists parked checkouts for staff and lets them stop the retries', async () => {
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const [id, failures] of [
      ['cs_test_parked', 5],
      ['cs_test_failing', 1],
    ]) {
      blobs.current.write('orders', `outbox/${id}`, { orderId: id, markedAt: NOW, failures });
    }
    // Test-mode sessions that do not exist under the live key.
    stripe.retrieve.mockRejectedValue(new Error('No such checkout.session'));
    await runMaintenance();

    const listed = JSON.parse((await staff('GET')).body);
    expect(listed).toMatchObject({
      stuckTotal: 1,
      stuck: [{ orderId: 'cs_test_parked', lastError: 'No such checkout.session' }],
    });

    // Only a parked checkout can be dismissed: the other may still finish.
    expect(
      (await staff('POST', { action: 'dismiss-stuck', orderId: 'cs_test_failing' })).statusCode
    ).toBe(404);
    expect(
      (await staff('POST', { action: 'dismiss-stuck', orderId: 'cs_test_parked' })).statusCode
    ).toBe(200);

    expect(outbox()).toEqual(['outbox/cs_test_failing']);
    expect(JSON.parse((await staff('GET')).body)).toMatchObject({ stuck: [], stuckTotal: 0 });
    expect(logs).toHaveBeenCalledWith(
      expect.stringMatching(
        /"type":"staff-dismiss-stuck-order","staff":"Armon","orderId":"cs_test_parked"/
      )
    );
  });
});
