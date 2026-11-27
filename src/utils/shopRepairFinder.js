import { buildPhraseIndex, findPhraseTargets, normalizePhrase } from './guideFinder';

export function buildShopRepairIndex(pages, products) {
  const visible = new Map(products.map((product) => ['/product/' + product.slug, product]));
  const destinations = new Map();
  const phrases = {};
  for (const page of pages) {
    const canonical = page.path.split('#')[0];
    const product = visible.get(canonical);
    if (canonical.startsWith('/product/') && !product) continue;
    destinations.set(page.path, {
      path: page.path,
      title: product?.name || page.title,
      section: page.section,
      kind: page.kind,
    });
    phrases[page.path] = page.phrases;
  }
  // Staff can add an instrument after deployment. Include its current name and listing.
  for (const [path, product] of visible) {
    if (!destinations.has(path)) {
      destinations.set(path, { path, title: product.name, kind: 'Product' });
    }
  }
  const index = buildPhraseIndex(phrases, destinations);
  for (const [path, product] of visible) {
    const name = normalizePhrase(product.name);
    if (!index.exact.has(name)) index.exact.set(name, destinations.get(path));
  }
  return { ...index, destinations };
}

// Exact phrases keep their editorial destinations. For new wording, distinguish
// the price of an instrument, a set of strings, and the work of fitting that set.
export function findShopRepairTargets(index, text, limit = 5) {
  const query = normalizePhrase(text);
  const matches = findPhraseTargets(index, query, limit);
  if (!query || index.exact.has(query)) return matches;

  const instrument = /\b(bass|guitars?|violins?)\b/.exec(query)?.[1];
  if (!instrument) return matches;
  const strings = /\b(strings?|restring\w*|restrung)\b/.test(query);
  const fitting =
    /\b(restring\w*|restrung|labor|labour|install\w*|fitting|fitted)\b|\bput\b.*\bstrings?\b.*\bon\b|\bstrings?\b.*\bput on\b/.test(
      query
    );
  const price = /\b(costs?|prices?|pricing|how much|quote)\b/.test(query);
  const violin = instrument.startsWith('violin');
  let target;
  if (strings && fitting && !/\b(how to|myself|diy|tutorial)\b/.test(query)) {
    if (instrument === 'bass')
      target = '/services/string-replacement-woodland-hills#bass-string-fit';
    else if (violin)
      target =
        '/services/violin-restringing-woodland-hills' + (price ? '#violin-fitting-quote' : '');
    else
      target =
        '/services/guitar-restringing-woodland-hills' +
        (price || /\b(labor|labour)\b/.test(query) ? '#restringing-prices' : '');
  } else if (
    price &&
    !strings &&
    !/\b(repair\w*|setup|set up|peg|bridge|pickup|bow|case|lessons?|rent\w*|tuning|tune|action|fix\w*)\b/.test(
      query
    )
  ) {
    target = violin ? '/shop/violins' : '/shop/guitar-bass';
  }
  const preferred = target && index.destinations.get(target);
  return preferred
    ? [preferred, ...matches.filter((other) => other.path !== target)].slice(0, limit)
    : matches;
}
