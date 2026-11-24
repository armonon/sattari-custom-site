// Buying guidance is separate from price, stock and specifications. Those facts
// always come from the merged live catalog supplied by InventoryContext.
export const instrumentGroups = {
  violins: [
    'cremona-handmade-acoustic-violin',
    'brescia-acoustic-violin',
    'chiara-wooden-electric-violin',
    'miami-electric-violin',
    'matilde-electric-violin',
  ],
  'guitar-bass': [
    'classic-nylon-string-guitar',
    'steel-string-acoustic-guitar',
    'flame-stratocaster-electric-guitar',
    'five-string-bass-guitar',
  ],
};

export const categoryBuyingGuides = {
  violins: {
    title: 'Compare the violin models',
    introduction:
      'Start with acoustic playing or amplified practice, then check instrument size and the equipment you already own. Compare the listed details below; the product page shows its current options and availability.',
    questions: [
      'Confirm the instrument size with your teacher or the shop before choosing a student violin.',
      'For an electric model, check its outputs, power and the headphones or amplifier you intend to use.',
      'Check the included kit before adding a separate bow, case or rosin.',
    ],
    links: [
      { to: '/violin-strings-woodland-hills', label: 'Violin string fit and replacement' },
      { to: '/services/violin-repair-los-angeles', label: 'Ask about violin setup' },
    ],
  },
  'guitar-bass': {
    title: 'Compare guitars and bass',
    introduction:
      'Choose the instrument for the music you want to play: nylon-string classical, steel-string acoustic, electric guitar or five-string bass. Compare the listed details, then ask about fit, setup and any equipment you need.',
    questions: [
      'Ask about scale length, neck dimensions and handedness if they are not listed.',
      'Confirm included accessories and any amplifier, cable or case you will need.',
      'Share your preferred tuning and playing style when discussing strings or setup.',
    ],
    links: [
      { to: '/guitar-strings-woodland-hills', label: 'Find the right guitar strings' },
      { to: '/services/guitar-setup-los-angeles', label: 'Ask about guitar and bass setup' },
    ],
  },
  cymbals: {
    title: 'Choose a cymbal for your setup',
    introduction:
      'Compare the role of a crash, splash, hi-hat pair or effect cymbal before choosing by price. For a closer comparison, ask about the exact cymbal and a sound sample.',
    questions: [
      'Confirm diameter, alloy and weight when those details are not listed.',
      'For an effect cymbal, select the size on its product page; the price varies by size.',
      'Check your stand, sleeve and felt arrangement before adding a new cymbal.',
    ],
    links: [{ to: '/guides/choose-your-first-cymbals', label: 'Cymbal buying guide' }],
  },
  sticks: {
    title: 'Choose your sticks and practice gear',
    introduction:
      'Compare the listed 5A and 7A sizes, hickory and maple, and wood or nylon tips. The four-pair listing includes a bag; confirm the exact mix with the shop before ordering that bundle.',
    questions: [
      'Use the listed size, wood and tip to compare with a pair you already like.',
      'The four-pair bundle has no online stick-mix selector. Call to agree on the four pairs before ordering.',
      'Check whether you already have a bag before adding another one.',
    ],
    links: [{ to: '/shop/essentials', label: 'Practice pads and accessories' }],
  },
  essentials: {
    title: 'Match the accessory to your instrument',
    introduction:
      'Start with the job you need it to do: practice, carry sticks, support a cymbal or connect an instrument. Check dimensions, connectors and package contents before ordering.',
    questions: [
      'Choose a practice-pad size and color on its product page; ask about mounting if you intend to use a stand.',
      'For a wireless system, share your instrument and amplifier models so the team can check compatibility.',
      'For darbuka, ask about head diameter and overall dimensions if size matters to your playing or travel setup.',
    ],
    links: [{ to: '/shop/sticks', label: 'Compare drumsticks' }],
  },
};

const guitarQuestions = [
  'Confirm the instrument dimensions, handedness and included accessories before ordering.',
  'Share your preferred tuning and any setup questions with the shop.',
];
const violinQuestions = [
  'Confirm that the listed instrument size suits the player; ask your teacher if you are unsure.',
  'Check the included items in Product Details before buying an extra bow, case or rosin.',
];
const cymbalQuestions = [
  'Ask about diameter, alloy and weight if they are not listed in Product Details.',
  'Describe your current kit and ask about a sound sample if you want to compare the response.',
];
const stickQuestions = [
  'Compare the listed size, wood and tip with the pair you currently use.',
  'Ask about exact length and diameter if you need a close match to your current sticks.',
];

