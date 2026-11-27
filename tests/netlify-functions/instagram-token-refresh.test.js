// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const saved = new Map();
vi.mock('../../server/blobs.js', () => ({
  openStore: () => ({
    get: async (key) => saved.get(key) ?? null,
    setJSON: async (key, value) => void saved.set(key, value),
  }),
}));

const seed = (token) => createHash('sha256').update(token).digest('hex');
const answer = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const NOW = Date.parse('2026-11-25T10:00:00Z');
let renewInstagramToken;
let job;
let config;

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  saved.clear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'IGQV-configured');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  ({ renewInstagramToken } = await import('../../server/instagramToken.js'));
  ({ default: job, config } = await import('../../netlify/functions/instagram-token-refresh.js'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('instagram token renewal', () => {
  it('runs on a schedule well inside the 60-day lifetime', () => {
    expect(config.schedule).toBe('0 10 * * 1,4');
  });

  it('renews the configured token and stores the result with its expiry', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { access_token: 'IGQV-renewed', token_type: 'bearer', expires_in: 5184000 })
    );
    const result = await renewInstagramToken(NOW);

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://graph.instagram.com/refresh_access_token');
    expect(url.searchParams.get('grant_type')).toBe('ig_refresh_token');
    expect(url.searchParams.get('access_token')).toBe('IGQV-configured');
    expect(result).toEqual({ ok: true, expiresAt: '2027-01-24T10:00:00.000Z', days: 60 });
    expect(saved.get('current')).toEqual({
      token: 'IGQV-renewed',
      seed: seed('IGQV-configured'),
      expiresAt: '2027-01-24T10:00:00.000Z',
      refreshedAt: '2026-11-25T10:00:00.000Z',
    });
  });

  it('renews the stored token on later runs', async () => {
    saved.set('current', { token: 'IGQV-renewed', seed: seed('IGQV-configured') });
    fetchMock.mockResolvedValue(answer(200, { access_token: 'IGQV-third', expires_in: 5184000 }));
    await renewInstagramToken(NOW);

    expect(String(fetchMock.mock.calls[0][0])).toContain('access_token=IGQV-renewed');
    expect(saved.get('current').token).toBe('IGQV-third');
  });

  it('starts again from a newly saved token', async () => {
    saved.set('current', { token: 'IGQV-old-renewed', seed: seed('IGQV-older') });
    fetchMock.mockResolvedValue(answer(200, { access_token: 'IGQV-new', expires_in: 5184000 }));
    await renewInstagramToken(NOW);

    expect(String(fetchMock.mock.calls[0][0])).toContain('access_token=IGQV-configured');
    expect(saved.get('current').seed).toBe(seed('IGQV-configured'));
  });

  it('keeps the token in use and reports no token text when Instagram refuses', async () => {
    saved.set('current', { token: 'IGQV-renewed', seed: seed('IGQV-configured') });
    fetchMock.mockResolvedValue(
      answer(400, { error: { type: 'OAuthException', code: 190, message: 'bad IGQV-renewed' } })
    );
    const result = await renewInstagramToken(NOW);

    expect(result).toMatchObject({
      ok: false,
      reason: 'instagram-refused',
      status: 400,
      code: 190,
    });
    expect(JSON.stringify(result)).not.toContain('IGQV');
    expect(saved.get('current').token).toBe('IGQV-renewed');
  });

  it('does nothing for a business-account token, which does not expire', async () => {
    vi.stubEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID', '17841400000000000');
    expect(await renewInstagramToken(NOW)).toEqual({
      ok: true,
      skipped: 'business-token-does-not-expire',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs the outcome without the token and never throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down IGQV-configured'));
    const response = await job();

    expect(response.status).toBe(204);
    const logged = console.error.mock.calls.flat().join(' ');
    expect(logged).toContain('instagram-token-refresh');
    expect(logged).not.toContain('IGQV');
  });
});
