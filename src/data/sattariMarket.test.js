import { describe, expect, it } from 'vitest';
import {
  getSattariMarketReadinessSummary,
  sattariMarketGuardrails,
  sattariMarketSampleListings,
  sattariMarketSources,
} from './sattariMarket';

describe('Sattari Market data model', () => {
  it('keeps external marketplace work approval and compliance gated', () => {
    const external = sattariMarketSources.find((source) => source.id === 'external-marketplaces');

    expect(external).toBeDefined();
    expect(external.status).toBe('approval-and-compliance-gated');
    expect(external.copy).toContain('link-out/source-label concepts only');
  });

  it('surfaces hard guardrails against unsafe marketplace claims', () => {
    expect(sattariMarketGuardrails).toEqual(
      expect.arrayContaining([
        expect.stringContaining('No scraping'),
        expect.stringContaining('No checkout'),
        expect.stringContaining('No external buyer/seller messages'),
        expect.stringContaining('No official marketplace partnership'),
      ])
    );
  });

  it('keeps seed listings labeled as prototype or link-out concepts', () => {
    expect(sattariMarketSampleListings.length).toBeGreaterThanOrEqual(3);
    expect(
      sattariMarketSampleListings.every((listing) => listing.source && listing.readiness)
    ).toBe(true);
    expect(
      sattariMarketSampleListings.some((listing) => listing.readiness.includes('concept'))
    ).toBe(true);
  });

  it('builds a readiness summary for route smoke checks', () => {
    expect(getSattariMarketReadinessSummary()).toMatchObject({
      tenant: 'Sattari Market',
      guardrailCount: 4,
      listingCount: sattariMarketSampleListings.length,
    });
  });
});
