// @vitest-environment node
import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = { value: null, etag: null, writes: 0, failWrites: false, alwaysConflict: false };

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn(() => ({
    async get() {
      return fake.value === null ? null : JSON.parse(JSON.stringify(fake.value));
    },
    async getWithMetadata() {
      if (fake.value === null) return null;
      return { data: JSON.parse(JSON.stringify(fake.value)), etag: fake.etag };
    },
    async setJSON(key, value, options = {}) {
      if (fake.failWrites) throw new Error('socket hang up talking to blobs.internal:443');
      if (fake.alwaysConflict) return { modified: false };
      fake.writes += 1;
      if (options.onlyIfNew && fake.value !== null) return { modified: false };
      if (options.onlyIfMatch && options.onlyIfMatch !== fake.etag) return { modified: false };
      fake.value = JSON.parse(JSON.stringify(value));
      fake.etag = `etag-${fake.writes}`;
      return { modified: true, etag: fake.etag };
    },
  })),
}));

const { hashPassword, createSession } = await import('../../server/staffAuth.js');
const { stockKey } = await import('../../src/utils/inventory.js');
const { handler } = await import('../../netlify/functions/staff-stock.js');

const PLAIN = 'pirouz-series-cymbals';

function authed(method, body, token) {
  return handler({
    httpMethod: method,
    headers: { authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : '',
  });
}

let token;

beforeEach(() => {
  fake.value = null;
  fake.etag = null;
  fake.writes = 0;
  fake.failWrites = false;
  fake.alwaysConflict = false;
  process.env.STAFF_PASSWORD_SALT = 'salt';
  process.env.STAFF_PASSWORD_HASH = hashPassword('pw', 'salt');
  process.env.STAFF_SESSION_SECRET = 'secret';
  token = createSession('Armon');
});

describe('staff-stock authentication', () => {
  it('refuses a request with no token', async () => {
    const response = await handler({ httpMethod: 'GET', headers: {} });
    expect(response.statusCode).toBe(401);
  });

  it('refuses a forged token', async () => {
    const response = await authed('GET', null, 'not.a.real.token');
    expect(response.statusCode).toBe(401);
  });

  it('refuses writes from an unauthenticated caller', async () => {
    // The endpoint is public and guessable, so this is the check that matters.
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ updates: [{ key: stockKey(PLAIN), quantity: 0 }] }),
    });

    expect(response.statusCode).toBe(401);
    expect(fake.value).toBeNull();
  });
});

describe('staff-stock reads', () => {
  it('lists every catalog variant with its tracking state', async () => {
    const response = await authed('GET', null, token);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.staff).toBe('Armon');
    expect(body.items.length).toBeGreaterThan(25);

    const row = body.items.find((item) => item.key === stockKey(PLAIN));
    expect(row).toMatchObject({ slug: PLAIN, tracked: false, quantity: null });
  });

  it('reports stored quantities', async () => {
    fake.value = { [stockKey(PLAIN)]: 4 };
    fake.etag = 'etag-0';

    const body = JSON.parse((await authed('GET', null, token)).body);
    const row = body.items.find((item) => item.key === stockKey(PLAIN));

    expect(row).toMatchObject({ tracked: true, quantity: 4 });
  });
});

describe('staff-stock writes', () => {
  it('saves a quantity', async () => {
    const response = await authed(
      'POST',
      { updates: [{ key: stockKey(PLAIN), quantity: 7 }] },
      token
    );

    expect(response.statusCode).toBe(200);
    expect(fake.value[stockKey(PLAIN)]).toBe(7);
  });

  it('treats null as untracking rather than zero', async () => {
    fake.value = { [stockKey(PLAIN)]: 3 };
    fake.etag = 'etag-0';

    await authed('POST', { updates: [{ key: stockKey(PLAIN), quantity: null }] }, token);

    // Untracked means the key is gone, which reads as always-available.
    // Storing 0 instead would wrongly mark the product sold out.
    expect(Object.prototype.hasOwnProperty.call(fake.value, stockKey(PLAIN))).toBe(false);
  });

  it('rejects keys that are not real catalog variants', async () => {
    const response = await authed(
      'POST',
      { updates: [{ key: 'made::up::key', quantity: 5 }] },
      token
    );
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.rejected[0]).toMatchObject({ key: 'made::up::key' });
    expect(fake.value).toBeNull();
  });

  it('rejects negative quantities', async () => {
    const response = await authed(
      'POST',
      { updates: [{ key: stockKey(PLAIN), quantity: -2 }] },
      token
    );
    expect(response.statusCode).toBe(400);
    expect(fake.value).toBeNull();
  });

  it('applies valid rows and reports invalid ones together', async () => {
    const response = await authed(
      'POST',
      {
        updates: [
          { key: stockKey(PLAIN), quantity: 2 },
          { key: 'bogus', quantity: 9 },
        ],
      },
      token
    );
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(fake.value[stockKey(PLAIN)]).toBe(2);
    expect(body.rejected).toHaveLength(1);
  });

  it('rejects an empty submission', async () => {
    const response = await authed('POST', { updates: [] }, token);
    expect(response.statusCode).toBe(400);
  });

  it('answers a storage failure without passing its details on', async () => {
    fake.failWrites = true;

    const response = await authed(
      'POST',
      { updates: [{ key: stockKey(PLAIN), quantity: 2 }] },
      token
    );

    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('blobs.internal');
  });

  it('answers a save that keeps colliding with a plain conflict message', async () => {
    fake.value = { [stockKey(PLAIN)]: 3 };
    fake.etag = 'etag-0';
    fake.alwaysConflict = true;

    const response = await authed(
      'POST',
      { updates: [{ key: stockKey(PLAIN), quantity: 2 }] },
      token
    );

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toEqual({
      error: 'Stock was changing while you saved. Reload and try again.',
    });
    expect(fake.value[stockKey(PLAIN)]).toBe(3);
  });
});

describe('staff-stock and checkout holds', () => {
  function withHold(quantity) {
    return {
      [stockKey(PLAIN)]: 3,
      __holds: {
        checkout1: {
          state: 'active',
          lines: [{ key: stockKey(PLAIN), quantity }],
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
      },
    };
  }

  it('shows how many units customers in checkout are holding', async () => {
    fake.value = withHold(2);
    fake.etag = 'etag-0';

    const body = JSON.parse((await authed('GET', null, token)).body);
    const row = body.items.find((item) => item.key === stockKey(PLAIN));

    expect(row).toMatchObject({ tracked: true, quantity: 3, held: 2 });
  });

  it('keeps customers’ reservations through a staff recount', async () => {
    fake.value = withHold(2);
    fake.etag = 'etag-0';

    await authed('POST', { updates: [{ key: stockKey(PLAIN), quantity: 7 }] }, token);

    expect(fake.value[stockKey(PLAIN)]).toBe(7);
    expect(fake.value.__holds.checkout1.state).toBe('active');
  });
});
