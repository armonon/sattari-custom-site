import { describe, expect, it } from 'vitest';
import { formatPrice, getProductBySlug, resolveSelectedOption } from './catalog';

describe('catalog utilities', () => {
  it('finds products by slug', () => {
    const product = getProductBySlug('pirouz-series-cymbals');

    expect(product).toBeDefined();
    expect(product?.name).toBe('Pirouz Series Cymbals');
  });

  it('falls back to the first size for sized products', () => {
    const practicePad = getProductBySlug('sattari-drummer-practice-pad');

    expect(resolveSelectedOption(practicePad, null)).toEqual({
      size: '8"',
      unitPrice: 15,
    });
  });

  it('formats prices consistently', () => {
    expect(formatPrice(7)).toBe('$7.00');
    expect(formatPrice(null)).toBe('$0.00');
  });
});
