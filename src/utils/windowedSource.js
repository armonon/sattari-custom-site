import { decodeSourceWindow } from './arrangementSourceWindow';
import { mp3Gapless } from './mp3Gapless';
import { wavBytes } from './arrangementExport';
import { describeAiff } from './aiffWindow';
import { decodedSongDuration } from './compressedAudioWindow';

export async function describeAudioSource(blob) {
  const aiff = await describeAiff(blob);
  if (aiff)
    return {
      kind: 'windowed-audio',
      blob,
      duration: aiff.duration,
      sampleRate: aiff.sampleRate,
      channels: aiff.channels,
    };
  const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
  const input = new Input({
    source: new BlobSource(blob, { maxCacheSize: 2 * 1048576 }),
    formats: ALL_FORMATS,
  });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode()))
      throw new Error('This audio format cannot be streamed in this browser. Use PCM WAV.');
    const sampleRate = await track.getSampleRate();
    const channels = await track.getNumberOfChannels();
    const padding = await mp3Gapless(blob);
    const metadataDuration = await input.getDurationFromMetadata([track]);
    // Missing container duration is not missing audio. Scan packet timing with
    // the same bounded encoded cache; never fall back to decoding the whole song.
    const duration =
      (Number.isFinite(metadataDuration) && metadataDuration > 0
        ? metadataDuration
        : await input.computeDuration([track])) -
      (padding?.trimFrames || 0) / sampleRate;
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isInteger(channels) ||
      channels < 1 ||
      channels > 32 ||
      sampleRate < 8000 ||
      sampleRate > 384000
    )
      throw new Error(
        'The audio file has incomplete timing information. Convert it to PCM WAV before loading.'
      );
    return { kind: 'windowed-audio', blob, duration, sampleRate, channels };
  } finally {
    input.dispose();
  }
}

