// File-backed export. Only one PCM section and a small ZIP directory live in JS memory.
const cleanup = new WeakMap();
const MEMORY_FALLBACK = 128 * 1024 * 1024;
const DIRECTORY = 'stemdeck-generated-exports-v1';
const encoder = new TextEncoder();
const text = (bytes, offset, value) => bytes.set(encoder.encode(value), offset);
export const exportFrames = (duration, rate = 48000) => Math.round((duration + 0.1) * rate);

export function wavHeader(frames, rate = 48000, channels = 2) {
  const size = frames * channels * 3,
    large = size > 0xffffffff - 36;
  const bytes = new Uint8Array(large ? 80 : 44),
    view = new DataView(bytes.buffer);
  text(bytes, 0, large ? 'RF64' : 'RIFF');
  view.setUint32(4, large ? 0xffffffff : size + 36, true);
  text(bytes, 8, 'WAVE');
  let at = 12;
  if (large) {
    text(bytes, at, 'ds64');
    view.setUint32(16, 28, true);
    view.setBigUint64(20, BigInt(size + 72), true);
    view.setBigUint64(28, BigInt(size), true);
    view.setBigUint64(36, BigInt(frames), true);
    at = 48;
  }
  text(bytes, at, 'fmt ');
  view.setUint32(at + 4, 16, true);
  view.setUint16(at + 8, 1, true);
  view.setUint16(at + 10, channels, true);
  view.setUint32(at + 12, rate, true);
  view.setUint32(at + 16, rate * channels * 3, true);
  view.setUint16(at + 20, channels * 3, true);
  view.setUint16(at + 22, 24, true);
  text(bytes, at + 24, 'data');
  view.setUint32(at + 28, large ? 0xffffffff : size, true);
  return bytes;
}

const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ (0xedb88320 & -(n & 1));
  return n >>> 0;
});
export function updateCrc(crc, bytes) {
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return crc >>> 0;
}
export function pcm24(channels, crc = 0xffffffff) {
  const length = channels[0]?.length || 0;
  if (channels.some((channel) => channel.length !== length))
    throw new Error('Unaligned PCM channels.');
  const bytes = new Uint8Array(length * channels.length * 3);
  let offset = 0;
  for (let frame = 0; frame < length; frame++)
    for (const channel of channels) {
      const sample = channel[frame];
      if (!Number.isFinite(sample)) throw new Error('Render contains invalid audio samples.');
      if (Math.abs(sample) > 1.00001)
        throw new Error(
          'Export clips above 0 dBFS. Lower gain or enable the mix limiter. Track stems are pre-master.'
        );
      const clamped = Math.max(-1, Math.min(1, sample));
      const value = Math.round(clamped * (clamped < 0 ? 8388608 : 8388607));
      bytes[offset++] = value & 255;
      bytes[offset++] = (value >> 8) & 255;
      bytes[offset++] = (value >> 16) & 255;
    }
  return { bytes, crc: updateCrc(crc, bytes) };
}

