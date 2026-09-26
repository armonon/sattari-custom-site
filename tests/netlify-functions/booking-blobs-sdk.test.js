// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getStore } from '@netlify/blobs';

describe('installed booking storage SDK', () => {
  it('sends real conditional-write headers and reports conflicts', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 200, headers: { etag: 'v1' } }))
      .mockResolvedValueOnce(new Response('', { status: 412 }));
    const store = getStore({
      name: 'booking-sdk-test',
      siteID: 'test',
      token: 'test',
      edgeURL: 'https://example.test',
      uncachedEdgeURL: 'https://strong.example.test',
      consistency: 'strong',
      fetch: fetcher,
    });
    expect((await store.setJSON('calendar', {}, { onlyIfNew: true })).modified).toBe(true);
    expect(fetcher.mock.calls[0][1].headers['if-none-match']).toBe('*');
    expect((await store.setJSON('calendar', {}, { onlyIfMatch: 'old' })).modified).toBe(false);
    expect(fetcher.mock.calls[1][1].headers['if-match']).toBe('old');
    expect(fetcher.mock.calls[0][0]).toContain('strong.example.test');
  });
});
