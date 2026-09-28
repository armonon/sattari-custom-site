import { Blob } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeCompressedWindow, releaseDecodedSongs } from './compressedAudioWindow';

const state = vi.hoisted(() => ({
  disposed: vi.fn(),
  decode: true,
  visited: vi.fn(),
  duration: 7200,
}));
const make = (channels, length, sampleRate) => {
  const pcm = Array.from({ length: channels }, () => new Float32Array(length));
  return { length, numberOfChannels: channels, sampleRate, getChannelData: (i) => pcm[i] };
};
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {
    on() {}
  },
  Input: class {
    async getPrimaryAudioTrack() {
      return {
        canDecode: async () => state.decode,
        getNumberOfChannels: async () => 1,
        getSampleRate: async () => 8000,
      };
    }
    async getDurationFromMetadata() {
      return state.duration;
    }
    dispose() {
      state.disposed();
    }
  },
  AudioBufferSink: class {
    async *buffers(start, end) {
      state.visited(start, end);
      const buffer = make(1, 8000, 8000);
      buffer.getChannelData(0).fill(0.25);
      yield { buffer, timestamp: 10 };
    }
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.decode = true;
  state.duration = 7200;
  releaseDecodedSongs();
});

it('allocates only a sample-aligned requested interval from a two-hour metadata source', async () => {
  const raw = { createBuffer: vi.fn(make), decodeAudioData: vi.fn() };
  const result = await decodeCompressedWindow(raw, new Blob(['encoded']), 10.25, 10.5, 16000);
  expect(result.offset).toBe(10.25);
  expect(result.buffer.length).toBe(2001);
  expect(result.buffer.getChannelData(0)[0]).toBe(0.25);
  expect(raw.decodeAudioData).not.toHaveBeenCalled();
  expect(state.disposed).toHaveBeenCalledOnce();
});
it('rejects the PCM allocation before decoding an over-budget range', async () => {
  const raw = { createBuffer: vi.fn(make) };
  await expect(decodeCompressedWindow(raw, new Blob(['encoded']), 0, 7200, 16000)).rejects.toThrow(
    'memory budget'
  );
  expect(raw.createBuffer).not.toHaveBeenCalled();
  expect(state.visited).not.toHaveBeenCalled();
  expect(state.disposed).toHaveBeenCalledOnce();
});
it('refuses the whole-song fallback when the song would not fit its memory budget', async () => {
  state.decode = false;
  const raw = { createBuffer: vi.fn(make), decodeAudioData: vi.fn() };
  await expect(decodeCompressedWindow(raw, new Blob(['encoded']), 10, 11, 16000)).rejects.toThrow(
    'codec'
  );
  expect(raw.decodeAudioData).not.toHaveBeenCalled();
  expect(state.disposed).toHaveBeenCalledOnce();
});
it('closes resources on cancellation before reading media', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    decodeCompressedWindow({ createBuffer: make }, new Blob(['encoded']), 10, 11, 16000, {
      signal: controller.signal,
    })
  ).rejects.toThrow('cancelled');
  expect(state.disposed).toHaveBeenCalledOnce();
});

describe('browsers without WebCodecs audio (Safari before 26)', () => {
  // A decoded song at the context rate whose sample n holds n / rate.
  const song = (seconds, rate = 8000) => {
    const buffer = make(1, seconds * rate, rate);
    buffer.getChannelData(0).forEach((_, n, data) => (data[n] = n / rate));
    return buffer;
  };

  it('decodes the song once and serves each window from it', async () => {
    state.decode = false;
    state.duration = 180;
    const raw = {
      sampleRate: 8000,
      createBuffer: vi.fn(make),
      decodeAudioData: vi.fn(async () => song(180)),
    };
    const blob = new Blob(['encoded']);
    const first = await decodeCompressedWindow(raw, blob, 10, 11, 1e6, { cacheKey: 'a:7' });
    const second = await decodeCompressedWindow(raw, blob, 150, 151, 1e6, { cacheKey: 'a:7' });
    expect(raw.decodeAudioData).toHaveBeenCalledOnce();
    expect(first.offset).toBe(10);
    expect(first.buffer.getChannelData(0)[0]).toBe(10);
    expect(second.buffer.getChannelData(0)[0]).toBe(150);
    expect(second.buffer.length).toBe(8001);
    expect(state.visited).not.toHaveBeenCalled();
  });

  it('keeps windows within the caller budget', async () => {
    state.decode = false;
    state.duration = 180;
    const raw = { createBuffer: vi.fn(make), decodeAudioData: vi.fn(async () => song(180)) };
    await expect(
      decodeCompressedWindow(raw, new Blob(['encoded']), 0, 60, 1000, { cacheKey: 'b' })
    ).rejects.toThrow('memory budget');
    expect(raw.createBuffer).not.toHaveBeenCalled();
  });

  it('releases the least recently used song when the cache is full', async () => {
    state.decode = false;
    state.duration = 3000;
    // 3000 s of 8 kHz mono float PCM is 96 MB; four fit in the 384 MB cache.
    const raw = {
      sampleRate: 8000,
      createBuffer: vi.fn(make),
      decodeAudioData: vi.fn(async () => ({ ...make(1, 1, 8000), length: 3000 * 8000 })),
    };
    const open = (key) =>
      decodeCompressedWindow(raw, new Blob(['encoded']), 0, 0.001, 1e6, { cacheKey: key });
    for (const key of ['s1', 's2', 's3', 's4']) await open(key);
    await open('s1');
    await open('s5');
    expect(raw.decodeAudioData).toHaveBeenCalledTimes(5);
    await open('s1');
    expect(raw.decodeAudioData).toHaveBeenCalledTimes(5);
    await open('s2');
    expect(raw.decodeAudioData).toHaveBeenCalledTimes(6);
  });

  it('reports files the browser cannot decode at all', async () => {
    state.decode = false;
    state.duration = 60;
    const raw = {
      createBuffer: vi.fn(make),
      decodeAudioData: vi.fn(async () => {
        throw new DOMException('Unable to decode audio data', 'EncodingError');
      }),
    };
    await expect(
      decodeCompressedWindow(raw, new Blob(['encoded']), 0, 1, 1e6, { cacheKey: 'bad' })
    ).rejects.toThrow('Convert it to WAV');
    raw.decodeAudioData.mockResolvedValue(song(60));
    await expect(
      decodeCompressedWindow(raw, new Blob(['encoded']), 0, 1, 1e6, { cacheKey: 'bad' })
    ).resolves.toMatchObject({ offset: 0 });
  });
});
