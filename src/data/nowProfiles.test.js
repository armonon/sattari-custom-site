import { describe, expect, it } from 'vitest';
import {
  getAllNOWProfiles,
  getNOWAppConnections,
  getNOWProfile,
  getNOWProfileReadiness,
  getNOWStagedUserJourney,
  getNOWTenantProfileCard,
  nowApps,
  nowPublicProfileForbiddenFields,
  nowProfileRoles,
} from './nowProfiles';

describe('NOW profile data', () => {
  it('exposes a default profile with universal app connections', () => {
    const profile = getNOWProfile('armon');
    const connections = getNOWAppConnections(profile);

    expect(profile.handle).toBe('armon');
    expect(connections).toHaveLength(nowApps.length);
    expect(connections.every((connection) => connection.name && connection.route)).toBe(true);
    expect(connections.map((connection) => connection.id)).toContain('market');
    expect(connections.map((connection) => connection.id)).toContain('radio');
    expect(profile.tenantIds).toContain('sattari_market');
  });

  it('keeps every seeded profile connected to every seeded app', () => {
    for (const profile of getAllNOWProfiles()) {
      const appIds = Object.keys(profile.apps);
      expect(appIds.sort()).toEqual(nowApps.map((app) => app.id).sort());
    }
  });

  it('returns tenant-specific cards without forking the canonical profile', () => {
    const card = getNOWTenantProfileCard('armon', 'sattari_market', 'market_listing');

    expect(card).toMatchObject({
      handle: 'armon',
      displayName: 'Armon Nasiri',
      tenantId: 'sattari_market',
      variant: 'market_listing',
    });
    expect(card.trustSignals).toContain('Sattari profile connected');
  });

  it('summarizes readiness for downstream app surfaces', () => {
    const readiness = getNOWProfileReadiness();

    expect(readiness.profileCount).toBeGreaterThanOrEqual(2);
    expect(readiness.appCount).toBeGreaterThanOrEqual(6);
    expect(readiness.activeConnectionCount).toBeGreaterThanOrEqual(3);
    expect(readiness.roles).toEqual(nowProfileRoles);
  });

  it('defines a smokeable public-data-only Market journey without unsafe routes or private fields', () => {
    const journey = getNOWStagedUserJourney('armon', 'sattari_market', 'market_listing');
    const routes = journey.steps.map((step) => step.route);
    const serializedJourney = JSON.stringify(journey).toLowerCase();

    expect(journey.schema).toBe('now-staged-user-journey-v0');
    expect(journey.handle).toBe('armon');
    expect(routes).toEqual(['/profiles/armon', '/internal/market-concept', '/services']);
    expect(routes).not.toContain('/market');
    expect(routes).not.toContain('/downloads');
    expect(journey.boundary).toMatchObject({
      publicDataOnly: true,
      authRequired: false,
      nativeMarketplacePayment: false,
      externalBuyerSellerMessage: false,
      productionListingMutation: false,
      safeHandoff: 'contact_first_or_official_shop_only',
    });

    for (const field of nowPublicProfileForbiddenFields) {
      expect(journey.boundary.privateFieldsExcluded).toContain(field);
    }
    expect(serializedJourney).not.toContain('wallet:');
    expect(serializedJourney).not.toContain('token:');
  });
});
