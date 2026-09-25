import { Blob } from 'node:buffer';
import { it, expect } from 'vitest';
import { decodeWaveWindow } from './arrangementSourceWindow';
import { wavBytes } from './arrangementExport';
const raw = {
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      numberOfChannels: channels,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (i) => data[i],
    };
  },
};
it('reads only the requested PCM source window, preserving absolute offset and samples', async () => {
  const full = raw.createBuffer(2, 48000 * 20, 48000);
  for (let c = 0; c < 2; c++)
    for (let i = 0; i < full.length; i++) full.getChannelData(c)[i] = Math.sin(i / 17) * 0.5;
  const file = new Blob([wavBytes(full)]);
  const result = await decodeWaveWindow(raw, file, 10, 10.5, 1024 * 1024);
  expect(result.offset).toBe(10);
  expect(result.buffer.length).toBe(24001);
  expect(result.buffer.getChannelData(1)[177]).toBeCloseTo(full.getChannelData(1)[480177], 6);
  await expect(decodeWaveWindow(raw, file, 0, 20, 1024)).rejects.toThrow('memory budget');
});
it('does not treat compressed or malformed data as PCM', async () => {
  expect(await decodeWaveWindow(raw, new Blob(['not a WAV']), 0, 10, 1e6)).toBeNull();
});
