import { beforeEach, describe, expect, it, vi } from 'vitest';

// Two stores: 'orders' (written by the Stripe webhook) and 'fulfillment'.
const stores = { orders: {}, fulfillment: { value: null, etag: null, writes: 0 } };

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn((options) => {
    const name = typeof options === 'string' ? options : options?.name;

    if (name === 'orders') {
      return {
        async get(key) {
          return stores.orders[key] ? JSON.parse(JSON.stringify(stores.orders[key])) : null;
        },
        async list() {
          return { blobs: Object.keys(stores.orders).map((key) => ({ key })) };
        },
      };
    }

    const f = stores.fulfillment;
    return {
      async get() {
        return f.value === null ? null : JSON.parse(JSON.stringify(f.value));
      },
      async getWithMetadata() {
        if (f.value === null) return null;
        return { data: JSON.parse(JSON.stringify(f.value)), etag: f.etag };
      },
      async setJSON(key, value, options = {}) {
        f.writes += 1;
        if (options.onlyIfNew && f.value !== null) return { modified: false };
        if (options.onlyIfMatch && options.onlyIfMatch !== f.etag) return { modified: false };
        f.value = JSON.parse(JSON.stringify(value));
        f.etag = `etag-${f.writes}`;
        return { modified: true, etag: f.etag };
      },
    };
  }),
}));

const { hashPassword, createSession } = await import('../../server/staffAuth.js');
const { handler } = await import('../../netlify/functions/staff-orders.js');

let token;

function call(method, opts = {}) {
  return handler({
    httpMethod: method,
    headers: opts.anon ? {} : { authorization: `Bearer ${token}` },
    body: opts.body ? JSON.stringify(opts.body) : '',
    queryStringParameters: opts.query || {},
  });
}

const ORDER = {
  id: 'cs_1',
  paymentStatus: 'paid',
  amountTotal: 25000,
  currency: 'usd',
  customerName: 'A Customer',
  customerEmail: 'buyer@example.com',
  recordedAt: new Date().toISOString(),
  items: [{ description: 'Cymbal', quantity: 1, amountTotal: 25000 }],
  shipping: { name: 'A Customer', address: { city: 'Los Angeles', state: 'CA' } },
};

beforeEach(() => {
  stores.orders = { 'orders/cs_1.json': ORDER };
  stores.fulfillment = { value: null, etag: null, writes: 0 };
  process.env.STAFF_PASSWORD_SALT = 'salt';
  process.env.STAFF_PASSWORD_HASH = hashPassword('pw', 'salt');
  process.env.STAFF_SESSION_SECRET = 'secret';
  token = createSession('Armon');
});

describe('access', () => {
  it('refuses unauthenticated reads and writes', async () => {
    expect((await call('GET', { anon: true })).statusCode).toBe(401);

    const write = await call('POST', { anon: true, body: { orderId: 'cs_1', status: 'packed' } });
    expect(write.statusCode).toBe(401);
    expect(stores.fulfillment.value).toBeNull();
  });
});

describe('listing orders', () => {
  it('returns orders with a default fulfilment state', async () => {
    const body = JSON.parse((await call('GET')).body);

    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].fulfillment.status).toBe('new');
    expect(body.openCount).toBe(1);
    expect(body.stats.revenueCents.allTime).toBe(25000);
  });
});

describe('updating fulfilment', () => {
  it('marks an order packed and attributes it', async () => {
    const response = await call('POST', { body: { orderId: 'cs_1', status: 'packed' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.fulfillment).toMatchObject({ status: 'packed', staff: 'Armon' });
  });

  it('stores a tracking number when shipping', async () => {
    await call('POST', {
      body: { orderId: 'cs_1', status: 'shipped', tracking: '1Z999', carrier: 'UPS' },
    });

    const body = JSON.parse((await call('GET')).body);
    expect(body.orders[0].fulfillment).toMatchObject({
      status: 'shipped',
      tracking: '1Z999',
      carrier: 'UPS',
    });
    // Shipped is finished, so it drops out of the open count.
    expect(body.openCount).toBe(0);
  });

  it('rejects an unknown status', async () => {
    const response = await call('POST', { body: { orderId: 'cs_1', status: 'teleported' } });
    expect(response.statusCode).toBe(400);
    expect(stores.fulfillment.value).toBeNull();
  });

  it('refuses to mark an order that does not exist', async () => {
    // Otherwise a typo writes a record for a phantom order and inflates the
    // open count permanently.
    const response = await call('POST', { body: { orderId: 'cs_nope', status: 'packed' } });

    expect(response.statusCode).toBe(404);
    expect(stores.fulfillment.value).toBeNull();
  });

  it('keeps a history of changes', async () => {
    await call('POST', { body: { orderId: 'cs_1', status: 'packed' } });
    await call('POST', { body: { orderId: 'cs_1', status: 'shipped' } });

    const body = JSON.parse((await call('GET')).body);
    const history = body.orders[0].fulfillment.history;

    expect(history).toHaveLength(2);
    expect(history[0].status).toBe('shipped');
    expect(history[1].status).toBe('packed');
  });

  it('does not touch the order record itself', async () => {
    await call('POST', { body: { orderId: 'cs_1', status: 'shipped' } });

    // Fulfilment must never mutate what Stripe told us happened.
    expect(stores.orders['orders/cs_1.json']).toEqual(ORDER);
  });
});

describe('single order lookup', () => {
  it('returns the record with its fulfilment state', async () => {
    await call('POST', { body: { orderId: 'cs_1', status: 'collected' } });

    const body = JSON.parse((await call('GET', { query: { session_id: 'cs_1' } })).body);
    expect(body.order.id).toBe('cs_1');
    expect(body.fulfillment.status).toBe('collected');
  });

  it('404s for an unknown order', async () => {
    expect((await call('GET', { query: { session_id: 'nope' } })).statusCode).toBe(404);
  });
});
