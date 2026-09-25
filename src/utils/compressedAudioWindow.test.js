import { Blob } from 'node:buffer';
import { expect, it, vi, beforeEach } from 'vitest';
import { decodeCompressedWindow } from './compressedAudioWindow';

const state = vi.hoisted(() => ({ disposed: vi.fn(), decode: true, visited: vi.fn() }));
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
      return 7200;
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
it('does not silently fall back to whole-file decoding when a codec is unavailable', async () => {
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
