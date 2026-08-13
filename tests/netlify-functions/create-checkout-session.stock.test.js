import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stockKey } from '../../src/utils/inventory.js';

const createSessionMock = vi.fn();
const blobGetMock = vi.fn();

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: createSessionMock } },
  })),
}));

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn(() => ({ get: blobGetMock })),
}));

const { handler } = await import('../../netlify/functions/create-checkout-session.js');

function post(items) {
  return handler({
    httpMethod: 'POST',
    headers: { host: 'sattarimusic.com' },
    body: JSON.stringify({ items }),
  });
}

// A plain product (no sizes/colors) and a sized product from the real catalog.
const PLAIN = 'pirouz-series-cymbals';
const SIZED = 'sattari-effect-cymbal';

describe('create-checkout-session stock enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.URL = 'https://sattarimusic.com';
    createSessionMock.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.test/s' });
    blobGetMock.mockResolvedValue({});
  });

  it('allows checkout when the variant is not tracked', async () => {
    blobGetMock.mockResolvedValue({});

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
  });

  it('allows checkout when tracked stock is sufficient', async () => {
    blobGetMock.mockResolvedValue({ [stockKey(PLAIN)]: 5 });

    const response = await post([{ slug: PLAIN, quantity: 2 }]);

    expect(response.statusCode).toBe(200);
  });

  it('blocks checkout for a sold-out variant', async () => {
    blobGetMock.mockResolvedValue({ [stockKey(PLAIN)]: 0 });

    const response = await post([{ slug: PLAIN, quantity: 1 }]);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(409);
    expect(body.code).toBe('out_of_stock');
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('blocks when the cart asks for more than remains', async () => {
    blobGetMock.mockResolvedValue({ [stockKey(PLAIN)]: 2 });

    const response = await post([{ slug: PLAIN, quantity: 3 }]);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(409);
    expect(body.shortfalls[0]).toMatchObject({ slug: PLAIN, requested: 3, available: 2 });
  });

  it('aggregates duplicate cart lines for the same variant', async () => {
    // Two lines of 1 against a stock of 1: checking each line separately would
    // let this through and oversell by one.
    blobGetMock.mockResolvedValue({ [stockKey(PLAIN)]: 1 });

    const response = await post([
      { slug: PLAIN, quantity: 1 },
      { slug: PLAIN, quantity: 1 },
    ]);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).shortfalls[0].requested).toBe(2);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('tracks sizes independently', async () => {
    blobGetMock.mockResolvedValue({
      [stockKey(SIZED, '15"')]: 0,
      [stockKey(SIZED, '16"')]: 4,
    });

    const soldOut = await post([{ slug: SIZED, size: '15"', quantity: 1 }]);
    expect(soldOut.statusCode).toBe(409);

    vi.clearAllMocks();
    blobGetMock.mockResolvedValue({
      [stockKey(SIZED, '15"')]: 0,
      [stockKey(SIZED, '16"')]: 4,
    });
    createSessionMock.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.test/s' });

    const available = await post([{ slug: SIZED, size: '16"', quantity: 1 }]);
    expect(available.statusCode).toBe(200);
  });

  it('fails open when the stock store is unreachable', async () => {
    // An outage in blob storage must not stop every sale on the site.
    blobGetMock.mockRejectedValue(new Error('blobs unavailable'));

    const response = await post([{ slug: PLAIN, quantity: 1 }]);

    expect(response.statusCode).toBe(200);
    expect(createSessionMock).toHaveBeenCalled();
  });
});
