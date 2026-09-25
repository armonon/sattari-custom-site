import { expect, it, vi } from 'vitest';
import { replayPlan } from './performancePlayer';
import { ReplaySourceCache, replaySourceDependencies } from './replaySources';

it('disabled source changes and disabled pad sources contribute no replay dependency', () => {
  const capture = {
    duration: 7200,
    events: [
      {
        type: 'initialState',
        time: 0,
        args: [{ decks: [{ id: 'A', lanes: { fullMix: { assetId: 'opening' } } }] }],
      },
      {
        type: 'setLaneState',
        time: 10,
        disabled: true,
        args: ['A', 'fullMix', { assetId: 'missing' }],
      },
      { type: 'padSource', time: 15, disabled: true, args: [0, { assetId: 'bad-pad' }] },
      { type: 'setLaneState', time: 20, args: ['A', 'fullMix', { assetId: 'next' }] },
    ],
  };
  expect(replaySourceDependencies(replayPlan(capture))).toEqual(['opening', 'next']);
  capture.events[1].disabled = false;
  expect(replaySourceDependencies(replayPlan(capture))).toContain('missing');
});

it('simulates 120 sequential song replacements with bounded retained PCM and no up-front library decode', async () => {
  const load = vi.fn(async () => ({ blob: new Blob([new Uint8Array(8)]) }));
  const decodeAudioData = vi.fn(async () => ({ length: 1000, numberOfChannels: 2 }));
  const cache = new ReplaySourceCache({ decodeAudioData }, load, { budget: 16000 });
  await cache.prepare(['song-0']);
  expect(load).toHaveBeenCalledTimes(1);
  for (let minute = 1; minute < 120; minute++) {
    await cache.prepare([`song-${minute - 1}`, `song-${minute}`]);
    expect(cache.bytes).toBeLessThanOrEqual(16000);
    expect(cache.buffers.size).toBeLessThanOrEqual(2);
  }
  expect(load).toHaveBeenCalledTimes(120);
  expect(cache.buffers.has('song-0')).toBe(false);
  cache.dispose();
  expect(cache.bytes).toBe(0);
});

it('rejects a known oversized source before invoking the allocating decoder', async () => {
  const raw = { sampleRate: 48000, decodeAudioData: vi.fn() };
  const cache = new ReplaySourceCache(raw, async () => ({ blob: new Blob(['compressed']) }), {
    budget: 1024,
    durations: new Map([['long', 7200]]),
  });
  await expect(cache.prepare(['long'])).rejects.toThrow('PCM budget');
  expect(raw.decodeAudioData).not.toHaveBeenCalled();
});

it('does not resurrect buffers after disposal during decoding', async () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };
  const gate = deferred();
  const entered = deferred();
  const cache = new ReplaySourceCache(
    {
      decodeAudioData: () => {
        entered.resolve();
        return gate.promise;
      },
    },
    async () => ({ blob: new Blob(['audio']) })
  );
  const pending = cache.prepare(['a']);
  await entered.promise;
  cache.dispose();
  gate.resolve({ length: 100, numberOfChannels: 2 });
  await pending;
  expect(cache.buffers.size).toBe(0);
});
