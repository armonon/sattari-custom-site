// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
let feed;
let config;

const media = {
  data: [
    { id: '1', media_type: 'IMAGE', media_url: 'https://cdn.example/1.jpg', permalink: 'p1' },
    { id: '2', media_type: 'VIDEO', thumbnail_url: 'https://cdn.example/2.jpg', permalink: 'p2' },
    { id: '3', media_type: 'STORY', media_url: 'https://cdn.example/3.jpg', permalink: 'p3' },
  ],
};

function upstream(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const get = () => feed(new Request('https://sattarimusic.com/.netlify/functions/instagram-feed'));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'IGQV-secret-token');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  ({ default: feed, config } = await import('../../netlify/functions/instagram-feed.js'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('instagram-feed', () => {
  it('answers on the URL the site uses', () => {
    expect(config.path).toBe('/.netlify/functions/instagram-feed');
  });

  it('returns posts with CDN caching headers', async () => {
    fetchMock.mockResolvedValue(upstream(200, media));
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      posts: [
        { id: '1', image: 'https://cdn.example/1.jpg', permalink: 'p1', caption: '' },
        { id: '2', image: 'https://cdn.example/2.jpg', permalink: 'p2', caption: '' },
      ],
    });
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('netlify-cdn-cache-control')).toMatch(/durable/);
    expect(String(fetchMock.mock.calls[0][0])).toContain('access_token=IGQV-secret-token');
  });

  it('serves repeat requests from its cache instead of calling Instagram', async () => {
    fetchMock.mockResolvedValue(upstream(200, media));
    await get();
    vi.setSystemTime(new Date('2026-09-26T12:09:00Z'));
    await get();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never returns Instagram error details', async () => {
    fetchMock.mockResolvedValue(
      upstream(400, { error: { message: 'Error validating access token: IGQV-secret-token' } })
    );
    const response = await get();
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(text).not.toContain('validating');
    expect(text).not.toContain('IGQV');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('instagram-feed-failed'));
  });

  it('keeps serving the last good posts when Instagram fails later', async () => {
    fetchMock.mockResolvedValueOnce(upstream(200, media));
    await get();
    vi.setSystemTime(new Date('2026-09-26T12:11:00Z'));
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).posts).toHaveLength(2);
    expect(response.headers.get('netlify-cdn-cache-control')).toContain('max-age=60');
  });

  it('waits before asking Instagram again after a failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await get();
    await get();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-09-26T12:01:01Z'));
    await get();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a missing token generically', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', '');
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/INSTAGRAM_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses methods other than GET and HEAD', async () => {
    const response = await feed(
      new Request('https://sattarimusic.com/.netlify/functions/instagram-feed', { method: 'POST' })
    );
    expect(response.status).toBe(405);
  });
});
