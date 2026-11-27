const stopWords = new Set(
  'a an and are as at be by can do does for from how i in is it me my of on or the to what when which with'.split(
    ' '
  )
);
const aliases = {
  guitars: 'guitar',
  strings: 'string',
  restringing: 'restring',
  restrung: 'restring',
  changing: 'change',
  replacing: 'replace',
  violins: 'violin',
  violas: 'viola',
  pegs: 'peg',
  pins: 'pin',
  tuners: 'tuner',
  drums: 'drum',
  stems: 'stem',
};
export function normalizePhrase(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function tokens(value) {
  return new Set(
    value
      .split(' ')
      .filter((word) => word && !stopWords.has(word))
      .map((word) => aliases[word] || word)
  );
}

export function buildGuideFinder(phrases, collections) {
  const destinations = new Map();
  const register = (path, title, section = '') => destinations.set(path, { path, title, section });
  register('/guides', 'Browse all music guides');
  for (const collection of collections) {
    register('/guides#' + collection.id, collection.title);
    for (const guide of collection.guides) {
      const path = '/guides/' + guide.slug;
      register(path, guide.title);
      guide.sections.forEach((section, index) =>
        register(
          path + '#' + (section.id || 'guide-section-' + (index + 1)),
          guide.title,
          section.title
        )
      );
    }
  }
  return buildPhraseIndex(phrases, destinations);
}

export function buildPhraseIndex(phrases, destinations) {
  const exact = new Map();
  const entries = [];
  for (const [path, target] of destinations) {
    const terms = phrases[path] || [];
    for (const term of terms) exact.set(normalizePhrase(term), target);
    const names = target.section ? [target.title + ' ' + target.section] : [target.title];
    const samples = [...names, ...terms].map((term) => tokens(normalizePhrase(term)));
    entries.push({ target, samples });
  }
  return { entries, exact };
}

export function findPhraseTargets(index, text, limit = 6) {
  const value = normalizePhrase(text);
  const wanted = tokens(value);
  if (!wanted.size) return [];
  const match = index.exact.get(value);
  if (match && limit === 1) return [match];
  const results = [];
  for (const { target, samples } of index.entries) {
    if (target === match) continue;
    let best = 0;
    for (const sample of samples) {
      let hits = 0;
      for (const word of wanted) if (sample.has(word)) hits++;
      if (hits < Math.ceil(wanted.size * 0.75)) continue;
      const score = hits / wanted.size + hits / (sample.size + wanted.size);
      best = Math.max(best, score);
    }
    if (best) results.push({ target, score: best });
  }
  results.sort(
    (a, b) =>
      b.score - a.score || Number(Boolean(a.target.section)) - Number(Boolean(b.target.section))
  );
  return [...(match ? [match] : []), ...results.map((item) => item.target)].slice(0, limit);
}

export { findPhraseTargets as findGuideSections };
