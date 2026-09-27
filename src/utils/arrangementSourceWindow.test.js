import { Blob } from 'node:buffer';
import { it, expect } from 'vitest';
import { decodeWaveWindow, sourceWindows } from './arrangementSourceWindow';
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
it('does not decode the hours between simultaneous clips from distant source positions', () => {
  const ranges = sourceWindows(
    [
      { id: 'a', start: 0, offset: 2, duration: 2, rate: 1 },
      { id: 'b', start: 0, offset: 6000, duration: 2, rate: 1 },
      { id: 'c', start: 0, offset: 3, duration: 2, rate: 1 },
    ],
    { start: 0, end: 2 }
  );
  expect(ranges).toEqual([
    { start: 2, end: 5, clips: ['a', 'c'] },
    { start: 6000, end: 6002, clips: ['b'] },
  ]);
});

// The pre-typed-array decoder, kept verbatim as the bit-exactness oracle.
function dataViewOracle(bytes, format, bits, channels, count) {
  const view = new DataView(bytes),
    stride = bits / 8,
    align = channels * stride;
  return Array.from({ length: channels }, (_, channel) => {
    const pcm = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = i * align + channel * stride;
      pcm[i] =
        format === 3
          ? view.getFloat32(p, true)
          : bits === 8
            ? (view.getUint8(p) - 128) / 128
            : bits === 16
              ? view.getInt16(p, true) / 32768
              : bits === 32
                ? view.getInt32(p, true) / 2147483648
                : (view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getInt8(p + 2) << 16)) /
                  8388608;
    }
    return pcm;
  });
}
function wav(format, bits, channels, rate, frames, fill) {
  const align = (channels * bits) / 8,
    bytes = new Uint8Array(44 + frames * align),
    view = new DataView(bytes.buffer);
  const text = (at, value) => [...value].forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * align, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * align, true);
  view.setUint16(32, align, true);
  view.setUint16(34, bits, true);
  text(36, 'data');
  view.setUint32(40, frames * align, true);
  fill(new DataView(bytes.buffer, 44), frames * channels);
  return bytes;
}
it.each([
  [1, 8, 1],
  [1, 16, 2],
  [1, 24, 3],
  [1, 32, 2],
  [3, 32, 6],
])('converts format %i / %i-bit / %i-channel PCM bit-exactly', async (format, bits, channels) => {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const extremes = { 8: [0, 255, 128], 16: [-32768, 32767, 0], 24: [-8388608, 8388607, 0] };
  const bytes = wav(format, bits, channels, 44100, 3000, (view, samples) => {
    for (let i = 0; i < samples; i++) {
      const pick = extremes[bits]?.[i % 97] ?? null;
      if (format === 3) view.setFloat32(i * 4, (random() * 2 - 1) * (i % 5 ? 1 : 1e-30), true);
      else if (bits === 8) view.setUint8(i, pick ?? Math.floor(random() * 256));
      else if (bits === 16)
        view.setInt16(i * 2, pick ?? Math.floor(random() * 65536) - 32768, true);
      else if (bits === 32) view.setInt32(i * 4, Math.floor(random() * 2 ** 32) - 2 ** 31, true);
      else {
        const value = pick ?? Math.floor(random() * 2 ** 24) - 2 ** 23;
        view.setUint8(i * 3, value & 255);
        view.setUint8(i * 3 + 1, (value >> 8) & 255);
        view.setInt8(i * 3 + 2, value >> 16);
      }
    }
  });
  // An unaligned source window: the slice begins mid-file, at an odd frame.
  const result = await decodeWaveWindow(raw, new Blob([bytes]), 0.0113, 0.0521, 1e9);
  const first = Math.floor(0.0113 * 44100),
    count = result.buffer.length,
    align = (channels * bits) / 8;
  expect(result.offset).toBe(first / 44100);
  const oracle = dataViewOracle(
    bytes.slice(44 + first * align, 44 + (first + count) * align).buffer,
    format,
    bits,
    channels,
    count
  );
  for (let c = 0; c < channels; c++) {
    const pcm = result.buffer.getChannelData(c);
    expect(pcm.length).toBe(oracle[c].length);
    expect(pcm.every((value, i) => Object.is(value, oracle[c][i]))).toBe(true);
  }
});
it('rejects non-finite float samples like the previous decoder', async () => {
  const bytes = wav(3, 32, 2, 48000, 100, (view, samples) => {
    for (let i = 0; i < samples; i++) view.setFloat32(i * 4, i === 131 ? Infinity : 0.25, true);
  });
  await expect(decodeWaveWindow(raw, new Blob([bytes]), 0, 1, 1e9)).rejects.toThrow(
    'invalid samples'
  );
  await expect(decodeWaveWindow(raw, new Blob([bytes]), 0, 0.001, 1e9)).resolves.toBeTruthy();
});