export const productBuyingQuestions = {
  ...Object.fromEntries(instrumentGroups.violins.map((slug) => [slug, violinQuestions])),
  ...Object.fromEntries(instrumentGroups['guitar-bass'].map((slug) => [slug, guitarQuestions])),
  'pirouz-series-cymbals': cymbalQuestions,
  'pirouz-series-splash': cymbalQuestions,
  'sattari-hand-crafted-hi-hat': cymbalQuestions,
  'sattari-effect-cymbal': [
    'Select your cymbal size above; the displayed price follows your selection.',
    ...cymbalQuestions,
  ],
  'classic-american-hickory-a7': stickQuestions,
  'classic-american-hickory-a5': stickQuestions,
  'classic-maple-5a-nylon-tip': stickQuestions,
  '4-pair-drumsticks-free-bag': [
    'This listing includes four pairs and a bag. The online order has no selector for the stick mix.',
    'Call before ordering to confirm which four pairs are available and how to specify your selection.',
  ],
  'cymbal-felts': [
    'Confirm the felt dimensions, center-hole fit and number supplied before ordering.',
    'Share your stand model if you are unsure about the fit.',
  ],
  'violin-strings': [
    'Check the listed violin sizes and ball-end fitting against your instrument and fine tuners.',
    'Ask about the exact strings in the package, material and tension before ordering if these matter to your setup.',
    'Installation is a separate service inquiry; confirm the scope and quote before an appointment.',
  ],
  'sattari-darbuka': [
    'Ask about head diameter, overall height and weight if fit or portability matters to you.',
    'Confirm any carrying case or other accessories you need; do not assume they are included.',
  ],
  'sattari-practice-pad-12': [
    'Choose a color above and check the listed pad size against your practice space.',
    'Ask about the playing surface and stand mounting if you plan to use it with other equipment.',
  ],
  'sattari-practice-pad-8': [
    'Choose a color above and check the listed pad size against your practice space.',
    'Ask about the playing surface and stand mounting if you plan to use it with other equipment.',
  ],
  'violin-pickup-bridge': [
    'Ask the shop to assess the bridge fit for your violin before installation; a listed bridge is not a guarantee of fit to every instrument.',
    'Confirm the connection to your amplifier, interface or PA and any fitting work or equipment needed.',
  ],
  'sattari-rosin': [
    'Check whether rosin is already included with your violin or bow kit.',
    'Share your instrument and bow details if you need help choosing rosin.',
  ],
  'wireless-transmitter-receiver': [
    'Share your instrument, pickup and amplifier or pedalboard models to confirm compatibility.',
    'Ask about connector fit, battery runtime, range and latency for your intended use; those specifications are not listed here.',
  ],
  'drum-stick-bag': [
    'Check the listed capacity and mounting method against your sticks and stand.',
    'The four-pair drumstick bundle already includes a bag; you may not need a second one.',
  ],
};

const padSlugs = ['sattari-practice-pad-12', 'sattari-practice-pad-8'];
const stickSlugs = [
  'classic-american-hickory-a5',
  'classic-american-hickory-a7',
  'classic-maple-5a-nylon-tip',
];
const accessoryRelated = {
  '4-pair-drumsticks-free-bag': padSlugs,
  'sattari-practice-pad-12': [...stickSlugs, 'sattari-practice-pad-8'],
  'sattari-practice-pad-8': [...stickSlugs, 'sattari-practice-pad-12'],
  'drum-stick-bag': [...stickSlugs, ...padSlugs],
  'cymbal-felts': ['pirouz-series-cymbals', 'pirouz-series-splash', 'sattari-hand-crafted-hi-hat'],
  'violin-strings': ['sattari-rosin'],
  'sattari-rosin': ['violin-strings'],
};

export function relatedCatalogProducts(product, products) {
  if (!product) return [];
  const group = Object.values(instrumentGroups).find((slugs) => slugs.includes(product.slug));
  const slugs = group || accessoryRelated[product.slug];
  const candidates = slugs
    ? slugs.map((slug) => products.find((item) => item.slug === slug)).filter(Boolean)
    : ['cymbals', 'sticks'].includes(product.category)
      ? products.filter((item) => item.category === product.category)
      : [];
  return candidates.filter((item) => item.slug !== product.slug).slice(0, 4);
}

export function comparisonProducts(categoryKey, products) {
  return (instrumentGroups[categoryKey] || [])
    .map((slug) =>
      products.find((product) => product.slug === slug && product.category === categoryKey)
    )
    .filter(Boolean);
}

export function comparisonSpec(product, field) {
  const patterns = {
    fit: /^(Size|Instrument|Type|Strings|Overall size):/,
    included: /^Included:/,
  };
  const matches = (product.specs || []).filter((spec) => patterns[field]?.test(spec));
  return matches.length ? matches.join(' · ') : 'Ask the shop to confirm.';
}

// Only catalog-backed options enter a public variant URL; canonical pages stay query-free.
export function productVariantPath(product, { size = null, color = null } = {}) {
  const params = new URLSearchParams();
  if (product.sizes?.some((option) => option.size === size)) params.set('size', size);
  if (product.colors?.some((option) => option.name === color)) params.set('color', color);
  const query = params.toString();
  return `/product/${product.slug}${query ? `?${query}` : ''}`;
}
