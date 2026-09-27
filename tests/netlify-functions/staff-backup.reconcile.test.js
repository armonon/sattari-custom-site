// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAIN,
  checkoutSession,
  lineItem,
  stripeEvent,
  webhookCall,
} from './helpers/checkoutFixtures.js';

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

const { hashPassword, createSession } = await import('../../server/staffAuth.js');
const { handler: staffBackup } = await import('../../netlify/functions/staff-backup.js');
const { handler: staffStock } = await import('../../netlify/functions/staff-stock.js');
const { handler: staffOrders } = await import('../../netlify/functions/staff-orders.js');
const { handler: createCheckout } =
  await import('../../netlify/functions/create-checkout-session.js');
const { handler: webhook } = await import('../../netlify/functions/stripe-webhook.js');
const { HOLDS_FIELD, stockKey } = await import('../../src/utils/inventory.js');

const KEY = stockKey(PLAIN);
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

let token;
let sales = 0;

function staff(handler, method, body) {
  return handler({
    httpMethod: method,
    headers: { authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : '',
    queryStringParameters: {},
  });
}

function count() {
  return blobs.current.read('inventory', 'stock')[KEY];
}

async function recount(quantity) {
  const response = await staff(staffStock, 'POST', { updates: [{ key: KEY, quantity }] });
  expect(response.statusCode).toBe(200);
}

async function takeBackup() {
  const response = await staff(staffBackup, 'POST', { action: 'snapshot' });
  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body).key;
}

async function restore(key) {
  const response = await staff(staffBackup, 'POST', { action: 'restore', key, confirm: 'RESTORE' });
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

async function markOrder(orderId, status, tracking = '') {
  const response = await staff(staffOrders, 'POST', { orderId, status, tracking });
  expect(response.statusCode).toBe(200);
}

function fulfilment() {
  return blobs.current.read('fulfillment', 'status');
}

async function checkout() {
  const response = await createCheckout({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items: [{ slug: PLAIN, quantity: 1 }] }),
  });
  expect(response.statusCode).toBe(200);
  return stripe.create.mock.calls.at(-1)[0].metadata.holdId;
}

