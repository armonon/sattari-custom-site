// Rebase MP3 packet timestamps onto the gapless timeline used by decodeAudioData.
// LAME/Lavc/Lavf store encoder delay and padding in the Xing extension. Layer III
// decoding adds 529 priming samples (also used by FFmpeg's MP3 demuxer).
// Read only a bounded header; large ID3 artwork is skipped, never materialized.
export async function mp3Gapless(blob) {
  const read = async (offset, size) =>
    new Uint8Array(await blob.slice(offset, offset + size).arrayBuffer());
  const text = (bytes, offset, size) =>
    String.fromCharCode(...bytes.subarray(offset, offset + size));
  const header = await read(0, 10);
  let offset = 0;
  if (text(header, 0, 3) === 'ID3' && header.length === 10) {
    if ([...header.subarray(6, 10)].some((value) => value & 128)) return null;
    offset = 10 + header.subarray(6, 10).reduce((size, value) => size * 128 + value, 0);
    if (header[3] === 4 && header[5] & 16) offset += 10;
  }
  const bytes = await read(offset, 4096);
  for (let at = 0; at + 40 < bytes.length; at++) {
    const version = (bytes[at + 1] >> 3) & 3;
    if (bytes[at] !== 255 || (bytes[at + 1] & 0xe6) !== 0xe2 || version === 1) continue;
    const bitrate = bytes[at + 2] >> 4;
    const rateIndex = (bytes[at + 2] >> 2) & 3;
    if (!bitrate || bitrate === 15 || rateIndex === 3) continue;
    const mono = bytes[at + 3] >> 6 === 3;
    const xing = at + 4 + (version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17);
    if (!['Xing', 'Info'].includes(text(bytes, xing, 4)) || xing + 8 > bytes.length) continue;
    const flags = new DataView(bytes.buffer).getUint32(xing + 4);
    if (flags & ~15) return null;
    let tag = xing + 8;
    for (const [flag, size] of [
      [1, 4],
      [2, 4],
      [4, 100],
      [8, 4],
    ])
      if (flags & flag) tag += size;
    if (tag + 24 > bytes.length || !['LAME', 'Lavc', 'Lavf'].includes(text(bytes, tag, 4)))
      return null;
    const delay = (bytes[tag + 21] << 4) | (bytes[tag + 22] >> 4);
    const padding = ((bytes[tag + 22] & 15) << 8) | bytes[tag + 23];
    return { startFrames: delay + 529, trimFrames: delay + padding };
  }
  return null;
}
