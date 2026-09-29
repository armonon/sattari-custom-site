import { deferred } from '../test/deferred';
import { expect, it, vi } from 'vitest';
import { SourceWindowPool } from './windowedSource';

const source = (duration = 7200) => ({
  kind: 'windowed-audio',
  blob: {},
  duration,
  sampleRate: 8000,
  channels: 2,
});
const raw = {
  createBuffer: (channels, length, sampleRate) => {
    const pcm = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      sampleRate,
      duration: length / sampleRate,
      numberOfChannels: channels,
      getChannelData: (c) => pcm[c],
    };
  },
};
const decode = vi.fn(async (_raw, _blob, start, end) => {
  const buffer = raw.createBuffer(2, Math.ceil((end - start) * 8000) + 1, 8000);
  for (let c = 0; c < 2; c++)
    for (let n = 0; n < buffer.length; n++) buffer.getChannelData(c)[n] = start + n / 8000;
  return { buffer, offset: start };
});
it('pages a simulated two-hour eight-source set with admission and eviction, never whole sources', async () => {
  const pool = new SourceWindowPool(raw, { budget: 12 * 1048576, decode });
  const songs = Array.from({ length: 8 }, () => source());
  for (let second = 0; second < 7200; second += 120) {
    for (const song of songs) await pool.prepare(song, second);
    expect(pool.bytes + pool.reserved).toBeLessThanOrEqual(pool.budget);
    for (const song of songs) {
      const grain = pool.acquire(song, second + 0.1, 0.2);
      expect(grain).toBeTruthy();
      grain.release();
    }
  }
  expect(pool.peakBytes).toBeLessThanOrEqual(pool.budget);
  expect(decode.mock.calls.every((call) => call[3] - call[2] <= 6)).toBe(true);
  pool.dispose();
  expect(pool.bytes).toBe(0);
});
it('keeps sounding pages pinned and refuses before allocating past the combined decode budget', async () => {
  const pool = new SourceWindowPool(raw, { budget: 400000, decode });
  const song = source();
  await pool.page(song, 0);
  const grain = pool.acquire(song, 1, 0.1);
  const before = decode.mock.calls.length;
  await expect(pool.page(song, 4)).rejects.toThrow('Too many sources');
  expect(decode.mock.calls.length).toBe(before);
  grain.release();
  await pool.page(song, 4);
  expect(pool.acquire(song, 1, 0.1)).toBeNull();
});
it('joins large loop boundaries without decoding the span between the loop ends', async () => {
  const pool = new SourceWindowPool(raw, { decode });
  const song = source();
  await pool.prepare(song, 5999.9, { loop: true, loopStart: 10, loopEnd: 6000 });
  const grain = pool.acquire(song, 5999.9, 0.2, { loop: true, loopStart: 10, loopEnd: 6000 });
  expect(grain.loop).toBe(false);
  const pcm = grain.buffer.getChannelData(0);
  expect(pcm[0]).toBeCloseTo(5999.9, 2);
  expect(pcm[800]).toBeCloseTo(10, 3);
  const reserved = pool.reserved;
  expect(reserved).toBeGreaterThan(0);
  grain.release();
  expect(pool.reserved).toBe(0);
});
it('does not retain a decode completed after disposal', async () => {
  const pending = deferred();
  const pool = new SourceWindowPool(raw, { decode: () => pending.promise });
  const job = pool.page(source(), 0);
  pool.dispose();
  pending.resolve({ buffer: raw.createBuffer(2, 48000, 8000), offset: 0 });
  await expect(job).rejects.toThrow('cancelled');
  expect(pool.bytes).toBe(0);
  expect(pool.reserved).toBe(0);
});

it('does not enqueue remaining read-ahead pages after a seek supersedes the read', async () => {
  const pending = deferred();
  let current = true;
  const read = vi.fn(() => pending.promise);
  const pool = new SourceWindowPool(raw, { decode: read });
  const job = pool.prepare(source(), 1, {}, () => current);
  await Promise.resolve();
  expect(read).toHaveBeenCalledOnce();
  current = false;
  pending.resolve({ buffer: raw.createBuffer(2, 48001, 8000), offset: 0 });
  await job;
  expect(read).toHaveBeenCalledOnce();
  expect(pool.pending.size).toBe(0);
  pool.dispose();
});

it('warms a scheduled launch without decoding its speculative tail, then fills normal read-ahead', async () => {
  const read = vi.fn((...args) => decode(...args));
  const pool = new SourceWindowPool(raw, { decode: read });
  const song = source();
  await pool.prepare(song, 40, { prepareSeconds: 1 });
  expect(read.mock.calls.map((call) => call[2])).toEqual([40]);
  const grain = pool.acquire(song, 40, 0.12);
  expect(grain).toBeTruthy();
  grain.release();
  await pool.prepare(song, 40);
  expect(read.mock.calls.map((call) => call[2])).toEqual([40, 44]);
  pool.dispose();
});

it('decodes audible read-ahead before queued cold destinations without parallel allocations', async () => {
  const first = deferred();
  const started = [];
  const pool = new SourceWindowPool(raw, {
    decode: async (...args) => {
      started.push(args[2]);
      if (args[2] === 0) await first.promise;
      return decode(...args);
    },
  });
  const song = source();
  const initial = pool.page(song, 0);
  const cold = pool.page(song, 30);
  const audible = pool.page(song, 2, { priority: 1 });
  expect(started).toEqual([0]);
  first.resolve();
  await Promise.all([initial, cold, audible]);
  expect(started).toEqual([0, 8, 120]);
  expect(pool.reserved).toBe(0);
  expect(pool.peakBytes).toBeLessThanOrEqual(pool.budget);
  pool.dispose();
});

it('skips obsolete reads still in the decode queue', async () => {
  const first = deferred();
  const read = vi.fn(async (...args) => {
    if (args[2] === 0) await first.promise;
    return decode(...args);
  });
  const pool = new SourceWindowPool(raw, { decode: read });
  const song = source();
  const initial = pool.page(song, 0);
  let current = true;
  const obsolete = pool.prepare(song, 150, { priority: 1 }, () => current);
  current = false;
  first.resolve();
  await Promise.all([initial, obsolete]);
  expect(read).toHaveBeenCalledOnce();
  expect(pool.pending.size).toBe(0);
  pool.dispose();
});

it('promotes a shared page and retains it when a newer reader still needs it', async () => {
  const first = deferred();
  const started = [];
  const pool = new SourceWindowPool(raw, {
    decode: async (...args) => {
      started.push(args[2]);
      if (args[2] === 0) await first.promise;
      return decode(...args);
    },
  });
  const song = source();
  const initial = pool.page(song, 0);
  const cold = pool.page(song, 40);
  let oldCurrent = true;
  const old = pool.page(song, 2, { isCurrent: () => oldCurrent });
  oldCurrent = false;
  const active = pool.page(song, 2, { priority: 1 });
  first.resolve();
  const [, , oldPage, activePage] = await Promise.all([initial, cold, old, active]);
  expect(started).toEqual([0, 8, 160]);
  expect(oldPage).toBe(activePage);
  expect(pool.pending.size).toBe(0);
  pool.dispose();
});
