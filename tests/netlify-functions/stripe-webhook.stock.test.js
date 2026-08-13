import { describe, expect, it, vi } from 'vitest';
import { applyStockDeltas, stockKey } from '../../src/utils/inventory.js';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: vi.fn() },
    checkout: { sessions: { listLineItems: vi.fn() } },
  })),
}));

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn(() => ({})),
}));

const { buildStockDeltas } = await import('../../netlify/functions/stripe-webhook.js');

function lineItem(metadata, quantity = 1) {
  return { quantity, price: { product: { metadata } } };
}

describe('buildStockDeltas', () => {
  it('turns expanded line items into negative deltas', () => {
    const deltas = buildStockDeltas([
      lineItem({ slug: 'a', size: '15"', color: 'Blue' }, 2),
    ]);

    expect(deltas).toEqual([{ slug: 'a', size: '15"', color: 'Blue', delta: -2 }]);
  });

  it("resolves Stripe's 'default' placeholders to the plain variant", () => {
    const deltas = buildStockDeltas([lineItem({ slug: 'a', size: 'default', color: 'default' })]);
    const { stock } = applyStockDeltas({ [stockKey('a')]: 3 }, deltas);

    expect(stock[stockKey('a')]).toBe(2);
  });

  it('ignores line items with no product metadata', () => {
    // Shipping lines and anything created outside our checkout flow have no
    // slug, and must not be mistaken for a product.
    expect(buildStockDeltas([{ quantity: 1, price: { product: {} } }])).toEqual([]);
    expect(buildStockDeltas([{ quantity: 1 }])).toEqual([]);
  });

  it('ignores non-positive quantities', () => {
    expect(buildStockDeltas([lineItem({ slug: 'a' }, 0)])).toEqual([]);
  });

  it('decrements each variant of a multi-line order independently', () => {
    const deltas = buildStockDeltas([
      lineItem({ slug: 'a', size: '15"', color: 'default' }, 1),
      lineItem({ slug: 'a', size: '16"', color: 'default' }, 2),
    ]);

    const { stock } = applyStockDeltas(
      { [stockKey('a', '15"')]: 5, [stockKey('a', '16"')]: 5 },
      deltas
    );

    expect(stock[stockKey('a', '15"')]).toBe(4);
    expect(stock[stockKey('a', '16"')]).toBe(3);
  });
});
