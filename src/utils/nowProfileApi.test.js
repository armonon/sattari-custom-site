import { describe, expect, it } from 'vitest';
import { fetchNOWProfile, nowProfileApiPath, saveNOWProfileDraft } from './nowProfileApi.js';

describe('NOW profile browser API helpers', () => {
  it('loads a public profile by handle', async () => {
    const calls = [];
    const result = await fetchNOWProfile('artist', async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          schema: 'now-profile-api-v0',
          profile: { handle: 'artist' },
          storage: { source: 'stored' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    expect(calls[0]).toBe(`${nowProfileApiPath}?handle=artist`);
    expect(result.profile.handle).toBe('artist');
  });

  it('blocks browser saves until an auth token is available', async () => {
    await expect(saveNOWProfileDraft({ handle: 'artist' }, { token: null })).rejects.toThrow(
      /Sign in before saving/
    );
  });

  it('sends profile saves with bearer auth when token exists', async () => {
    const calls = [];
    const result = await saveNOWProfileDraft(
      { handle: 'artist', displayName: 'Artist' },
      {
        token: 'owner-token',
        fetchImpl: async (url, options) => {
          calls.push({ url, options });
          return new Response(
            JSON.stringify({ schema: 'now-profile-save-v1', profile: { handle: 'artist' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        },
      }
    );

    expect(calls[0].options.method).toBe('PATCH');
    expect(calls[0].options.headers.Authorization).toBe('Bearer owner-token');
    expect(JSON.parse(calls[0].options.body)).toMatchObject({ handle: 'artist' });
    expect(result.profile.handle).toBe('artist');
  });
});