export async function createExportSink(expectedBytes, extension = 'wav') {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0)
    throw new Error('Invalid export size.');
  if (globalThis.navigator?.storage?.getDirectory) {
    const estimate = await navigator.storage.estimate?.();
    if (
      Number.isFinite(estimate?.quota) &&
      estimate.quota - (estimate.usage || 0) < expectedBytes * 1.1 + 16 * 1024 * 1024
    )
      throw new Error(
        'Not enough browser disk space for this export. Download and clear older export files, free disk space, or export a shorter range.'
      );
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
    const name = `export-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const handle = await directory.getFileHandle(name, { create: true });
    let writer;
    try {
      writer = await handle.createWritable();
    } catch (error) {
      await directory.removeEntry(name);
      throw error;
    }
    let written = 0,
      finished = false;
    return {
      async write(bytes) {
        await writer.write(bytes);
        written += bytes.byteLength;
      },
      async finish() {
        await writer.close();
        finished = true;
        const file = await handle.getFile();
        if (file.size !== written) throw new Error('Export file did not finish writing.');
        cleanup.set(file, () => directory.removeEntry(name));
        return file;
      },
      async abort() {
        if (!finished) await writer.abort().catch(() => {});
        await directory.removeEntry(name).catch(() => {});
      },
    };
  }
  if (expectedBytes > MEMORY_FALLBACK)
    throw new Error(
      'This browser cannot write long exports to temporary disk. Use a current browser with private file-system support or export a shorter range.'
    );
  const parts = [];
  let size = 0;
  return {
    async write(bytes) {
      size += bytes.byteLength;
      if (size > MEMORY_FALLBACK)
        throw new Error(
          'In-memory export limit reached. Use a browser with disk-backed export support.'
        );
      parts.push(bytes);
    },
    async finish() {
      return new Blob(parts, { type: extension === 'zip' ? 'application/zip' : 'audio/wav' });
    },
    async abort() {
      parts.length = 0;
    },
  };
}
export async function clearExportFile(file) {
  await cleanup.get(file)?.();
  cleanup.delete(file);
}
export async function savedExportFiles() {
  if (!globalThis.navigator?.storage?.getDirectory) return [];
  try {
    const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY);
    const files = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file' || !/^export-\d+-[a-f0-9-]+\.(wav|zip|sattari)$/.test(name))
        continue;
      const file = await handle.getFile();
      if (file.size) {
        cleanup.set(file, () => directory.removeEntry(name));
        files.push(file);
      }
    }
    return files;
  } catch (error) {
    if (error.name === 'NotFoundError') return [];
    throw error;
  }
}

// ZIP64 stored entries: sizes/offsets never wrap at 4 GiB. CRC uses data descriptors.
export class StreamZip {
  constructor(sink) {
    this.sink = sink;
    this.offset = 0;
    this.files = [];
  }
  async write(bytes) {
    await this.sink.write(bytes);
    this.offset += bytes.byteLength;
  }
  async begin(name, size) {
    if (this.entry) throw new Error('Finish the current ZIP entry first.');
    const encoded = encoder.encode(name),
      bytes = new Uint8Array(30 + encoded.length + 20),
      view = new DataView(bytes.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 45, true);
    view.setUint16(6, 0x808, true);
    view.setUint32(18, 0xffffffff, true);
    view.setUint32(22, 0xffffffff, true);
    view.setUint16(26, encoded.length, true);
    view.setUint16(28, 20, true);
    bytes.set(encoded, 30);
    const extra = 30 + encoded.length;
    view.setUint16(extra, 1, true);
    view.setUint16(extra + 2, 16, true);
    view.setBigUint64(extra + 4, BigInt(size), true);
    view.setBigUint64(extra + 12, BigInt(size), true);
    this.entry = { name: encoded, size, offset: this.offset, written: 0, crc: 0xffffffff };
    await this.write(bytes);
  }
  async data(bytes, crc) {
    if (!this.entry) throw new Error('No open ZIP entry.');
    this.entry.crc = crc ?? updateCrc(this.entry.crc, bytes);
    this.entry.written += bytes.byteLength;
    await this.write(bytes);
  }
  async end() {
    const entry = this.entry;
    if (!entry || entry.written !== entry.size) throw new Error('Incomplete ZIP entry.');
    entry.crc = (entry.crc ^ 0xffffffff) >>> 0;
    const bytes = new Uint8Array(24),
      view = new DataView(bytes.buffer);
    view.setUint32(0, 0x08074b50, true);
    view.setUint32(4, entry.crc, true);
    view.setBigUint64(8, BigInt(entry.size), true);
    view.setBigUint64(16, BigInt(entry.size), true);
    await this.write(bytes);
    this.files.push(entry);
    this.entry = null;
  }
  async finish() {
    if (this.entry) throw new Error('Unfinished ZIP entry.');
    const start = this.offset;
    for (const file of this.files) {
      const bytes = new Uint8Array(46 + file.name.length + 28),
        v = new DataView(bytes.buffer);
      v.setUint32(0, 0x02014b50, true);
      v.setUint16(4, 45, true);
      v.setUint16(6, 45, true);
      v.setUint16(8, 0x808, true);
      v.setUint32(16, file.crc, true);
      v.setUint32(20, 0xffffffff, true);
      v.setUint32(24, 0xffffffff, true);
      v.setUint16(28, file.name.length, true);
      v.setUint16(30, 28, true);
      v.setUint32(42, 0xffffffff, true);
      bytes.set(file.name, 46);
      const extra = 46 + file.name.length;
      v.setUint16(extra, 1, true);
      v.setUint16(extra + 2, 24, true);
      v.setBigUint64(extra + 4, BigInt(file.size), true);
      v.setBigUint64(extra + 12, BigInt(file.size), true);
      v.setBigUint64(extra + 20, BigInt(file.offset), true);
      await this.write(bytes);
    }
    const directorySize = this.offset - start,
      zip64At = this.offset;
    const bytes = new Uint8Array(98),
      v = new DataView(bytes.buffer);
    v.setUint32(0, 0x06064b50, true);
    v.setBigUint64(4, 44n, true);
    v.setUint16(12, 45, true);
    v.setUint16(14, 45, true);
    v.setBigUint64(24, BigInt(this.files.length), true);
    v.setBigUint64(32, BigInt(this.files.length), true);
    v.setBigUint64(40, BigInt(directorySize), true);
    v.setBigUint64(48, BigInt(start), true);
    v.setUint32(56, 0x07064b50, true);
    v.setBigUint64(64, BigInt(zip64At), true);
    v.setUint32(72, 1, true);
    v.setUint32(76, 0x06054b50, true);
    v.setUint16(84, 0xffff, true);
    v.setUint16(86, 0xffff, true);
    v.setUint32(88, 0xffffffff, true);
    v.setUint32(92, 0xffffffff, true);
    await this.write(bytes);
  }
}
