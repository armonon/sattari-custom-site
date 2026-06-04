export const nowApps = [
  {
    id: 'store',
    name: 'Store',
    route: '/shop',
    description: 'Official Sattari products, services, and buyer history.',
  },
  {
    id: 'market',
    name: 'Market',
    route: '/internal/market-concept',
    description:
      'Noindexed concept rail for seller identity, listing trust, and inquiry readiness.',
  },
  {
    id: 'radio',
    name: 'Radio',
    route: '/radio',
    description: 'Host pages, show credits, submissions, and replay identity.',
  },
  {
    id: 'teach',
    name: 'Teach',
    route: '/services/music-lessons-los-angeles',
    description: 'Instructor/student role, lessons, practice tracks, and progress identity.',
  },
  {
    id: 'community',
    name: 'Community',
    route: '/profiles',
    description: 'Groups, events, forum presence, and creator/member discovery.',
  },
  {
    id: 'downloads',
    name: 'Downloads',
    route: '/shop',
    description: 'Parked plugin release rail; public alpha downloads stay off the storefront.',
  },
];

export const nowProfileRoles = [
  'artist',
  'seller',
  'teacher',
  'radio-host',
  'brand',
  'community-member',
];

export const nowProfiles = [
  {
    id: 'prf_armon',
    kind: 'person',
    handle: 'armon',
    displayName: 'Armon Nasiri',
    headline: 'Builder, musician, product operator, and Sattari platform lead.',
    location: 'Los Angeles, CA',
    bio: 'A living NOW profile for Sattari projects, music, products, gear, lessons, radio, and internet activity in one place.',
    avatarInitials: 'AN',
    bannerTone: 'gold',
    roles: ['creator', 'musician', 'seller', 'teacher', 'radio-host', 'builder'],
    tenantIds: [
      'sattari_store',
      'sattari_market',
      'sattari_radio',
      'sattari_teach',
      'sattari_community',
      'sattari_downloads',
    ],
    socials: [
      { label: 'Sattari Music', url: 'https://sattarimusic.com' },
      { label: 'Instagram', url: 'https://instagram.com/sattarimusic' },
      { label: 'YouTube', url: 'https://youtube.com/@sattarimusic' },
    ],
    apps: {
      store: {
        status: 'active',
        label: 'Official products and services',
        summary: 'Profile connects the official shop, local services, and Sattari-made tools.',
      },
      market: {
        status: 'active',
        label: 'Verified seller concept',
        summary: 'Can appear as a trusted seller/brand card on Sattari Market listings.',
      },
      radio: {
        status: 'active',
        label: 'Host profile',
        summary: 'Owns the flagship Sattari Radio host/show identity.',
      },
      teach: {
        status: 'ready',
        label: 'Instructor identity',
        summary: 'Ready to connect future lesson/course surfaces to the same profile.',
      },
      community: {
        status: 'ready',
        label: 'Community profile',
        summary: 'Ready to anchor events, groups, and forum posts when those surfaces go live.',
      },
      downloads: {
        status: 'planned',
        label: 'Plugin release rail parked',
        summary: 'Public alpha downloads are removed until sale-ready release gates pass.',
      },
    },
    featured: [
      { appId: 'store', title: 'Sattari Music Store', route: '/shop' },
      {
        appId: 'market',
        title: 'Sattari Market seller identity',
        route: '/internal/market-concept',
      },
      { appId: 'radio', title: 'Sattari Radio host lane', route: '/radio' },
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
    headline:
      'Official Sattari brand account for products, service updates, and platform announcements.',
    location: 'Los Angeles, CA',
    bio: 'The official Sattari profile can power brand-owned listings, radio blocks, service pages, and support updates across the app network.',
    avatarInitials: 'SS',
    bannerTone: 'dark',
    roles: ['brand', 'seller', 'teacher', 'radio-host', 'community-member'],
    tenantIds: [
      'sattari_store',
      'sattari_market',
      'sattari_radio',
      'sattari_teach',
      'sattari_community',
      'sattari_downloads',
    ],
    socials: [{ label: 'Website', url: 'https://sattarimusic.com' }],
    apps: {
      store: {
        status: 'active',
        label: 'Official shop identity',
        summary: 'Brand profile for official products and services.',
      },
      market: {
        status: 'active',
        label: 'Official listing source',
        summary: 'Separates brand inventory from user marketplace listings.',
      },
      radio: {
        status: 'ready',
        label: 'Station identity',
        summary: 'Can post official show schedules and station updates.',
      },
      teach: {
        status: 'planned',
        label: 'Course brand',
        summary: 'Prepared for official Sattari lesson/course publishing.',
      },
      community: {
        status: 'ready',
        label: 'Community moderator',
        summary: 'Prepared for groups, events, and forum moderation.',
      },
      downloads: {
        status: 'planned',
        label: 'Release publisher parked',
        summary: 'Download publishing waits for internal validation and sale-ready approval.',
      },
    },
    featured: [
      { appId: 'store', title: 'Official Sattari products', route: '/shop' },
      {
        appId: 'market',
        title: 'Official vs user listing boundary',
        route: '/internal/market-concept',
      },
      { appId: 'radio', title: 'Station programming identity', route: '/radio' },
    ],
    tenantCards: [
      {
        tenantId: 'sattari_market',
        variant: 'market_listing',
        title: 'Official Sattari source',
        subtitle: 'Brand-owned listing card',
        trustSignals: [
          'Official shop separate',
          'Brand profile connected',
          'No user checkout in v0',
        ],
      },
      {
        tenantId: 'sattari_radio',
        variant: 'station',
        title: 'Official station identity',
        subtitle: 'Sattari Radio brand card',
        trustSignals: ['Official Sattari lane', 'Program blocks ready', 'Rights/submissions gated'],
      },
    ],
  },
];

export const nowPublicProfileForbiddenFields = [
  'vault',
  'wallet',
  'pass',
  'email',
  'savedItems',
  'saved_items',
  'inquiry',
  'payment',
  'license',
  'secret',
  'token',
];

const nowStagedUserJourneyTemplates = {
  sattari_market: {
    schema: 'now-staged-user-journey-v0',
    label: 'Profile → Sattari Market card → safe contact-first handoff',
    tenantId: 'sattari_market',
    variant: 'market_listing',
    steps: [
      {
        id: 'public_profile',
        label: 'Open the public NOW profile',
        route: '/profiles/{handle}',
        proof: 'Shows public identity, roles, app rail, and featured Market surface only.',
      },
      {
        id: 'tenant_market_card',
        label: 'Follow the Market app rail into the tenant card',
        route: '/internal/market-concept',
        proof:
          'Shows a NOW seller card, source lanes, listing readiness labels, and noindexed Market concept boundary.',
      },
      {
        id: 'safe_contact_first',
        label: 'Use contact/shop readiness instead of native marketplace actions',
        route: '/services',
        proof:
          'Keeps buyer/seller messaging, payments, checkout for user listings, and live marketplace sync approval-gated.',
      },
    ],
    boundary: {
      publicDataOnly: true,
      privateFieldsExcluded: nowPublicProfileForbiddenFields,
      authRequired: false,
      nativeMarketplacePayment: false,
      externalBuyerSellerMessage: false,
      productionListingMutation: false,
      safeHandoff: 'contact_first_or_official_shop_only',
    },
  },
  sattari_radio: {
    schema: 'now-staged-user-journey-v0',
    label: 'Profile → Sattari Radio card → submissions stay gated',
    tenantId: 'sattari_radio',
    variant: 'host',
    steps: [
      {
        id: 'public_profile',
        label: 'Open the public NOW profile',
        route: '/profiles/{handle}',
        proof: 'Shows public host identity, roles, and app rail only.',
      },
      {
        id: 'tenant_radio_card',
        label: 'Follow the Radio app rail into the host surface',
        route: '/radio',
        proof:
          'Shows the Radio host/station identity without enabling rights or submission automation.',
      },
      {
        id: 'safe_submission_boundary',
        label: 'Keep submissions and rights review gated',
        route: '/radio',
        proof:
          'No upload, rights clearance, external message, or publication action is created by the profile rail.',
      },
    ],
    boundary: {
      publicDataOnly: true,
      privateFieldsExcluded: nowPublicProfileForbiddenFields,
      authRequired: false,
      uploadCreated: false,
      externalMessage: false,
      publicationApproval: false,
      safeHandoff: 'host_profile_review_only',
    },
  },
};

export function getNOWProfile(handle = 'armon') {
  return nowProfiles.find((profile) => profile.handle === handle) ?? nowProfiles[0];
}

export function getAllNOWProfiles() {
  return nowProfiles;
}

export function getNOWAppConnections(profile = getNOWProfile()) {
  return nowApps.map((app) => ({
    ...app,
    profileStatus: profile.apps[app.id]?.status ?? 'planned',
    profileLabel: profile.apps[app.id]?.label ?? 'Connection planned',
    profileSummary:
      profile.apps[app.id]?.summary ?? 'This app can read the shared NOW profile later.',
  }));
}

export function getNOWTenantProfileCard(handle = 'armon', tenantId = 'sattari_market', variant) {
  const profile = getNOWProfile(handle);
  const tenantCard = (profile.tenantCards || []).find((card) => {
    const tenantMatches = !tenantId || card.tenantId === tenantId;
    const variantMatches = !variant || card.variant === variant;
    return tenantMatches && variantMatches;
  });

  return tenantCard
    ? {
        ...tenantCard,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarInitials: profile.avatarInitials,
        headline: profile.headline,
        roles: profile.roles,
      }
    : null;
}

export function getNOWStagedUserJourney(
  handle = 'armon',
  tenantId = 'sattari_market',
  variant = 'market_listing'
) {
  const profile = getNOWProfile(handle);
  const template =
    nowStagedUserJourneyTemplates[tenantId] ?? nowStagedUserJourneyTemplates.sattari_market;

  return {
    ...template,
    handle: profile.handle,
    profileRoute: `/profiles/${profile.handle}`,
    variant: variant || template.variant,
    steps: template.steps.map((step) => ({
      ...step,
      route: step.route.replace('{handle}', profile.handle),
    })),
  };
}

export function getNOWProfileReadiness() {
  const primaryProfile = getNOWProfile('armon');
  const activeConnections = getNOWAppConnections(primaryProfile).filter(
    (connection) => connection.profileStatus === 'active'
  );

  return {
    profileCount: nowProfiles.length,
    appCount: nowApps.length,
    activeConnectionCount: activeConnections.length,
    roles: nowProfileRoles,
    primaryHandle: primaryProfile.handle,
  };
}
