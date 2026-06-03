const nowApps = [
  { id: 'store', name: 'Store', route: '/shop' },
  { id: 'market', name: 'Market', route: '/market' },
  { id: 'radio', name: 'Radio', route: '/radio' },
  { id: 'teach', name: 'Teach', route: '/services/music-lessons-los-angeles' },
  { id: 'community', name: 'Community', route: '/profiles' },
  { id: 'downloads', name: 'Downloads', route: '/downloads' },
];

const profiles = [
  {
    id: 'prf_armon',
    kind: 'person',
    handle: 'armon',
    displayName: 'Armon Nasiri',
    headline: 'Builder, musician, product operator, and Sattari platform lead.',
    avatarInitials: 'AN',
    location: 'Los Angeles, CA',
    roles: ['creator', 'musician', 'seller', 'teacher', 'radio-host', 'builder'],
    tenantIds: ['sattari_store', 'sattari_market', 'sattari_radio', 'sattari_teach', 'sattari_community', 'sattari_downloads'],
    bio: 'A living NOW profile for Sattari projects, music, products, gear, lessons, radio, and internet activity in one place.',
    links: [
      { service: 'Website', label: 'Sattari Music', url: 'https://sattarimusic.com' },
      { service: 'Profile', label: 'NOW hub', url: '/profiles/armon' },
    ],
    featured: [
      { appId: 'market', title: 'Sattari Market seller identity', route: '/market' },
      { appId: 'radio', title: 'Sattari Radio host lane', route: '/radio' },
      { appId: 'downloads', title: 'Sattari plugin downloads', route: '/downloads' },
    ],
    tenantCards: [
      {
        tenantId: 'sattari_market',
        variant: 'market_listing',
        title: 'NOW verified seller',
        subtitle: 'Sattari Market identity card',
        trustSignals: ['Manual listings', 'Inquiry-only v0', 'Sattari profile connected'],
      },
      {
        tenantId: 'sattari_radio',
        variant: 'host',
        title: 'Sattari Radio host',
        subtitle: 'Show and station identity',
        trustSignals: ['Official Sattari lane', 'Show cards ready', 'Submissions stay gated'],
      },
    ],
  },
  {
    id: 'prf_sattari',
    kind: 'brand',
    handle: 'sattari',
    displayName: 'Sattari Sound Lab',
    headline: 'Music gear, lessons, radio, and creator tools.',
    avatarInitials: 'SS',
    location: 'Los Angeles, CA',
    roles: ['brand', 'seller', 'teacher', 'radio-host'],
    tenantIds: ['sattari_store', 'sattari_market', 'sattari_radio', 'sattari_teach', 'sattari_community', 'sattari_downloads'],
    bio: 'The official Sattari profile connecting products, services, gear listings, lesson cards, radio blocks, and downloads.',
    links: [
      { service: 'Website', label: 'Sattari', url: 'https://sattarimusic.com' },
      { service: 'Market', label: 'Gear shelf', url: '/market' },
    ],
    featured: [
      { appId: 'store', title: 'Official products', route: '/shop' },
      { appId: 'market', title: 'Official vs user listing boundary', route: '/market' },
      { appId: 'radio', title: 'Station programming identity', route: '/radio' },
    ],
    tenantCards: [
      {
        tenantId: 'sattari_market',
        variant: 'market_listing',
        title: 'Official Sattari source',
        subtitle: 'Brand-owned listing card',
        trustSignals: ['Official shop separate', 'Brand profile connected', 'No user checkout in v0'],
      },
    ],
  },
];

function publicProfile(profile) {
  return {
    id: profile.id,
    kind: profile.kind,
    handle: profile.handle,
    displayName: profile.displayName,
    headline: profile.headline,
    avatarInitials: profile.avatarInitials,
    location: profile.location,
    roles: profile.roles,
    tenantIds: profile.tenantIds,
    bio: profile.bio,
    links: profile.links,
    featured: profile.featured,
  };
}

function getProfile(handle = 'armon') {
  const normalized = String(handle).replace(/^@/, '').trim().toLowerCase();
  return profiles.find((profile) => profile.handle === normalized) || profiles[0];
}

function getTenantCard(profile, tenantId, variant) {
  return profile.tenantCards.find((card) => {
    const tenantMatches = !tenantId || card.tenantId === tenantId;
    const variantMatches = !variant || card.variant === variant;
    return tenantMatches && variantMatches;
  });
}

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const profile = getProfile(params.handle);
  const tenantCard = getTenantCard(profile, params.tenant, params.variant);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify({
      schema: 'now-profile-api-v0',
      profile: publicProfile(profile),
      apps: nowApps,
      tenantCard: tenantCard || null,
      guardrails: [
        'Public profile payload only; no private Vault, wallet, pass, email, saved items, or inquiry data.',
        'Manual and internal app connections are live first; external connectors stay approval-gated.',
      ],
    }),
  };
}
