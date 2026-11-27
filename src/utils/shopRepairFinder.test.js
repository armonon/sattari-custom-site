import { describe, expect, it } from 'vitest';
import pages from '../data/shopRepairSearch.json';
import { buildShopRepairIndex, findShopRepairTargets } from './shopRepairFinder';

describe('shop and repair search', () => {
  it('takes every published phrase to its assigned page or section', () => {
    const productPaths = pages.filter((page) => page.path.startsWith('/product/') && !page.section);
    const products = productPaths.map(({ path, title }) => ({ slug: path.slice(9), name: title }));
    const index = buildShopRepairIndex(pages, products);
    let count = 0;
    for (const page of pages) {
      for (const query of page.phrases) {
        expect(findShopRepairTargets(index, query, 1)[0]?.path, query).toBe(page.path);
        count++;
      }
    }
    expect(count).toBeGreaterThan(2000);
  });

  it.each([
    ['install electric guitar strings', '/services/guitar-restringing-woodland-hills'],
    ['install violin strings Woodland Hills', '/services/violin-restringing-woodland-hills'],
    ['guitar strings $35 labor', '/services/guitar-restringing-woodland-hills#restringing-prices'],
    [
      'where can I get strings put on my electric guitar',
      '/services/guitar-restringing-woodland-hills',
    ],
    ['bass restring cost', '/services/string-replacement-woodland-hills#bass-string-fit'],
    ['guitar price Woodland Hills', '/shop/guitar-bass'],
  ])('recognizes shopper intent in “%s”', (text, path) => {
    expect(findShopRepairTargets(buildShopRepairIndex(pages, []), text, 1)[0]?.path).toBe(path);
  });

  it('uses current inventory while preserving explicit shop and service matches', () => {
    const records = [
      { path: '/shop/violins', title: 'Violins', phrases: ['violin strings'] },
      { path: '/product/old', title: 'Old bow', phrases: ['antique bow'] },
    ];
    const products = [
      { slug: 'new-bow', name: 'Walnut bow' },
      { slug: 'strings', name: 'Violin strings' },
    ];
    const index = buildShopRepairIndex(records, products);
    expect(findShopRepairTargets(index, 'antique bow')).toEqual([]);
    expect(findShopRepairTargets(index, 'walnut bow', 1)[0].path).toBe('/product/new-bow');
    expect(findShopRepairTargets(index, 'violin strings', 1)[0].path).toBe('/shop/violins');
  });
});
