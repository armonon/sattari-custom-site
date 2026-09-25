// PCM24 RIFF and uncompressed ZIP: no codec, download service or third-party dependency.
export function wavBytes(buffer, float = false) {
  const channels = buffer.numberOfChannels,
    frames = buffer.length;
  const sampleBytes = float ? 4 : 3;
  const bytes = frames * channels * sampleBytes;
  if (bytes > 0xffffffff - 36)
    throw new Error('Mix is too large for a WAV file. Export a shorter range.');
  const output = new Uint8Array(44 + bytes),
    view = new DataView(output.buffer);
  const text = (offset, value) => {
    for (let i = 0; i < value.length; i++) output[offset + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, bytes + 36, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, float ? 3 : 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * sampleBytes, true);
  view.setUint16(32, channels * sampleBytes, true);
  view.setUint16(34, sampleBytes * 8, true);
  text(36, 'data');
  view.setUint32(40, bytes, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < channels; channel++) {
      const raw = data[channel][frame];
      if (!Number.isFinite(raw))
        throw new Error('Render contains invalid audio samples. Export cancelled.');
      if (float) {
        view.setFloat32(offset, raw, true);
        offset += 4;
        continue;
      }
      const sample = Math.max(-1, Math.min(1, raw));
      const value = Math.round(sample * (sample < 0 ? 8388608 : 8388607));
      output[offset++] = value & 255;
      output[offset++] = (value >> 8) & 255;
      output[offset++] = (value >> 16) & 255;
    }
  return output;
}
export function peakOf(buffer) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++)
    for (const value of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(value));
  return peak;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  return value >>> 0;
});
function crc32(bytes) {
  let crc = -1;
  for (const value of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ value) & 255];
  return (crc ^ -1) >>> 0;
}

export function zipFiles(files) {
  const pieces = [],
    central = [];
  let offset = 0,
    centralSize = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name),
      crc = crc32(file.data),
      size = file.data.length;
    const header = new Uint8Array(30 + name.length),
      view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    pieces.push(header, file.data);
    const directory = new Uint8Array(46 + name.length),
      d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(8, 0x800, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, size, true);
    d.setUint32(24, size, true);
    d.setUint16(28, name.length, true);
    d.setUint32(42, offset, true);
    directory.set(name, 46);
    central.push(directory);
    centralSize += directory.length;
    offset += header.length + size;
  }
  if (offset + centralSize > 0xffffffff || files.length > 65535)
    throw new Error('Export exceeds ZIP limits. Export fewer tracks.');
  const end = new Uint8Array(22),
    view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);
  return new Blob([...pieces, ...central, end], { type: 'application/zip' });
}