async function sell() {
  sales += 1;
  const holdId = await checkout();
  const id = `cs_test_sale_${sales}`;
  const response = await webhook(
    webhookCall(stripeEvent('checkout.session.completed', checkoutSession({ id, holdId })))
  );
  expect(response.statusCode).toBe(200);
  return id;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  blobs.current.reset();
  sales = 0;

  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('URL', 'https://sattarimusic.com');
  vi.stubEnv('STAFF_PASSWORD_SALT', 'salt');
  vi.stubEnv('STAFF_PASSWORD_HASH', hashPassword('pw', 'salt'));
  vi.stubEnv('STAFF_SESSION_SECRET', 'secret');
  token = createSession('Armon');

  stripe.create.mockImplementation(async () => ({
    id: `cs_test_unused_${Math.random()}`,
    url: 'https://checkout.test/p',
  }));
  stripe.listLineItems.mockResolvedValue({ data: [lineItem()] });
  blobs.current.write('inventory', 'stock', { [KEY]: 5 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('restoring stock from a backup', () => {
  it('keeps units sold after the backup sold, and only those', async () => {
    await sell();
    const backup = await takeBackup();
    expect(count()).toBe(4);

    // A bad bulk edit the restore is meant to undo, then a real sale.
    vi.setSystemTime(NOW + 60 * 1000);
    await recount(50);
    const soldLater = await sell();
    expect(count()).toBe(49);

    const { status, body } = await restore(backup);

    expect(status).toBe(200);
    // 4 in the backup, minus the 1 sold since. The sale before the backup is
    // already in the backup's count and is not subtracted again.
    expect(count()).toBe(3);
    expect(body.reconciliation.salesSinceBackup).toEqual([
      expect.objectContaining({ orderId: soldLater }),
    ]);
    expect(body.reconciliation.adjusted).toEqual([
      { key: KEY, backup: 4, soldSince: 1, restored: 3 },
    ]);
  });

  it('still subtracts later sales once their stock markers have been pruned', async () => {
    const backup = await takeBackup();
    vi.setSystemTime(NOW + 60 * 1000);
    await sell();

    // A week on, the sold marker is gone; the order record remains.
    vi.setSystemTime(NOW + 8 * DAY);
    token = createSession('Armon');
    await recount(4);
    expect(blobs.current.read('inventory', 'stock')[HOLDS_FIELD]).toBeUndefined();

    const { body } = await restore(backup);

    expect(count()).toBe(4);
    expect(body.reconciliation.adjusted).toEqual([
      { key: KEY, backup: 5, soldSince: 1, restored: 4 },
    ]);
  });

  it('counts a sale that lands while the restore is running', async () => {
    const backup = await takeBackup();
    vi.setSystemTime(NOW + 60 * 1000);

    // Between the restore reading the orders and writing the stock, a sale
    // commits. Its order is not in the list the restore already read.
    let raced = false;
    blobs.current.state.fault = ({ store, method }) => {
      if (raced || store !== 'inventory' || method !== 'getWithMetadata') return null;
      raced = true;
      blobs.current.write('inventory', 'stock', {
        [KEY]: 4,
        [HOLDS_FIELD]: {
          'racing-hold': {
            state: 'sold',
            soldAt: Date.now(),
            sessionId: 'cs_test_racing',
            lines: [{ key: KEY, quantity: 1 }],
          },
        },
      });
      return null;
    };

    const { body } = await restore(backup);

    expect(count()).toBe(4);
    expect(body.reconciliation.salesSinceBackup).toEqual([
      expect.objectContaining({ orderId: 'cs_test_racing' }),
    ]);
  });

  it('keeps open checkouts reserved and reports them', async () => {
    const backup = await takeBackup();
    vi.setSystemTime(NOW + 60 * 1000);
    const holdId = await checkout();

    const { body } = await restore(backup);

    expect(count()).toBe(5);
    expect(blobs.current.read('inventory', 'stock')[HOLDS_FIELD][holdId].state).toBe('active');
    expect(body.reconciliation.held).toEqual([{ key: KEY, held: 1, restored: 5, short: false }]);
  });

  it('lists paid orders from before stock lines were recorded instead of guessing', async () => {
    const backup = await takeBackup();
    blobs.current.write('orders', 'orders/cs_test_legacy.json', {
      id: 'cs_test_legacy',
      paymentStatus: 'paid',
      recordedAt: new Date(NOW + 60 * 1000).toISOString(),
      items: [{ description: 'Pirouz Series Cymbals', quantity: 1 }],
    });

    const { body } = await restore(backup);

    expect(count()).toBe(5);
    expect(body.reconciliation.unreconciledOrders).toEqual([
      { orderId: 'cs_test_legacy', recordedAt: new Date(NOW + 60 * 1000).toISOString() },
    ]);
  });

  it('changes nothing if the orders cannot be read to reconcile against', async () => {
    const backup = await takeBackup();
    await recount(9);
    blobs.current.state.fault = ({ store, method }) =>
      store === 'orders' && method === 'list' ? new Error('blob outage') : null;

    const { status, body } = await restore(backup);

    expect(status).toBe(503);
    expect(body.error).not.toContain('blob outage');
    expect(count()).toBe(9);
  });
});

describe('restoring fulfilment from a backup', () => {
  it('keeps the status of orders the backup does not cover', async () => {
    const packedBefore = await sell();
    const untouchedBefore = await sell();
    await markOrder(packedBefore, 'packed');
    const backup = await takeBackup();

    vi.setSystemTime(NOW + 60 * 1000);
    const placedAfter = await sell();
    await markOrder(placedAfter, 'shipped', '1Z999AA10123456784');
    await markOrder(untouchedBefore, 'collected');
    await markOrder(packedBefore, 'shipped');

    const { status, body } = await restore(backup);

    expect(status).toBe(200);
    expect(fulfilment()[placedAfter]).toMatchObject({
      status: 'shipped',
      tracking: '1Z999AA10123456784',
    });
    expect(fulfilment()[untouchedBefore].status).toBe('collected');
    // What the backup does cover goes back to how it was.
    expect(fulfilment()[packedBefore].status).toBe('packed');
    expect(body.reconciliation.fulfillmentKept).toHaveLength(2);
    expect(body.reconciliation.fulfillmentKept).toEqual(
      expect.arrayContaining([
        { orderId: placedAfter, status: 'shipped', reason: 'placed_after_backup' },
        { orderId: untouchedBefore, status: 'collected', reason: 'not_in_backup' },
      ])
    );
  });

  it('keeps a status change that lands while the restore is running', async () => {
    const backup = await takeBackup();
    vi.setSystemTime(NOW + 60 * 1000);
    const order = await sell();

    // Staff mark the new order shipped between the restore reading fulfilment
    // and writing it back.
    let raced = false;
    blobs.current.state.fault = ({ store, method }) => {
      if (raced || store !== 'fulfillment' || method !== 'setJSON') return null;
      raced = true;
      blobs.current.write('fulfillment', 'status', {
        [order]: { status: 'shipped', staff: 'Armon', tracking: 'LATE1', history: [] },
      });
      return null;
    };

    const { status, body } = await restore(backup);

    expect(status).toBe(200);
    expect(raced).toBe(true);
    expect(fulfilment()[order]).toMatchObject({ status: 'shipped', tracking: 'LATE1' });
    expect(body.reconciliation.fulfillmentKept).toEqual([
      { orderId: order, status: 'shipped', reason: 'placed_after_backup' },
    ]);
  });
});
