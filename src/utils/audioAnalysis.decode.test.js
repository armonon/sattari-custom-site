import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const windowed = vi.hoisted(() => ({ contexts: [] }));
vi.mock('./windowedAudioAnalysis', () => ({
  analyzeWindowedAudio: vi.fn(async (file, raw, { analyze }) => {
    windowed.contexts.push(raw);
    // Window decoders allocate PCM at the source's own rate through createBuffer.
    const buffer = raw.createBuffer(2, 2205, file.sampleRate);
    return { ...(await analyze(buffer)), sampleRate: buffer.sampleRate };
  }),
}));

import { analyzeAudioFile } from './audioAnalysis';

const created = [];
class FakeOfflineContext {
  constructor(channels, length, sampleRate) {
    Object.assign(this, { channels, length, sampleRate });
    created.push(this);
  }
  createBuffer(numberOfChannels, length, sampleRate) {
    const data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return {
      numberOfChannels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (channel) => data[channel],
    };
  }
}

beforeEach(() => {
  created.length = 0;
  windowed.contexts.length = 0;
  vi.stubGlobal('OfflineAudioContext', FakeOfflineContext);
  vi.stubGlobal(
    'AudioContext',
    vi.fn(() => {
      throw new Error('Analysis must not open the audio output device.');
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

it('decodes through an offline context, never a real-time audio device', async () => {
  const results = await Promise.all([
    analyzeAudioFile({ sampleRate: 22050 }),
    analyzeAudioFile({ sampleRate: 96000 }),
  ]);
  expect(globalThis.AudioContext).not.toHaveBeenCalled();
  expect(created).toHaveLength(2); // one per serialized job, nothing left to close
  expect(windowed.contexts).toEqual(created);
  // PCM keeps each source's rate; the context's own rate is never used for it.
  expect(results.map((result) => result.sampleRate)).toEqual([22050, 96000]);
});

it('reports missing Web Audio support clearly', async () => {
  vi.stubGlobal('OfflineAudioContext', undefined);
  await expect(analyzeAudioFile({ sampleRate: 44100 })).rejects.toThrow(
    'Web Audio is not supported'
  );
});
