// PCM WAV (including captured float WAV chunks) can be read by sample range.
// Compressed formats still require the browser's whole-file decoder.
export async function decodeWaveWindow(raw, blob, start, end, budget) {
  const header = new DataView(await blob.slice(0, 65536).arrayBuffer());
  const tag = (at) => String.fromCharCode(...new Uint8Array(header.buffer, at, 4));
  if (header.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let format, channels, rate, bits, align;
  for (let at = 12; at + 8 <= header.byteLength; ) {
    const size = header.getUint32(at + 4, true),
      type = tag(at);
    if (type === 'fmt ' && size >= 16 && at + 24 <= header.byteLength) {
      format = header.getUint16(at + 8, true);
      channels = header.getUint16(at + 10, true);
      rate = header.getUint32(at + 12, true);
      align = header.getUint16(at + 20, true);
      bits = header.getUint16(at + 22, true);
    }
    if (type === 'data') {
      if (
        ![1, 3].includes(format) ||
        ![8, 16, 24, 32].includes(bits) ||
        (format === 3 && bits !== 32) ||
        !channels ||
        channels > 32 ||
        !rate ||
        align !== (channels * bits) / 8
      )
        return null;
      const available = Math.min(size, blob.size - at - 8);
      const first = Math.max(0, Math.floor(start * rate));
      const last = Math.min(Math.floor(available / align), Math.ceil(end * rate) + 1);
      const count = last - first;
      if (count <= 0)
        throw new Error('Requested audio is outside the WAV source. Relink the original file.');
      if (count * channels * 4 > budget)
        throw new Error('Source window exceeds the audio memory budget. Use a shorter range.');
      const bytes = new DataView(
        await blob.slice(at + 8 + first * align, at + 8 + last * align).arrayBuffer()
      );
      const buffer = raw.createBuffer(channels, count, rate),
        stride = bits / 8;
      for (let channel = 0; channel < channels; channel++) {
        const pcm = buffer.getChannelData(channel);
        for (let i = 0; i < count; i++) {
          const p = i * align + channel * stride;
          pcm[i] =
            format === 3
              ? bytes.getFloat32(p, true)
              : bits === 8
                ? (bytes.getUint8(p) - 128) / 128
                : bits === 16
                  ? bytes.getInt16(p, true) / 32768
                  : bits === 32
                    ? bytes.getInt32(p, true) / 2147483648
                    : (bytes.getUint8(p) |
                        (bytes.getUint8(p + 1) << 8) |
                        (bytes.getInt8(p + 2) << 16)) /
                      8388608;
          if (!Number.isFinite(pcm[i])) throw new Error('WAV source contains invalid samples.');
        }
      }
      return { buffer, offset: first / rate };
    }
    at += 8 + size + (size % 2);
  }
  return null;
}
