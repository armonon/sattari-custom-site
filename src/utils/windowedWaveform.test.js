import { expect, it, vi } from 'vitest';
import { createWaveformPeaks } from './audioAnalysis';
import { windowedWaveformPeaks } from './windowedAudioAnalysis';
import { sourceDuration } from './windowedSource';

// A 10 s test signal at 1 kHz, read back in exact, non-overlapping windows.
const rate = 1000;
const signal = Float32Array.from({ length: 10 * rate }, (_, n) => Math.sin(n / 7) * (n / 10000));
const decode = vi.fn(async (raw, file, start, end) => {
  const first = Math.round(start * rate),
    last = Math.round(end * rate);
  const data = signal.subarray(first, last);
  return {
    offset: first / rate,
    buffer: { sampleRate: rate, length: data.length, getChannelData: () => data },
  };
});

it('draws the same waveform as a whole decode, reading 3-second windows', async () => {
  const peaks = await windowedWaveformPeaks(
    new Blob(),
    {},
    {
      duration: 10,
      binCount: 16,
      windowSeconds: 3,
      decode,
    }
  );
  expect(peaks).toEqual(createWaveformPeaks(signal, 16));
  expect(decode).toHaveBeenCalledTimes(4);
  expect(Math.max(...decode.mock.calls.map(([, , start, end]) => end - start))).toBe(3);
});

it('passes the decode cache key through and refuses an unknown length', async () => {
  decode.mockClear();
  await windowedWaveformPeaks(new Blob(), {}, { duration: 1, decode, cacheKey: 'take:9' });
  expect(decode.mock.calls[0][5]).toMatchObject({ cacheKey: 'take:9' });
  await expect(windowedWaveformPeaks(new Blob(), {}, { duration: 0, decode })).rejects.toThrow(
    'length is unknown'
  );
});

it("reads a take's length from its container, else from one cached whole decode", async () => {
  const readable = { describe: async () => ({ duration: 12 }), decodeWhole: vi.fn() };
  expect(await sourceDuration({}, new Blob(), 'a:1', readable)).toBe(12);
  expect(readable.decodeWhole).not.toHaveBeenCalled();
  const noWebCodecs = {
    describe: async () => {
      throw new Error('This audio format cannot be streamed in this browser. Use PCM WAV.');
    },
    decodeWhole: vi.fn(async () => 42),
  };
  expect(await sourceDuration({}, new Blob(), 'b:1', noWebCodecs)).toBe(42);
  expect(noWebCodecs.decodeWhole).toHaveBeenCalledWith({}, expect.any(Blob), 'b:1');
  const unreadable = {
    ...noWebCodecs,
    decodeWhole: async () => {
      throw new Error('EncodingError');
    },
  };
  await expect(sourceDuration({}, new Blob(), 'c:1', unreadable)).rejects.toThrow(
    'cannot be streamed'
  );
});
