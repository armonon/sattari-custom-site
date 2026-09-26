import { Blob } from 'node:buffer';
import { expect, it } from 'vitest';
import { describeAiff, decodeAiffWindow } from './aiffWindow';

function fixture(codec = 'NONE') {
  const compressed = codec !== 'NONE',
    headerBytes = compressed ? 58 : 54;
  const bytes = new Uint8Array(headerBytes + 8000 * 2),
    view = new DataView(bytes.buffer);
  const tag = (at, text) => bytes.set(new TextEncoder().encode(text), at);
  tag(0, 'FORM');
  view.setUint32(4, bytes.length - 8);
  tag(8, compressed ? 'AIFC' : 'AIFF');
  tag(12, 'COMM');
  view.setUint32(16, compressed ? 22 : 18);
  view.setUint16(20, 1);
  view.setUint32(22, 8000);
  view.setUint16(26, 16);
  view.setUint16(28, 16383 + 12);
  view.setUint32(30, (8000 / 4096) * 2 ** 31);
  if (compressed) tag(38, codec);
  const at = compressed ? 42 : 38;
  tag(at, 'SSND');
  view.setUint32(at + 4, 8000 * 2 + 8);
  for (let i = 0; i < 8000; i++)
    view.setInt16(headerBytes + i * 2, i % 2 ? -16384 : 8192, codec === 'sowt');
  const blob = new Blob([bytes]);
  blob.arrayBuffer = () => {
    throw Error('Whole-source read');
  };
  return blob;
}
const raw = {
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      length,
      numberOfChannels: channels,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (c) => data[c],
    };
  },
};
it.each(['NONE', 'sowt'])(
  'window-decodes %s AIFF without reading the whole source',
  async (codec) => {
    const blob = fixture(codec);
    expect(await describeAiff(blob)).toMatchObject({ sampleRate: 8000, channels: 1, duration: 1 });
    const result = await decodeAiffWindow(raw, blob, 0.5, 0.51, 1000);
    expect(result.offset).toBe(0.5);
    expect(result.buffer.length).toBe(81);
    expect(result.buffer.getChannelData(0)[0]).toBe(0.25);
    expect(result.buffer.getChannelData(0)[1]).toBe(-0.5);
    await expect(decodeAiffWindow(raw, blob, 0, 1, 1000)).rejects.toThrow('memory budget');
  }
);
it('rejects a truncated sound chunk before allocating audio', async () => {
  const broken = fixture().slice(0, 100);
  await expect(describeAiff(broken)).rejects.toThrow('truncated');
});
