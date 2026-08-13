import { describe, expect, it } from 'vitest';
import {
  mergeCatalog,
  sanitizeCatalogDoc,
  sanitizeNewProduct,
  sanitizeOverride,
  slugify,
} from './catalogMerge.js';

const base = [
  { id: 'a', slug: 'a', name: 'Cymbal A', category: 'cymbals', price: 80, description: 'x' },
  { id: 'b', slug: 'b', name: 'Stick B', category: 'sticks', price: 12, description: 'y' },
];

describe('mergeCatalog', () => {
  it('returns the base catalog untouched when there are no edits', () => {
    expect(mergeCatalog(base, undefined)).toEqual(base);
    expect(mergeCatalog(base, {})).toEqual(base);
  });

  it('applies a partial override without blanking other fields', () => {
    const merged = mergeCatalog(base, { overrides: { a: { price: 95 } } });
    expect(merged[0]).toMatchObject({ slug: 'a', name: 'Cymbal A', price: 95, description: 'x' });
  });

  it('hides a product without destroying it', () => {
    const merged = mergeCatalog(base, { hidden: ['a'] });
    expect(merged.map((p) => p.slug)).toEqual(['b']);
    // Unhiding brings it straight back, because the base is never mutated.
    expect(mergeCatalog(base, { hidden: [] }).map((p) => p.slug)).toEqual(['a', 'b']);
  });

  it('appends added products', () => {
    const merged = mergeCatalog(base, {
      added: [{ name: 'New Pad', price: 20, category: 'essentials' }],
    });
    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({ slug: 'new-pad', name: 'New Pad', price: 20 });
  });

  it('does not let an added product collide with a base slug', () => {
    const merged = mergeCatalog(base, { added: [{ name: 'Cymbal A', slug: 'a', price: 5 }] });
    expect(merged.filter((p) => p.slug === 'a')).toHaveLength(1);
    expect(merged.find((p) => p.slug === 'a').price).toBe(80);
  });

  it('does not mutate the base catalog', () => {
    mergeCatalog(base, { overrides: { a: { price: 1 } } });
    expect(base[0].price).toBe(80);
  });
});

describe('sanitizeOverride', () => {
  it('keeps only the fields provided', () => {
    expect(sanitizeOverride({ price: 12.5 })).toEqual({ price: 12.5 });
  });

  it('drops empty and invalid values rather than writing them', () => {
    expect(sanitizeOverride({ name: '   ' })).toBeNull();
    expect(sanitizeOverride({ price: -5 })).toBeNull();
    expect(sanitizeOverride({ price: 'free' })).toBeNull();
    expect(sanitizeOverride(null)).toBeNull();
  });

  it('rounds money to cents', () => {
    expect(sanitizeOverride({ price: 19.999 })).toEqual({ price: 20 });
  });

  it('drops malformed sizes that would break checkout', () => {
    // resolveSelectedOption reads option.price; an entry without one would
    // make the product unpurchasable.
    expect(sanitizeOverride({ sizes: [{ size: '15"' }] })).toBeNull();
    expect(sanitizeOverride({ sizes: [{ size: '15"', price: 10 }] })).toEqual({
      sizes: [{ size: '15"', price: 10 }],
    });
  });
});

describe('category handling', () => {
  it('accepts a real category key', () => {
    expect(sanitizeOverride({ category: 'cymbals' })).toEqual({ category: 'cymbals' });
    expect(sanitizeOverride({ category: 'CYMBALS' })).toEqual({ category: 'cymbals' });
  });

  it('refuses an invented category rather than filing a product nowhere', () => {
    // A product in a category no page lists would be invisible on the site and
    // would crash the detail page's per-category copy lookup.
    expect(sanitizeOverride({ category: 'kazoos' })).toBeNull();
    expect(sanitizeNewProduct({ name: 'Thing', price: 5, category: 'kazoos' }).category).toBe(
      'essentials'
    );
  });
});

describe('sanitizeNewProduct', () => {
  it('requires a name and a price', () => {
    expect(sanitizeNewProduct({ price: 10 })).toBeNull();
    expect(sanitizeNewProduct({ name: 'Thing' })).toBeNull();
    expect(sanitizeNewProduct({ name: 'Thing', price: 10 })).toMatchObject({ slug: 'thing' });
  });

  it('accepts sized products without a top-level price', () => {
    const product = sanitizeNewProduct({
      name: 'Sized Thing',
      sizes: [{ size: 'S', price: 5 }],
    });
    expect(product).toMatchObject({ slug: 'sized-thing', price: 5 });
    expect(product.sizes).toEqual([{ size: 'S', price: 5 }]);
  });

  it('generates a url-safe slug', () => {
    expect(slugify('14" Hi-Hat  (Pair)')).toBe('14-hi-hat-pair');
    expect(sanitizeNewProduct({ name: 'A/B Test!', price: 1 }).slug).toBe('a-b-test');
  });
});

describe('sanitizeCatalogDoc', () => {
  it('normalizes junk into an empty document', () => {
    expect(sanitizeCatalogDoc(null)).toEqual({ overrides: {}, added: [], hidden: [] });
    expect(sanitizeCatalogDoc({ overrides: [], added: 'x', hidden: 3 })).toEqual({
      overrides: {},
      added: [],
      hidden: [],
    });
  });

  it('deduplicates added slugs and hidden entries', () => {
    const doc = sanitizeCatalogDoc({
      added: [
        { name: 'Dup', price: 1 },
        { name: 'Dup', price: 2 },
      ],
      hidden: ['a', 'a', 'b'],
    });

    expect(doc.added).toHaveLength(1);
    expect(doc.hidden).toEqual(['a', 'b']);
  });
});
