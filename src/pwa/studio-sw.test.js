import { setImmediate } from 'node:timers';
// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

function worker(cache, fetch) {
  const handlers = new Map();
  const scope = {
    URL,
    Response,
    fetch,
    caches: { open: async () => cache },
    self: {
      registration: { scope: 'https://sattarimusic.com/studio' },
      location: { origin: 'https://sattarimusic.com' },
      addEventListener: (name, fn) => handlers.set(name, fn),
    },
  };
  vm.runInNewContext(readFileSync(new URL('./studio-sw.js', import.meta.url), 'utf8'), scope);
  const dispatch = () => {
    const waits = [];
    let response;
    handlers.get('fetch')({
      request: { method: 'GET', url: 'https://thecreatingco.com/suite/v1/suite.js' },
      waitUntil: (promise) => waits.push(promise),
      respondWith: (promise) => {
        response = promise;
      },
    });
    return { waits, response };
  };
  return dispatch;
}

describe('shared suite service-worker refresh', () => {
  it('retains the refresh before returning a cached response, and waits for cache replacement', async () => {
    const cached = new Response('old');
    let finishFetch;
    let finishPut;
    let stored;
    const cache = {
      match: async () => cached,
      put: async (_request, response) => {
        stored = await response.text();
        await new Promise((resolve) => {
          finishPut = resolve;
        });
      },
    };
    let options;
    const dispatch = worker(cache, (_request, opts) => {
      options = opts;
      return new Promise((resolve) => {
        finishFetch = resolve;
      });
    });
    const event = dispatch();
    expect(event.waits).toHaveLength(1);
    expect(options.cache).toBe('no-cache');
    expect(await (await event.response).text()).toBe('old');
    let settled = false;
    event.waits[0].then(() => {
      settled = true;
    });
    finishFetch(new Response('fresh'));
    await new Promise((resolve) => setImmediate(resolve));
    expect(stored).toBe('fresh');
    expect(settled).toBe(false);
    finishPut();
    await event.waits[0];
    expect(settled).toBe(true);
  });
  it('keeps the offline cached copy when refresh fails', async () => {
    const dispatch = worker({ match: async () => new Response('offline copy') }, async () => {
      throw new Error('offline');
    });
    const event = dispatch();
    expect(await (await event.response).text()).toBe('offline copy');
    await Promise.all(event.waits);
  });
  it('returns a successful network response even if cache storage is full', async () => {
    const dispatch = worker(
      {
        match: async () => undefined,
        put: async () => {
          throw new Error('quota');
        },
      },
      async () => new Response('fresh')
    );
    const event = dispatch();
    expect(await (await event.response).text()).toBe('fresh');
    await Promise.all(event.waits);
  });
});
