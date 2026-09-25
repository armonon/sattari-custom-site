import { readBlob } from './libraryFiles';

// Browser adaptation of Bounce's ID3 reader. Never decode the audio or read a
// whole song to inspect tags. Unsupported/compressed tags retain folder metadata.
const MAX_TAG = 2 * 1024 * 1024;
const ascii = (b) => String.fromCharCode(...b);
const syncSize = (b, i) =>
  ((b[i] & 127) << 21) | ((b[i + 1] & 127) << 14) | ((b[i + 2] & 127) << 7) | (b[i + 3] & 127);
const text = (bytes) => {
  if (bytes.length < 2 || bytes[0] > 3) return '';
  const encoding =
    bytes[0] === 1 && bytes[1] === 0xfe && bytes[2] === 0xff
      ? 'utf-16be'
      : ['windows-1252', 'utf-16', 'utf-16be', 'utf-8'][bytes[0]];
  return new TextDecoder(encoding).decode(bytes.subarray(1)).split('\0')[0].trim().slice(0, 200);
};
const FIELDS = {
  TIT2: 'title',
  TT2: 'title',
  TPE1: 'artist',
  TP1: 'artist',
  TPE2: 'albumArtist',
  TP2: 'albumArtist',
  TALB: 'album',
  TAL: 'album',
  TCON: 'genre',
  TCO: 'genre',
  TRCK: 'trackNumber',
  TRK: 'trackNumber',
  TPOS: 'discNumber',
  TPA: 'discNumber',
  TYER: 'year',
  TYE: 'year',
  TDRC: 'year',
};
export function parseLibraryTags(bytes, { artwork = false } = {}) {
  if (bytes.length < 10 || ascii(bytes.subarray(0, 3)) !== 'ID3') return {};
  const major = bytes[3],
    flags = bytes[5];
  if (major < 2 || major > 4 || flags & 128 || (major === 2 && flags & 64)) return {};
  const end = Math.min(bytes.length, 10 + syncSize(bytes, 6));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    out = {};
  let pos = 10;
  if (major > 2 && flags & 64) {
    if (pos + 4 > end) return out;
    const size = major === 4 ? syncSize(bytes, pos) : view.getUint32(pos) + 4;
    if (size < 4 || pos + size > end) return out;
    pos += size;
  }
  const header = major === 2 ? 6 : 10;
  while (pos + header <= end) {
    const id = ascii(bytes.subarray(pos, pos + (major === 2 ? 3 : 4)));
    const size =
      major === 2
        ? (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
        : major === 4
          ? syncSize(bytes, pos + 4)
          : view.getUint32(pos + 4);
    if (!/^[A-Z0-9]+$/.test(id) || !size || pos + header + size > end) break;
    const payload = bytes.subarray(pos + header, pos + header + size);
    const unsupported = major === 3 ? bytes[pos + 9] & 224 : major === 4 ? bytes[pos + 9] & 79 : 0;
    pos += header + size;
    if (unsupported) continue;
    if (FIELDS[id]) {
      const value = text(payload),
        key = FIELDS[id];
      if (value)
        out[key] = ['trackNumber', 'discNumber', 'year'].includes(key)
          ? Math.max(0, parseInt(value, 10) || 0)
          : value;
    } else if (artwork && !out.artwork && (id === 'APIC' || id === 'PIC')) {
      let offset = 1,
        mime;
      if (id === 'PIC') {
        mime = ascii(payload.subarray(1, 4)).toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
        offset = 4;
      } else {
        const stop = payload.indexOf(0, offset);
        if (stop < 0 || stop > 100) continue;
        mime = ascii(payload.subarray(offset, stop)).toLowerCase();
        offset = stop + 1;
      }
      if (!['image/png', 'image/jpeg'].includes(mime)) continue;
      offset++; // picture type
      const step = payload[0] === 1 || payload[0] === 2 ? 2 : 1;
      while (
        offset + step <= payload.length &&
        !(payload[offset] === 0 && (step === 1 || payload[offset + 1] === 0))
      )
        offset += step;
      offset += step;
      if (offset < payload.length) out.artwork = new Blob([payload.slice(offset)], { type: mime });
    }
  }
  return out;
}
export async function readLibraryTags(file, options) {
  const head = new Uint8Array(await readBlob(file.slice(0, 10)));
  if (head.length < 10 || ascii(head.subarray(0, 3)) !== 'ID3') return {};
  const length = Math.min(file.size, MAX_TAG, 10 + syncSize(head, 6));
  return parseLibraryTags(new Uint8Array(await readBlob(file.slice(0, length))), options);
}
