import {
  getNOWProfile,
  getNOWStagedUserJourney,
  getNOWTenantProfileCard,
  nowApps,
  nowPublicProfileForbiddenFields,
} from '../../src/data/nowProfiles.js';

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
    socials: profile.socials,
    featured: profile.featured,
  };
}

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const profile = getNOWProfile(params.handle);
  const tenantId = params.tenant || 'sattari_market';
  const variant = params.variant || 'market_listing';
  const tenantCard = getNOWTenantProfileCard(profile.handle, tenantId, variant);
  const stagedJourney = getNOWStagedUserJourney(profile.handle, tenantId, variant);

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
      stagedJourney,
      guardrails: [
        'Public profile payload only; no private Vault, wallet, pass, email, saved items, inquiry, payment, license, secret, or token data.',
        'Manual and internal app connections are live first; auth, external connectors, payments, downloads, and production mutations stay approval-gated.',
        'The Market journey is contact-first or official-shop-only; it does not send buyer/seller messages or mutate listings.',
      ],
      privateFieldsExcluded: nowPublicProfileForbiddenFields,
    }),
  };
}