// One pool per audio engine, not one unbounded cache per deck. Admission includes
// in-flight decodes; currently sounding grains pin their pages until they end.
export class SourceWindowPool {
  constructor(raw, { budget = 128 * 1048576, decode = decodeSourceWindow } = {}) {
    Object.assign(this, { raw, budget, decode });
    this.pages = new Map();
    this.pending = new Map();
    this.ids = new WeakMap();
    this.sequence = 0;
    this.bytes = 0;
    this.reserved = 0;
    this.peakBytes = 0;
    this.controller = new AbortController();
  }
  key(source, index) {
    if (!this.ids.has(source)) this.ids.set(source, ++this.sequence);
    return `${this.ids.get(source)}:${index}`;
  }
  async page(source, index) {
    if (this.controller.signal.aborted) throw new Error('Audio preparation cancelled.');
    const key = this.key(source, index);
    const cached = this.pages.get(key);
    if (cached) {
      cached.used = ++this.sequence;
      return cached;
    }
    if (this.pending.has(key)) return this.pending.get(key);
    const previous = this.decodeTail || Promise.resolve();
    const job = (async () => {
      await previous;
      if (this.controller.signal.aborted) throw new Error('Audio preparation cancelled.');
      const from = index * 4,
        to = Math.min(source.duration, from + 6);
      const targetRate = this.raw.sampleRate || source.sampleRate;
      const resample = source.sampleRate !== targetRate;
      const readFrom = resample ? Math.max(0, from - 1) : from;
      const readTo = resample ? Math.min(source.duration, to + 1) : to;
      // Resampling retains input PCM, a bounded WAV bridge, the resampled data
      // and the trimmed page transiently. Serialize decodes and reserve all four.
      const reserve =
        ((Math.ceil((readTo - readFrom) * Math.max(source.sampleRate, targetRate)) + 2) *
          source.channels *
          4 +
          44) *
        (resample ? 4 : 1);
      if (reserve <= 0 || reserve > this.budget)
        throw new Error('This source configuration exceeds available playback capacity.');
      for (const [oldKey, old] of [...this.pages].sort((a, b) => a[1].used - b[1].used)) {
        if (this.bytes + this.reserved + reserve <= this.budget) break;
        if (!old.pins) {
          this.pages.delete(oldKey);
          this.bytes -= old.bytes;
        }
      }
      if (this.bytes + this.reserved + reserve > this.budget)
        throw new Error(
          'Too many sources are active to prepare more audio safely. Stop an unused deck and retry.'
        );
      this.reserved += reserve;
      this.peakBytes = Math.max(this.peakBytes, this.bytes + this.reserved);
      try {
        let decoded = await this.decode(this.raw, source.blob, readFrom, readTo, reserve, {
          signal: this.controller.signal,
        });
        if (resample) {
          const converted = await this.raw.decodeAudioData(wavBytes(decoded.buffer, true).buffer);
          const offset = Math.round(from * targetRate) / targetRate;
          const first = Math.round((offset - decoded.offset) * targetRate);
          const count = Math.min(
            converted.length - first,
            Math.ceil((to - offset) * targetRate) + 1
          );
          const buffer = this.raw.createBuffer(source.channels, count, targetRate);
          for (let c = 0; c < source.channels; c++)
            buffer
              .getChannelData(c)
              .set(converted.getChannelData(c).subarray(first, first + count));
          decoded = { buffer, offset };
        }
        if (this.controller.signal.aborted) throw new Error('Audio preparation cancelled.');
        const bytes = decoded.buffer.length * decoded.buffer.numberOfChannels * 4;
        if (bytes > reserve)
          throw new Error('Audio format changed during preparation. Relink the original source.');
        const page = { ...decoded, source, bytes, pins: 0, used: ++this.sequence };
        this.pages.set(key, page);
        this.bytes += bytes;
        return page;
      } finally {
        this.reserved -= reserve;
      }
    })();
    this.pending.set(key, job);
    this.decodeTail = job.catch(() => {});
    try {
      return await job;
    } finally {
      this.pending.delete(key);
    }
  }
  async prepare(
    source,
    position,
    { loop = false, loopStart = 0, loopEnd = source.duration, prepareSeconds = 8 } = {},
    isCurrent = () => true
  ) {
    if (loop && position >= loopEnd)
      position = loopStart + ((position - loopStart) % (loopEnd - loopStart));
    const start = Math.max(0, Math.min(position, source.duration - 1 / source.sampleRate));
    const ahead = Math.max(1, Math.min(8, Number(prepareSeconds) || 8));
    const end = Math.min(source.duration, start + ahead, loop ? loopEnd : Infinity);
    const indices = new Set();
    for (let i = Math.floor(start / 4); i * 4 < end; i++) indices.add(i);
    if (loop && end >= loopEnd) {
      for (let i = Math.floor(loopStart / 4); i * 4 < Math.min(loopEnd, loopStart + ahead); i++)
        indices.add(i);
    }
    for (const index of indices) {
      // A seek can supersede a multi-page background read. Finish the one
      // admitted decode, but never queue its obsolete remaining pages ahead
      // of the currently audible destination.
      if (!isCurrent()) return;
      await this.page(source, index);
    }
  }
  acquire(source, offset, span, { loop = false, loopStart = 0, loopEnd = source.duration } = {}) {
    if (loop && offset >= loopEnd)
      offset = loopStart + ((offset - loopStart) % (loopEnd - loopStart));
    const end = Math.min(source.duration, offset + span);
    // A small loop can use the browser's native looping without copying grains.
    const page = [...this.pages.values()].find(
      (p) =>
        p.source === source &&
        p.offset <= offset &&
        p.offset + p.buffer.duration >= end &&
        (!loop ||
          offset + span <= loopEnd ||
          (p.offset <= loopStart && p.offset + p.buffer.duration >= loopEnd))
    );
    if (page) {
      page.pins++;
      page.used = ++this.sequence;
      return {
        buffer: page.buffer,
        offset: offset - page.offset,
        loop,
        loopStart: Math.max(0, loopStart - page.offset),
        loopEnd: Math.min(page.buffer.duration, loopEnd - page.offset),
        release: () => {
          page.pins = Math.max(0, page.pins - 1);
        },
      };
    }
    // Large-loop boundary: assemble only this grain, never the entire loop.
    if (!loop || offset + span <= loopEnd) return null;
    const rate = this.raw.sampleRate || source.sampleRate;
    const frames = Math.ceil(span * rate) + 2;
    const bytes = frames * source.channels * 4;
    if (this.bytes + this.reserved + bytes > this.budget) return null;
    const segments = [];
    const alignedStart = Math.floor(offset * rate) / rate;
    let position = alignedStart,
      remaining = frames;
    while (remaining > 0) {
      if (position >= loopEnd - 0.5 / rate) position = loopStart;
      const part = [...this.pages.values()].find(
        (p) =>
          p.source === source && p.offset <= position && p.offset + p.buffer.duration > position
      );
      if (!part) return null;
      const first = Math.round((position - part.offset) * rate);
      const count = Math.min(
        remaining,
        part.buffer.length - first,
        Math.round((loopEnd - position) * rate)
      );
      if (count <= 0) return null;
      segments.push({ part, first, count });
      remaining -= count;
      position += count / rate;
    }
    this.reserved += bytes;
    this.peakBytes = Math.max(this.peakBytes, this.bytes + this.reserved);
    const buffer = this.raw.createBuffer(source.channels, frames, rate);
    let target = 0;
    for (const { part, first, count } of segments) {
      for (let c = 0; c < source.channels; c++)
        buffer
          .getChannelData(c)
          .set(part.buffer.getChannelData(c).subarray(first, first + count), target);
      target += count;
    }
    return {
      buffer,
      offset: offset - alignedStart,
      loop: false,
      release: () => {
        this.reserved -= bytes;
      },
    };
  }
  dispose() {
    this.controller.abort();
    this.pages.clear();
    this.bytes = 0;
  }
}

/**
 * A source's length: from its container where this browser can read it, else
 * from one bounded decode that later windows with the same cacheKey reuse.
 */
export async function sourceDuration(
  raw,
  blob,
  cacheKey,
  { describe = describeAudioSource, decodeWhole = decodedSongDuration } = {}
) {
  try {
    return (await describe(blob)).duration;
  } catch (error) {
    const duration = await decodeWhole(raw, blob, cacheKey).catch(() => null);
    if (duration > 0) return duration;
    throw error;
  }
}
