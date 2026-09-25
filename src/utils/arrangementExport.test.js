import { expect, it } from 'vitest';
import { peakOf, wavBytes, zipFiles } from './arrangementExport';
import { blobToDataUrl } from './audioProjectStore';
function buffer(values = [0, 0.5, -1]) {
  return {
    numberOfChannels: 2,
    length: values.length,
    sampleRate: 48000,
    getChannelData: () => Float32Array.from(values),
  };
}
it('encodes a stereo 48kHz 24-bit WAV with correct RIFF sizes and signed samples', () => {
  const bytes = wavBytes(buffer()),
    view = new DataView(bytes.buffer);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
  expect(view.getUint16(22, true)).toBe(2);
  expect(view.getUint32(24, true)).toBe(48000);
  expect(view.getUint16(34, true)).toBe(24);
  expect(view.getUint32(40, true)).toBe(18);
  expect(bytes.length).toBe(62);
  expect([...bytes.slice(56, 59)]).toEqual([0, 0, 128]);
  expect(peakOf(buffer())).toBe(1);
});
it('refuses non-finite render samples instead of producing a damaged file', () => {
  expect(() => wavBytes(buffer([NaN]))).toThrow('invalid audio');
});
it('creates a ZIP with complete central directory and CRC for each named WAV', async () => {
  const archive = zipFiles([{ name: '01-track.wav', data: wavBytes(buffer()) }]);
  const url = await blobToDataUrl(archive);
  const bytes = Uint8Array.from(atob(url.split(',')[1]), (char) => char.charCodeAt(0)),
    view = new DataView(bytes.buffer);
  expect(view.getUint32(0, true)).toBe(0x04034b50);
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect(view.getUint16(bytes.length - 12, true)).toBe(1);
  const directory = view.getUint32(bytes.length - 6, true);
  expect(view.getUint32(directory, true)).toBe(0x02014b50);
  expect(view.getUint32(14, true)).toBe(view.getUint32(directory + 16, true));
});
