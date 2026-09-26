import { it, expect, vi } from 'vitest';
import { analyzeWindowedAudio } from './windowedAudioAnalysis';
import { analyzeDecodedAudio } from './audioAnalysis';

const makeBuffer = (channels, length, sampleRate) => {
  const samples = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    length,
    sampleRate,
    numberOfChannels: channels,
    duration: length / sampleRate,
    getChannelData: (c) => samples[c],
  };
};
it('scans every sample of a long source with bounded windows and compact analysis blocks', async () => {
  const rate = 1000,
    duration = 300;
  const describe = async () => ({ sampleRate: rate, channels: 2, duration });
  const decode = vi.fn(async (_raw, _file, from, to) => {
    const buffer = makeBuffer(2, Math.round((to - from) * rate), rate);
    buffer.getChannelData(0).fill(0.5);
    buffer.getChannelData(1).fill(0.5);
    return { buffer, offset: from };
  });
  const analyze = vi.fn((buffer) => ({
    bpm: 120,
    key: 'C major',
    tonic: 'C',
    mode: 'major',
    chords: ['C', 'C', 'C', 'C'],
    confidence: { tempo: 0.9, key: 0.8 },
    tempoMap: {
      confidence: 0.9,
      beats: Array.from({ length: Math.floor(buffer.duration * 2) }, (_, i) => ({ time: i / 2 })),
    },
  }));
  const result = await analyzeWindowedAudio({}, {}, { describe, decode, analyze });
  expect(decode).toHaveBeenCalledTimes(75);
  expect(decode.mock.calls.every((call) => call[3] - call[2] <= 4)).toBe(true);
  expect(analyze.mock.calls.every(([buffer]) => buffer.duration <= 124)).toBe(true);
  expect(result.analysisCoverage).toMatchObject({ seconds: 300, wholeSourceDecoded: false });
  expect(result.level).toEqual({ rmsDb: -6, peakDb: -6 });
  expect(result.tempoMap.beats.at(-1).time).toBeGreaterThan(298);
  expect(result.tempoMap.beats.every((beat, i, beats) => !i || beat.time > beats[i - 1].time)).toBe(
    true
  );
  expect(result.waveform).toHaveLength(96);
});
it('preserves full-track waveform and level statistics on a short source', async () => {
  const buffer = makeBuffer(2, 8000 * 5, 8000);
  for (let i = 0; i < buffer.length; i++)
    for (let c = 0; c < 2; c++) buffer.getChannelData(c)[i] = Math.sin(i * 0.1) * 0.4;
  const expected = analyzeDecodedAudio(buffer);
  const actual = await analyzeWindowedAudio(
    {},
    {},
    {
      describe: async () => ({ sampleRate: 8000, channels: 2, duration: 5 }),
      decode: async (_raw, _file, from, to) => {
        const part = makeBuffer(2, Math.round((to - from) * 8000), 8000);
        for (let c = 0; c < 2; c++)
          part.getChannelData(c).set(buffer.getChannelData(c).subarray(from * 8000, to * 8000));
        return { buffer: part, offset: from };
      },
    }
  );
  expect(actual.waveform).toEqual(expected.waveform);
  expect(actual.level).toEqual(expected.level);
  expect(actual.bpm).toBe(expected.bpm);
  expect(actual.key).toBe(expected.key);
});
