export const sattariMarketTenant = {
  id: 'sattari-market',
  name: 'Sattari Market',
  tagline: 'Buy, sell, and discover music gear through trusted musician profiles.',
  description:
    'A NOW-powered music-gear market concept for used instruments, cymbals, recording tools, pedals, accessories, lessons, repairs, and local studio resources.',
  profileLayer:
    'NOW seller profiles provide the identity and trust layer when the shared account rail is approved.',
};

export const sattariMarketSources = [
  {
    id: 'manual',
    label: 'Manual seller listings',
    status: 'ready-for-local-prototype',
    copy: 'Sellers can add a listing or link manually inside the prototype without scraping another marketplace.',
  },
  {
    id: 'sattari-store',
    label: 'Official Sattari Store',
    status: 'separate-official-catalog',
    copy: 'Official Sattari products stay separate from user marketplace listings and keep normal shop checkout behavior.',
  },
  {
    id: 'external-marketplaces',
    label: 'External marketplace links',
    status: 'approval-and-compliance-gated',
    copy: 'Etsy, Reverb, OfferUp, Craigslist, Facebook Marketplace, and eBay remain link-out/source-label concepts only until compliant connector work is approved.',
  },
];

export const sattariMarketCategories = [
  'Drums & cymbals',
  'Guitars & basses',
  'Synths & keyboards',
  'Recording gear',
  'Pedals & effects',
  'Accessories & cases',
  'Lessons, repairs & rentals',
];

export const sattariMarketGuardrails = [
  'No scraping or live third-party marketplace sync in this route.',
  'No checkout, escrow, payments, shipping labels, or payout promises for user listings.',
  'No external buyer/seller messages are sent from the prototype.',
  'No official marketplace partnership or sale-ready launch claim is made.',
];

export const sattariMarketSampleListings = [
  {
    id: 'sattari-pirouz-used-demo',
    title: 'Pirouz Series cymbal — demo condition',
    category: 'Drums & cymbals',
    source: 'Manual listing prototype',
    seller: 'Sattari verified seller concept',
    price: '$80 asking',
    location: 'Los Angeles, CA',
    readiness: 'Local prototype data',
  },
  {
    id: 'studio-snare-case',
    title: 'Studio snare with soft case',
    category: 'Drums & cymbals',
    source: 'External link placeholder',
    seller: 'NOW musician profile placeholder',
    price: 'Inquiry only',
    location: 'North Hollywood, CA',
    readiness: 'Link-out concept only',
  },
  {
    id: 'pedalboard-bundle',
    title: 'Pedalboard bundle for live sessions',
    category: 'Pedals & effects',
    source: 'Manual listing prototype',
    seller: 'NOW seller card placeholder',
    price: '$220 asking',
    location: 'Burbank, CA',
    readiness: 'Local prototype data',
  },
];

export function getSattariMarketReadinessSummary() {
  return {
    tenant: sattariMarketTenant.name,
    safePrototypeSources: sattariMarketSources.filter((source) =>
      ['manual', 'sattari-store'].includes(source.id)
    ),
    gatedSources: sattariMarketSources.filter((source) => source.status.includes('gated')),
    guardrailCount: sattariMarketGuardrails.length,
    listingCount: sattariMarketSampleListings.length,
  };
}
