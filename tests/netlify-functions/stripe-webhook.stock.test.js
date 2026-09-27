// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildStockLines } from '../../server/checkoutOrders.js';
import {
  applyStockDeltas,
  availableStock,
  commitSale,
  placeHold,
  releaseHold,
  stockKey,
} from '../../src/utils/inventory.js';

function lineItem(metadata, quantity = 1, description = 'Item') {
  return { description, quantity, price: { product: { metadata } } };
}

const NOW = 1_800_000_000_000;

function line(slug, quantity, size = null) {
  return { key: stockKey(slug, size), slug, size, color: null, name: slug, quantity };
}

describe('buildStockLines', () => {
  it('turns expanded line items into one line per variant', () => {
    const lines = buildStockLines([lineItem({ slug: 'a', size: '15"', color: 'Blue' }, 2, 'A')]);

    expect(lines).toEqual([
      {
        key: stockKey('a', '15"', 'Blue'),
        slug: 'a',
        size: '15"',
        color: 'Blue',
        name: 'A',
        quantity: 2,
      },
    ]);
  });

  it("resolves Stripe's 'default' placeholders to the plain variant", () => {
    const [entry] = buildStockLines([lineItem({ slug: 'a', size: 'default', color: 'default' })]);

    expect(entry.key).toBe(stockKey('a'));
  });

  it('ignores line items with no product metadata', () => {
    // Shipping lines and anything created outside our checkout flow have no
    // slug, and must not be mistaken for a product.
    expect(buildStockLines([{ quantity: 1, price: { product: {} } }])).toEqual([]);
    expect(buildStockLines([{ quantity: 1 }])).toEqual([]);
  });

  it('ignores non-positive quantities', () => {
    expect(buildStockLines([lineItem({ slug: 'a' }, 0)])).toEqual([]);
  });

  it('keeps each variant of a multi-line order separate and merges repeats', () => {
    const lines = buildStockLines([
      lineItem({ slug: 'a', size: '15"', color: 'default' }, 1),
      lineItem({ slug: 'a', size: '16"', color: 'default' }, 2),
      lineItem({ slug: 'a', size: '16"', color: 'default' }, 1),
    ]);

    expect(lines.map(({ key, quantity }) => [key, quantity])).toEqual([
      [stockKey('a', '15"'), 1],
      [stockKey('a', '16"'), 3],
    ]);
  });
});

describe('commitSale', () => {
  const held = (stock) =>
    placeHold(
      { stock, holds: {} },
      { holdId: 'h1', lines: [line('a', 2)], now: NOW, expiresAt: NOW + 60_000 }
    ).doc;

  it('takes held units out of stock and leaves a sold marker', () => {
    const { doc, sale } = commitSale(held({ [stockKey('a')]: 5 }), {
      holdId: 'h1',
      lines: [line('a', 2)],
      now: NOW,
    });

    expect(doc.stock[stockKey('a')]).toBe(3);
    expect(doc.holds.h1).toMatchObject({
      state: 'sold',
      lines: [{ key: stockKey('a'), quantity: 2 }],
    });
    expect(sale).toMatchObject({ alreadyApplied: false, oversold: [] });
  });

  it('changes nothing the second time', () => {
    const first = commitSale(held({ [stockKey('a')]: 5 }), {
      holdId: 'h1',
      lines: [line('a', 2)],
      now: NOW,
    });

    const second = commitSale(first.doc, { holdId: 'h1', lines: [line('a', 2)], now: NOW + 1 });

    expect(second.doc).toBeNull();
    expect(second.sale.alreadyApplied).toBe(true);
  });

  it('reports a shortfall instead of flooring silently', () => {
    const { doc, sale } = commitSale(
      { stock: { [stockKey('a')]: 1 }, holds: {} },
      { holdId: 'late', lines: [line('a', 3)], now: NOW }
    );

    expect(doc.stock[stockKey('a')]).toBe(0);
    expect(sale.oversold).toEqual([
      expect.objectContaining({ key: stockKey('a'), requested: 3, available: 1 }),
    ]);
  });

  it('never takes a unit another open checkout is holding', () => {
    const doc = held({ [stockKey('a')]: 2 });

    const { doc: next, sale } = commitSale(doc, {
      holdId: 'unheld',
      lines: [line('a', 1)],
      now: NOW,
    });

    expect(next.stock[stockKey('a')]).toBe(2);
    expect(sale.oversold[0]).toMatchObject({ requested: 1, available: 0 });
    expect(availableStock(next.stock, next.holds, NOW)[stockKey('a')]).toBe(0);
  });

  it('skips untracked variants without writing anything', () => {
    const { doc, sale } = commitSale(
      { stock: {}, holds: {} },
      { holdId: 'h', lines: [line('ghost', 1)], now: NOW }
    );

    expect(doc).toBeNull();
    expect(sale.untracked).toEqual([stockKey('ghost')]);
  });
});

describe('releaseHold', () => {
  it('never releases a sale', () => {
    const sold = commitSale(
      { stock: { [stockKey('a')]: 1 }, holds: {} },
      { holdId: 'h', lines: [line('a', 1)], now: NOW }
    ).doc;

    expect(releaseHold(sold, 'h')).toBeNull();
    expect(releaseHold(sold, 'h', { states: ['active'] })).toBeNull();
  });

  it('releases only the states it is asked to', () => {
    const doc = {
      stock: { [stockKey('a')]: 2 },
      holds: {
        open: { state: 'active', lines: [], expiresAt: NOW + 60_000 },
        delayed: { state: 'pending', lines: [], expiresAt: NOW + 60_000 },
      },
    };

    expect(releaseHold(doc, 'delayed', { states: ['active'] })).toBeNull();
    expect(releaseHold(doc, 'open', { states: ['active'] }).holds).toEqual({
      delayed: doc.holds.delayed,
    });
    // By default a failed delayed payment's hold can still be let go.
    expect(releaseHold(doc, 'delayed')).not.toBeNull();
  });
});

describe('applyStockDeltas', () => {
  it('reports a decrement larger than the count', () => {
    const { stock, oversold } = applyStockDeltas({ [stockKey('a')]: 1 }, [
      { slug: 'a', delta: -3 },
    ]);

    expect(stock[stockKey('a')]).toBe(0);
    expect(oversold).toEqual([{ key: stockKey('a'), requested: 3, available: 1 }]);
  });
});
