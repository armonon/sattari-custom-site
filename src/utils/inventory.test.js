import { describe, expect, it } from 'vitest';
import {
  applyStockDeltas,
  availableQuantity,
  hasAnyTracking,
  isProductSoldOut,
  isVariantOutOfStock,
  listVariants,
  sanitizeStockMap,
  stockKey,
} from './inventory.js';

const sizedProduct = {
  slug: 'sattari-effect-cymbal',
  sizes: [
    { size: '15"', price: 100 },
    { size: '16"', price: 90 },
  ],
};

const coloredProduct = {
  slug: 'sattari-practice-pad-8',
  colors: [{ name: 'Grey' }, { name: 'Green' }],
};

const plainProduct = { slug: 'sattari-hand-crafted-hi-hat' };

describe('stockKey', () => {
  it('always produces three segments', () => {
    expect(stockKey('a')).toBe('a::::');
    expect(stockKey('a', '15"')).toBe('a::15"::');
    expect(stockKey('a', null, 'Blue')).toBe('a::::Blue');
  });

  it("treats Stripe's 'default' placeholder as an absent variant", () => {
    // create-checkout-session writes `size || 'default'` into Stripe metadata,
    // so the webhook reads 'default' back for a product with no sizes.
    expect(stockKey('a', 'default', 'default')).toBe(stockKey('a', null, null));
  });

  it('does not let an empty size collide with an empty color', () => {
    expect(stockKey('a', 'Blue', null)).not.toBe(stockKey('a', null, 'Blue'));
  });
});

describe('listVariants', () => {
  it('returns a single variant for a plain product', () => {
    expect(listVariants(plainProduct)).toEqual([{ size: null, color: null }]);
  });

  it('expands sizes and colors into every combination', () => {
    expect(listVariants(sizedProduct)).toHaveLength(2);
    expect(
      listVariants({ ...sizedProduct, colors: [{ name: 'Red' }, { name: 'Blue' }] })
    ).toHaveLength(4);
  });
});

describe('availability', () => {
  it('treats an untracked variant as available, not sold out', () => {
    // This is what keeps the catalog from going dark on the deploy that ships
    // stock tracking, before any employee has entered a count.
    expect(availableQuantity({}, 'anything')).toBe(Number.POSITIVE_INFINITY);
    expect(isVariantOutOfStock({}, 'anything')).toBe(false);
  });

  it('treats a tracked zero as sold out', () => {
    const stock = { [stockKey('a')]: 0 };
    expect(isVariantOutOfStock(stock, 'a')).toBe(true);
  });

  it('keeps a product buyable while any variant has stock', () => {
    const stock = {
      [stockKey(sizedProduct.slug, '15"')]: 0,
      [stockKey(sizedProduct.slug, '16"')]: 3,
    };
    expect(isVariantOutOfStock(stock, sizedProduct.slug, '15"')).toBe(true);
    expect(isProductSoldOut(stock, sizedProduct)).toBe(false);
  });

  it('marks a product sold out only when every variant is tracked at zero', () => {
    const stock = {
      [stockKey(sizedProduct.slug, '15"')]: 0,
      [stockKey(sizedProduct.slug, '16"')]: 0,
    };
    expect(isProductSoldOut(stock, sizedProduct)).toBe(true);
  });

  it('does not mark a product sold out when only some variants are tracked', () => {
    const stock = { [stockKey(coloredProduct.slug, null, 'Grey')]: 0 };
    expect(isProductSoldOut(stock, coloredProduct)).toBe(false);
    expect(hasAnyTracking(stock, coloredProduct)).toBe(true);
  });
});

describe('applyStockDeltas', () => {
  it('decrements a tracked variant', () => {
    const { stock } = applyStockDeltas({ [stockKey('a')]: 5 }, [{ slug: 'a', delta: -2 }]);
    expect(stock[stockKey('a')]).toBe(3);
  });

  it('never drives a count below zero', () => {
    const { stock } = applyStockDeltas({ [stockKey('a')]: 1 }, [{ slug: 'a', delta: -5 }]);
    expect(stock[stockKey('a')]).toBe(0);
  });

  it('skips untracked variants instead of inventing a count', () => {
    const { stock, skipped } = applyStockDeltas({}, [{ slug: 'ghost', delta: -1 }]);
    expect(stock[stockKey('ghost')]).toBeUndefined();
    expect(skipped).toEqual([stockKey('ghost')]);
  });

  it('does not mutate the input map', () => {
    const original = { [stockKey('a')]: 5 };
    applyStockDeltas(original, [{ slug: 'a', delta: -1 }]);
    expect(original[stockKey('a')]).toBe(5);
  });

  it('matches variants sent through Stripe metadata placeholders', () => {
    const { stock } = applyStockDeltas({ [stockKey('a')]: 2 }, [
      { slug: 'a', size: 'default', color: 'default', delta: -1 },
    ]);
    expect(stock[stockKey('a')]).toBe(1);
  });
});

describe('sanitizeStockMap', () => {
  it('drops values that are not non-negative integers', () => {
    expect(sanitizeStockMap({ a: 3, b: -1, c: 'x', d: null, e: 2.7 })).toEqual({ a: 3, e: 2 });
  });

  it('returns an empty object for junk input', () => {
    expect(sanitizeStockMap(null)).toEqual({});
    expect(sanitizeStockMap([1, 2])).toEqual({});
  });
});
