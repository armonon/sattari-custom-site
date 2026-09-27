import { describe, expect, it } from 'vitest';
import { products as baseProducts } from '../data/catalog';
import { mergeCatalog } from './catalogMerge';
import { createEntryKeyResolver, reconcileCartEntries, resolveCartLines } from './cartCatalog';

const staffCatalog = {
  overrides: { 'cymbal-felts': { price: 9.5 } },
  added: [{ name: 'Frame Drum', slug: 'frame-drum', price: 120, category: 'essentials' }],
  hidden: ['violin-strings'],
};
const merged = mergeCatalog(baseProducts, staffCatalog);

describe('resolveCartLines', () => {
  it('prices lines from the merged catalog, including staff edits and additions', () => {
    const { lines, unresolved } = resolveCartLines(
      [
        { slug: 'cymbal-felts', size: null, color: null, quantity: 2 },
        { slug: 'frame-drum', size: null, color: null, quantity: 1 },
      ],
      merged
    );

    expect(unresolved).toEqual([]);
    expect(lines.map(({ slug, unitPrice, lineTotal }) => ({ slug, unitPrice, lineTotal }))).toEqual(
      [
        { slug: 'cymbal-felts', unitPrice: 9.5, lineTotal: 19 },
        { slug: 'frame-drum', unitPrice: 120, lineTotal: 120 },
      ]
    );
  });

  it('reports entries the catalog cannot price instead of pricing them', () => {
    const { lines, unresolved } = resolveCartLines(
      [
        { slug: 'frame-drum', quantity: 1 },
        { slug: 'violin-strings', quantity: 1 },
      ],
      baseProducts
    );

    expect(lines.map((line) => line.slug)).toEqual(['violin-strings']);
    expect(unresolved).toEqual([{ slug: 'frame-drum', quantity: 1 }]);
  });

  it('shows entries that resolve to the same options as one line', () => {
    const { lines } = resolveCartLines(
      [
        { slug: 'sattari-effect-cymbal', size: null, quantity: 1 },
        { slug: 'sattari-effect-cymbal', size: '15"', quantity: 2 },
      ],
      baseProducts
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ size: '15"', quantity: 3, unitPrice: 100, lineTotal: 300 });
  });
});

describe('reconcileCartEntries', () => {
  it('drops hidden and deleted products and reports them', () => {
    const cart = [
      { slug: 'cymbal-felts', size: null, color: null, quantity: 1, name: 'Cymbal Felts' },
      { slug: 'violin-strings', size: null, color: null, quantity: 2 },
      { slug: 'retired-product', size: null, color: null, quantity: 1, name: 'Retired' },
    ];

    const { entries, removed } = reconcileCartEntries(cart, merged);

    expect(entries.map((entry) => entry.slug)).toEqual(['cymbal-felts']);
    expect(removed.map((entry) => entry.slug)).toEqual(['violin-strings', 'retired-product']);
  });

  it('returns the same array when nothing needs to change', () => {
    const cart = [
      { slug: 'cymbal-felts', size: null, color: null, quantity: 1, name: 'Cymbal Felts' },
    ];

    const result = reconcileCartEntries(cart, merged);

    expect(result.entries).toBe(cart);
    expect(result.removed).toEqual([]);
  });

  it('stores the resolved size, drops colors the product does not offer and merges duplicates', () => {
    const { entries } = reconcileCartEntries(
      [
        { slug: 'sattari-effect-cymbal', size: null, color: null, quantity: 1 },
        { slug: 'sattari-effect-cymbal', size: '15"', color: null, quantity: 1 },
        { slug: 'sattari-practice-pad-8', size: null, color: 'Purple', quantity: 1 },
      ],
      baseProducts
    );

    expect(entries).toEqual([
      {
        slug: 'sattari-effect-cymbal',
        size: '15"',
        color: null,
        quantity: 2,
        name: 'SATTARI effect CYMBAL',
      },
      {
        slug: 'sattari-practice-pad-8',
        size: null,
        color: null,
        quantity: 1,
        name: '8" Drummer Practice Pad',
      },
    ]);
  });
});

it('matches a quick-added sized product to the key its line is shown under', () => {
  const keyOf = createEntryKeyResolver(baseProducts);
  const { lines } = resolveCartLines(
    [{ slug: 'sattari-effect-cymbal', size: null, color: null, quantity: 1 }],
    baseProducts
  );

  expect(keyOf({ slug: 'sattari-effect-cymbal', size: null, color: null })).toBe(lines[0].key);
});
