import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = { value: null, etag: null, writes: 0 };

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
const { handler } = await import('../../netlify/functions/staff-catalog.js');

const EXISTING = 'pirouz-series-cymbals';
let token;

function call(method, body, bearer) {
  return handler({
    httpMethod: method,
    headers: bearer === null ? {} : { authorization: `Bearer ${bearer || token}` },
    body: body ? JSON.stringify(body) : '',
  });
}

beforeEach(() => {
  fake.value = null;
  fake.etag = null;
  fake.writes = 0;
  process.env.STAFF_PASSWORD_SALT = 'salt';
  process.env.STAFF_PASSWORD_HASH = hashPassword('pw', 'salt');
  process.env.STAFF_SESSION_SECRET = 'secret';
  token = createSession('Armon');
});

describe('staff-catalog access', () => {
  it('refuses unauthenticated reads and writes', async () => {
    expect((await call('GET', null, null)).statusCode).toBe(401);

    const write = await call('POST', { action: 'hide', slug: EXISTING }, null);
    expect(write.statusCode).toBe(401);
    expect(fake.value).toBeNull();
  });
});

describe('staff-catalog listings', () => {
  it('lists the base catalog with edit state', async () => {
    const body = JSON.parse((await call('GET')).body);
    const row = body.listings.find((item) => item.slug === EXISTING);

    expect(row).toMatchObject({ origin: 'catalog', hidden: false, edited: false });
  });
});

describe('editing', () => {
  it('overrides a price', async () => {
    const response = await call('POST', {
      action: 'edit',
      slug: EXISTING,
      changes: { price: 99.5 },
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.listings.find((item) => item.slug === EXISTING)).toMatchObject({
      price: 99.5,
      edited: true,
    });
  });

  it('merges successive edits instead of dropping earlier ones', async () => {
    await call('POST', { action: 'edit', slug: EXISTING, changes: { price: 50 } });
    await call('POST', { action: 'edit', slug: EXISTING, changes: { name: 'Renamed' } });

    const body = JSON.parse((await call('GET')).body);
    expect(body.listings.find((item) => item.slug === EXISTING)).toMatchObject({
      price: 50,
      name: 'Renamed',
    });
  });

  it('refuses to edit a product that does not exist', async () => {
    const response = await call('POST', {
      action: 'edit',
      slug: 'no-such-product',
      changes: { price: 5 },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects an edit with nothing usable in it', async () => {
    const response = await call('POST', { action: 'edit', slug: EXISTING, changes: { price: -1 } });
    expect(response.statusCode).toBe(400);
  });
});

describe('adding', () => {
  it('adds a product', async () => {
    const response = await call('POST', {
      action: 'add',
      product: { name: 'Test Snare', price: 240, category: 'essentials' },
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.slug).toBe('test-snare');
    expect(body.listings.some((item) => item.slug === 'test-snare' && item.origin === 'added')).toBe(
      true
    );
  });

  it('refuses a duplicate slug rather than shadowing a real product', async () => {
    const response = await call('POST', {
      action: 'add',
      product: { name: 'Pirouz Series Cymbals', price: 1 },
    });
    expect(response.statusCode).toBe(409);
  });

  it('refuses a product with no price', async () => {
    const response = await call('POST', { action: 'add', product: { name: 'Priceless' } });
    expect(response.statusCode).toBe(400);
  });
});

describe('hiding', () => {
  it('hides and restores without destroying data', async () => {
    await call('POST', { action: 'hide', slug: EXISTING });
    let body = JSON.parse((await call('GET')).body);
    expect(body.listings.find((item) => item.slug === EXISTING).hidden).toBe(true);

    await call('POST', { action: 'show', slug: EXISTING });
    body = JSON.parse((await call('GET')).body);
    const row = body.listings.find((item) => item.slug === EXISTING);

    // Still present, with its original name intact.
    expect(row.hidden).toBe(false);
    expect(row.name).toBe('Pirouz Series Cymbals');
  });

  it('reports fewer live products while something is hidden', async () => {
    const before = JSON.parse((await call('GET')).body).live;
    await call('POST', { action: 'hide', slug: EXISTING });
    const after = JSON.parse((await call('GET')).body).live;

    expect(after).toBe(before - 1);
  });
});

describe('unknown actions', () => {
  it('rejects anything it does not recognize', async () => {
    expect((await call('POST', { action: 'drop-table' })).statusCode).toBe(400);
    expect((await call('PUT', { action: 'edit' })).statusCode).toBe(405);
  });
});
