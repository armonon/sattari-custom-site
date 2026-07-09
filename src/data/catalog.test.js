import { describe, expect, it } from 'vitest';
import { formatPrice, getProductBySlug, resolveSelectedOption } from './catalog';

describe('catalog utilities', () => {
  it('finds products by slug', () => {
    const product = getProductBySlug('pirouz-series-cymbals');

    expect(product).toBeDefined();
    expect(product?.name).toBe('Pirouz Series Cymbals');
  });

  it('falls back to the first size for sized products', () => {
    const effectCymbal = getProductBySlug('sattari-effect-cymbal');

    expect(resolveSelectedOption(effectCymbal, null)).toEqual({
      size: '15"',
      unitPrice: 100,
    });
  });

  it('formats prices consistently', () => {
    expect(formatPrice(7)).toBe('$7.00');
    expect(formatPrice(null)).toBe('$0.00');
  });
});
