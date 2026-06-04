import { describe, expect, it } from 'vitest';
import {
  createMemoryNOWProfileStore,
  getNOWProfileBlobKey,
  normalizeNOWHandle,
  readNOWProfileWithFallback,
  saveNOWProfile,
  sanitizeNOWProfileDraft,
} from './nowProfilePersistence.js';

describe('NOW profile persistence', () => {
  it('normalizes handles into globally stable profile keys', () => {
    expect(normalizeNOWHandle('@Armon Nasiri')).toBe('armon-nasiri');
    expect(getNOWProfileBlobKey('Armon')).toBe('profiles/armon.json');
  });

  it('saves and reads a public profile from the shared store', async () => {
    const store = createMemoryNOWProfileStore();
    const savedProfile = await saveNOWProfile(
      store,
      {
        handle: 'NewArtist',
        displayName: 'New Artist',
        headline: 'Producer and teacher',
        location: 'Los Angeles, CA',
        roles: ['artist', 'teacher', 'artist'],
        socials: [{ label: 'Website', url: 'https://example.com' }],
        apps: {
          market: {
            status: 'active',
            label: 'Seller profile',
            summary: 'Available across Sattari Market and other NOW apps.',
          },
        },
      },
      undefined,
      { ownerId: 'user_123' }
    );

    const { profile, source } = await readNOWProfileWithFallback(store, 'newartist');

    expect(savedProfile.schema).toBe('now-global-profile-v1');
    expect(source).toBe('stored');
    expect(profile).toMatchObject({
      handle: 'newartist',
      displayName: 'New Artist',
      headline: 'Producer and teacher',
    });
    expect(profile.roles).toEqual(['artist', 'teacher']);
    expect(profile.socials).toEqual([{ label: 'Website', url: 'https://example.com/' }]);
    expect(profile.apps.market.status).toBe('active');
    expect(profile.apps.radio.status).toBe('ready');
    expect(savedProfile.ownerId).toBe('user_123');
    expect(profile.ownerId).toBe('user_123');
  });

  it('falls back to seeded profiles when no stored profile exists', async () => {
    const store = createMemoryNOWProfileStore();
    const { profile, source } = await readNOWProfileWithFallback(store, 'armon');

    expect(source).toBe('seed');
    expect(profile.handle).toBe('armon');
  });

  it('rejects private or credential-like fields from public profile writes', () => {
    expect(() =>
      sanitizeNOWProfileDraft({
        handle: 'private-test',
        displayName: 'Private Test',
        email: 'person@example.com',
      })
    ).toThrow(/Private NOW profile fields/);

    expect(() =>
      sanitizeNOWProfileDraft({
        handle: 'token-test',
        token: 'do-not-store-this',
      })
    ).toThrow(/Private NOW profile fields/);
  });
});
