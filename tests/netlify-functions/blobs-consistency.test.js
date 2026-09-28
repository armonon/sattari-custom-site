// @vitest-environment node
import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real @netlify/blobs client, pointed at a stubbed fetch, so these tests
// see what the runtime would: which URL a read goes to, and whether a strong
// read is possible at all.

const EDGE = 'https://edge.blobs.test';
const UNCACHED = 'https://uncached.blobs.test';

const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

// What Netlify hands a v2 function: the uncached URL strong reads need.
function useV2Context() {
  globalThis.netlifyBlobsContext = encode({
    siteID: 'site',
    token: 'token',
    edgeURL: EDGE,
    uncachedEdgeURL: UNCACHED,
  });
}

// What a Lambda-style `handler` function gets: connectLambda() reads the
// event's credentials, which carry the cached edge URL only.
function lambdaEvent() {
  return {
    headers: { 'x-nf-site-id': 'site', 'x-nf-deploy-id': 'deploy' },
    blobs: encode({ url: EDGE, token: 'token' }),
  };
}

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  delete globalThis.netlifyBlobsContext;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.netlifyBlobsContext;
  delete process.env.NETLIFY_BLOBS_CONTEXT;
});

describe('strong consistency by function format', () => {
  it('is available to a v2 function, and /api/inventory says so', async () => {
    useV2Context();
    const { default: inventory } = await import('../../netlify/functions/inventory.js');

    const response = await inventory(new Request('https://sattarimusic.com/api/inventory'), {});
    const body = await response.json();

    expect(body).toMatchObject({
      degraded: false,
      consistency: 'strong',
      eventualConsistency: false,
    });
    expect(fetchMock).toHaveBeenCalled();
    for (const [url] of fetchMock.mock.calls) expect(String(url)).toMatch(/^https:\/\/uncached\./);
  });

  it('was never available to a Lambda-style function: shop reads went stale', async () => {
    const { isConsistencyDegraded, openStore } = await import('../../server/blobs.js');

    const store = openStore(lambdaEvent(), 'inventory');
    await store.get('stock', { type: 'json' });

    expect(store.consistency).toBe('eventual');
    expect(isConsistencyDegraded()).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/edge\./);
  });

  it('was never available to a Lambda-style function: bookings could not be read at all', async () => {
    const { readBookings } = await import('../../server/studioBookingStore.js');

    await expect(readBookings(lambdaEvent())).rejects.toThrow(/uncachedEdgeURL/);
  });

  it('does not hand an event adapted from a v2 request to connectLambda', async () => {
    useV2Context();
    const { openStore } = await import('../../server/blobs.js');
    const { lambdaEvent: adapt } = await import('../../server/functionAdapter.js');
    const event = await adapt(new Request('https://sattarimusic.com/api/staff/stock'), {});

    const store = openStore(event, 'inventory');
    await store.get('stock', { type: 'json' });

    expect(store.consistency).toBe('strong');
    expect(process.env.NETLIFY_BLOBS_CONTEXT).toBeUndefined();
  });
});

describe('confirming conditional writes', () => {
  function fakeStore({ result, stored }) {
    return {
      setJSON: vi.fn(async () => result),
      getWithMetadata: vi.fn(async () => stored),
    };
  }

  it('trusts a write that came back with an etag, and reports a lost race', async () => {
    const { writeIfUnchanged } = await import('../../server/blobs.js');
    const won = fakeStore({ result: { modified: true, etag: '"v2"' } });
    const lost = fakeStore({ result: { modified: false } });

    expect(await writeIfUnchanged(won, 'k', { a: 1 }, { etag: '"v1"' })).toBe(true);
    expect(won.setJSON).toHaveBeenCalledWith('k', { a: 1 }, { onlyIfMatch: '"v1"' });
    expect(await writeIfUnchanged(lost, 'k', { a: 1 }, null)).toBe(false);
    expect(lost.setJSON).toHaveBeenCalledWith('k', { a: 1 }, { onlyIfNew: true });
    expect(won.getWithMetadata).not.toHaveBeenCalled();
  });

  // The SDK reports every non-412 answer, errors included, as modified.
  it('reads back a write that came back without an etag', async () => {
    const { writeIfUnchanged } = await import('../../server/blobs.js');
    const landed = fakeStore({
      result: { modified: true, etag: '' },
      stored: { data: { a: 1 }, etag: '"v2"' },
    });
    const failed = fakeStore({
      result: { modified: true, etag: '' },
      stored: { data: { a: 0 }, etag: '"v1"' },
    });

    expect(await writeIfUnchanged(landed, 'k', { a: 1 }, { etag: '"v1"' })).toBe(true);
    await expect(writeIfUnchanged(failed, 'k', { a: 1 }, { etag: '"v1"' })).rejects.toMatchObject({
      code: 'BLOB_WRITE_UNCONFIRMED',
    });
  });

  it('fails a stock update whose write the store did not confirm', async () => {
    useV2Context();
    // Reads find nothing; the conditional write answers 500 (after the
    // SDK's own retries), which the SDK reports as modified.
    fetchMock.mockImplementation(async (url, options) =>
      options?.method === 'put'
        ? new Response('upstream failure', { status: 500 })
        : new Response(null, { status: 404 })
    );
    const { updateStock } = await import('../../server/stockStore.js');

    await expect(updateStock(undefined, () => ({ 'a::::': 1 }))).rejects.toMatchObject({
      code: 'BLOB_WRITE_UNCONFIRMED',
    });
  });
});
