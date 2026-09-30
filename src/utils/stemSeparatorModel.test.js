// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadSeparationModel, MODEL_BYTES, MODEL_SHA256, MODEL_URL } from './stemSeparatorModel';

const hash = Uint8Array.from(MODEL_SHA256.match(/../g), (value) => parseInt(value, 16));
const response = (size = MODEL_BYTES) => new Response(new Uint8Array(size));
let cache;
beforeEach(() => {
  cache = { match: vi.fn(), put: vi.fn(), delete: vi.fn(async () => true) };
  vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
  vi.stubGlobal('crypto', { subtle: { digest: vi.fn(async () => hash.buffer) } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response())
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('verifies and reuses a cached model without networking', async () => {
  cache.match.mockResolvedValue(response());
  expect((await loadSeparationModel()).byteLength).toBe(MODEL_BYTES);
  expect(crypto.subtle.digest).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it('recovers from a cache read failure and a failed optional cache write', async () => {
  cache.match.mockRejectedValue(new Error('Cache unavailable'));
  cache.put.mockRejectedValue(new Error('Quota exceeded'));
  expect((await loadSeparationModel()).byteLength).toBe(MODEL_BYTES);
  expect(fetch).toHaveBeenCalledOnce();
});

it('replaces a truncated cached model in the same attempt', async () => {
  cache.match.mockResolvedValue(response(8));
  expect((await loadSeparationModel()).byteLength).toBe(MODEL_BYTES);
  expect(cache.delete).toHaveBeenCalledWith(MODEL_URL);
  expect(cache.put).toHaveBeenCalledOnce();
});

it('rejects a bad network checksum and never caches unverified data', async () => {
  crypto.subtle.digest.mockResolvedValue(new Uint8Array(32).buffer);
  await expect(loadSeparationModel()).rejects.toThrow('Model verification failed');
  expect(cache.put).not.toHaveBeenCalled();
});

it('rejects incomplete and HTTP error responses', async () => {
  fetch.mockResolvedValueOnce(response(8));
  await expect(loadSeparationModel()).rejects.toThrow('incomplete');
  fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(loadSeparationModel()).rejects.toThrow('503');
});

it('settles a stalled download so the user can retry or cancel the batch', async () => {
  vi.useFakeTimers();
  fetch.mockImplementation(
    (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
  );
  const result = expect(loadSeparationModel()).rejects.toThrow('download stalled');
  await vi.advanceTimersByTimeAsync(45000);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});
