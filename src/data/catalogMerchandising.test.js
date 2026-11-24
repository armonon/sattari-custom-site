import { describe, expect, it } from 'vitest';
import { products } from './catalog';
import {
  comparisonProducts,
  productBuyingQuestions,
  relatedCatalogProducts,
} from './catalogMerchandising';

describe('catalog buying guidance', () => {
  it('covers the existing products without inventing additional purchasable strings', () => {
    expect(products.filter((product) => !productBuyingQuestions[product.slug])).toEqual([]);
    expect(comparisonProducts('guitar-bass', products)).toHaveLength(4);
    expect(comparisonProducts('violins', products)).toHaveLength(5);
    expect(
      products.filter((product) => product.slug.includes('strings')).map((product) => product.slug)
    ).toEqual(['violin-strings']);
  });

  it('uses only visible products for comparisons and related links', () => {
    const visible = products.filter((product) => product.slug !== 'miami-electric-violin');
    expect(
      comparisonProducts('violins', visible).some(
        (product) => product.slug === 'miami-electric-violin'
      )
    ).toBe(false);
    const chiara = visible.find((product) => product.slug === 'chiara-wooden-electric-violin');
    expect(relatedCatalogProducts(chiara, visible).map((product) => product.slug)).toEqual([
      'cremona-handmade-acoustic-violin',
      'brescia-acoustic-violin',
      'matilde-electric-violin',
    ]);
  });

  it('does not suggest an extra included accessory or fill with unrelated gear', () => {
    const bundle = products.find((product) => product.slug === '4-pair-drumsticks-free-bag');
    expect(relatedCatalogProducts(bundle, products).map((product) => product.slug)).toEqual([
      'sattari-practice-pad-12',
      'sattari-practice-pad-8',
    ]);
    const darbuka = products.find((product) => product.slug === 'sattari-darbuka');
    expect(relatedCatalogProducts(darbuka, products)).toEqual([]);
  });
});

it('builds direct links only for real options without tracking or arbitrary query data', async () => {
  const { productVariantPath } = await import('./catalogMerchandising');
  const product = {
    slug: 'test-instrument',
    sizes: [{ size: '17"' }],
    colors: [{ name: 'Dark Blue' }],
  };
  expect(productVariantPath(product, { size: '17"', color: 'Dark Blue' })).toBe(
    '/product/test-instrument?size=17%22&color=Dark+Blue'
  );
  expect(
    productVariantPath(product, { size: 'unknown', color: 'https://example.com/private' })
  ).toBe('/product/test-instrument');
});
