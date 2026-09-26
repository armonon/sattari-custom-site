const descriptions = new WeakMap();
const tag = (view, at) =>
  String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + at, 4));
export function describeAiff(blob) {
  if (!descriptions.has(blob)) descriptions.set(blob, readDescription(blob));
  return descriptions.get(blob);
}
async function readDescription(blob) {
  const header = new DataView(await blob.slice(0, 12).arrayBuffer());
  if (
    header.byteLength < 12 ||
    tag(header, 0) !== 'FORM' ||
    !['AIFF', 'AIFC'].includes(tag(header, 8))
  )
    return null;
  const compressed = tag(header, 8) === 'AIFC';
  const end = Math.min(blob.size, header.getUint32(4) + 8);
  let format, sound;
  for (let at = 12, chunks = 0; at + 8 <= end; chunks++) {
    if (chunks >= 4096)
      throw new Error('AIFF has too many metadata chunks. Convert it to PCM WAV.');
    const chunk = new DataView(await blob.slice(at, at + 8).arrayBuffer());
    const size = chunk.getUint32(4),
      type = tag(chunk, 0);
    if (at + 8 + size > end) throw new Error('AIFF source is truncated. Relink the original file.');
    if (type === 'COMM') {
      if (size < (compressed ? 22 : 18)) throw new Error('Invalid AIFF format chunk.');
      const data = new DataView(
        await blob.slice(at + 8, at + 8 + Math.min(size, 22)).arrayBuffer()
      );
      const exponent = data.getUint16(8);
      const rate =
        ((data.getUint32(10) * 2 ** 32 + data.getUint32(14)) / 2 ** 63) *
        2 ** ((exponent & 0x7fff) - 16383);
      const codec = compressed ? tag(data, 18) : 'NONE';
      const channels = data.getUint16(0),
        frames = data.getUint32(2),
        bits = data.getUint16(6);
      const floating = ['fl32', 'FL32', 'fl64', 'FL64'].includes(codec);
      if (
        exponent & 0x8000 ||
        !Number.isFinite(rate) ||
        Math.abs(rate - Math.round(rate)) > 0.001 ||
        rate < 8000 ||
        rate > 384000 ||
        channels < 1 ||
        channels > 32 ||
        !frames ||
        !['NONE', 'twos', 'sowt', 'fl32', 'FL32', 'fl64', 'FL64'].includes(codec) ||
        !(floating ? [32, 64] : [8, 16, 24, 32]).includes(bits)
      )
        throw new Error('Unsupported AIFF encoding. Convert the source to PCM WAV.');
      if ((/32$/i.test(codec) && bits !== 32) || (/64$/i.test(codec) && bits !== 64))
        throw new Error('Invalid AIFF floating-point format.');
      format = {
        channels,
        frames,
        bits,
        sampleRate: Math.round(rate),
        floating,
        little: codec === 'sowt',
      };
    }
    if (type === 'SSND') {
      if (size < 8) throw new Error('Invalid AIFF sound chunk.');
      const data = new DataView(await blob.slice(at + 8, at + 16).arrayBuffer());
      const offset = data.getUint32(0);
      if (offset > size - 8) throw new Error('Invalid AIFF audio offset.');
      sound = { dataOffset: at + 16 + offset, dataBytes: size - 8 - offset };
    }
    at += 8 + size + (size % 2);
    if (format && sound) break;
  }
  if (!format || !sound || (format.frames * format.channels * format.bits) / 8 > sound.dataBytes)
    throw new Error('AIFF source has missing or incomplete audio.');
  return { ...format, ...sound, duration: format.frames / format.sampleRate };
}
export async function decodeAiffWindow(raw, blob, start, end, budget) {
  const info = await describeAiff(blob);
  if (!info) return null;
  const { sampleRate, channels, bits, floating, little } = info;
  const first = Math.max(0, Math.floor(start * sampleRate));
  const last = Math.min(info.frames, Math.ceil(end * sampleRate) + 1);
  const length = last - first;
  if (length <= 0) throw new Error('Requested audio is outside the AIFF source.');
  if (length * channels * 4 > budget)
    throw new Error('Source window exceeds the audio memory budget.');
  const stride = bits / 8,
    align = channels * stride;
  const bytes = new DataView(
    await blob.slice(info.dataOffset + first * align, info.dataOffset + last * align).arrayBuffer()
  );
  const buffer = raw.createBuffer(channels, length, sampleRate);
  for (let c = 0; c < channels; c++) {
    const pcm = buffer.getChannelData(c);
    for (let n = 0; n < length; n++) {
      const at = n * align + c * stride;
      let value;
      if (floating)
        value = bits === 32 ? bytes.getFloat32(at, little) : bytes.getFloat64(at, little);
      else if (bits === 8) value = bytes.getInt8(at) / 128;
      else if (bits === 16) value = bytes.getInt16(at, little) / 32768;
      else if (bits === 32) value = bytes.getInt32(at, little) / 2147483648;
      else {
        const integer = little
          ? bytes.getUint8(at) | (bytes.getUint8(at + 1) << 8) | (bytes.getInt8(at + 2) << 16)
          : (bytes.getInt8(at) << 16) | (bytes.getUint8(at + 1) << 8) | bytes.getUint8(at + 2);
        value = integer / 8388608;
      }
      if (!Number.isFinite(value)) throw new Error('AIFF source contains invalid samples.');
      pcm[n] = value;
    }
  }
  return { buffer, offset: first / sampleRate };
}
