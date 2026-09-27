// @vitest-environment node
import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stockKey } from '../../src/utils/inventory.js';

const createSessionMock = vi.fn();
const blobs = vi.hoisted(() => ({ current: null }));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      checkout: { sessions: { create: createSessionMock } },
    };
  }),
}));

vi.mock('@netlify/blobs', async () => {
  const { createMemoryBlobs } = await import('./helpers/memoryBlobs.js');
  blobs.current = createMemoryBlobs();
  return blobs.current.module;
});

const { handler } = await import('../../netlify/functions/create-checkout-session.js');

function post(items) {
  return handler({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items }),
  });
}

function setStock(stock) {
  blobs.current.write('inventory', 'stock', stock);
}

function setCatalog(doc) {
  blobs.current.write('catalog', 'overrides', doc);
}

// A plain product (no sizes/colors) and a sized product from the real catalog.
const PLAIN = 'pirouz-series-cymbals';
const SIZED = 'sattari-effect-cymbal';

describe('create-checkout-session stock enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    blobs.current.reset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.URL = 'https://sattarimusic.com';
    createSessionMock.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.test/s' });
  });

  it('allows checkout when the variant is not tracked', async () => {
    setStock({});

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
  });

  it('allows checkout when tracked stock is sufficient', async () => {
    setStock({ [stockKey(PLAIN)]: 5 });

    const response = await post([{ slug: PLAIN, quantity: 2 }]);

    expect(response.statusCode).toBe(200);
  });

  it('blocks checkout for a sold-out variant', async () => {
    setStock({ [stockKey(PLAIN)]: 0 });

    const response = await post([{ slug: PLAIN, quantity: 1 }]);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(409);
    expect(body.code).toBe('out_of_stock');
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('blocks when the cart asks for more than remains', async () => {
    setStock({ [stockKey(PLAIN)]: 2 });

    const response = await post([{ slug: PLAIN, quantity: 3 }]);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(409);
    expect(body.shortfalls[0]).toMatchObject({ slug: PLAIN, requested: 3, available: 2 });
  });

  it('aggregates duplicate cart lines for the same variant', async () => {
    // Two lines of 1 against a stock of 1: checking each line separately would
    // let this through and oversell by one.
    setStock({ [stockKey(PLAIN)]: 1 });

    const response = await post([
      { slug: PLAIN, quantity: 1 },
      { slug: PLAIN, quantity: 1 },
    ]);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).shortfalls[0].requested).toBe(2);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('tracks sizes independently', async () => {
    setStock({
      [stockKey(SIZED, '15"')]: 0,
      [stockKey(SIZED, '16"')]: 4,
    });

    const soldOut = await post([{ slug: SIZED, size: '15"', quantity: 1 }]);
    expect(soldOut.statusCode).toBe(409);

    const available = await post([{ slug: SIZED, size: '16"', quantity: 1 }]);
    expect(available.statusCode).toBe(200);
  });

  it('charges the price an employee edited, not the one in catalog.js', async () => {
    // The whole point of server-side pricing: if this read the base file, a
    // customer would see the new price and be charged the old one.
    setCatalog({ overrides: { [PLAIN]: { price: 42.5 } } });

    const response = await post([{ slug: PLAIN, quantity: 1 }]);
    expect(response.statusCode).toBe(200);

    const payload = createSessionMock.mock.calls[0][0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(4250);
  });

  it('refuses to sell a product an employee removed', async () => {
    setCatalog({ hidden: [PLAIN] });

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'product_unavailable', slug: PLAIN });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('sells a product an employee added', async () => {
    setCatalog({ added: [{ name: 'Shop Special', price: 30, category: 'essentials' }] });

    const response = await post([{ slug: 'shop-special', quantity: 1 }]);
    expect(response.statusCode).toBe(200);

    const payload = createSessionMock.mock.calls[0][0];
    expect(payload.line_items[0].price_data.unit_amount).toBe(3000);
  });

  it('fails closed when the catalog store is unreachable', async () => {
    // The base catalog alone still lists hidden and discontinued products at
    // their original prices, so it is not a safe fallback for taking money.
    setCatalog({ hidden: [PLAIN] });
    blobs.current.state.fault = ({ store }) =>
      store === 'catalog' ? new Error('blobs down') : null;

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/temporarily unavailable/);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('fails open when the stock store is unreachable', async () => {
    // An outage in blob storage must not stop every sale on the site.
    blobs.current.state.fault = ({ store }) =>
      store === 'inventory' ? new Error('blobs unavailable') : null;

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
  });
});
