// Demux compressed packets from Blob byte ranges and decode only a source-time
// interval. Lazy import keeps codec/demux code off the normal PCM startup path.
// Browsers without WebCodecs audio decoding (Safari before 26) fall back to one
// bounded whole-song decodeAudioData, the way short sources always load.
import { mp3Gapless } from './mp3Gapless.js';

// Decoded songs kept for the fallback, least recently used first. Streaming
// windows are served from these copies; a song larger than the whole budget is
// refused before any decoding.
const FALLBACK_BUDGET = 384 * 1024 * 1024;
const fallbackSongs = new Map();

export function releaseDecodedSongs() {
  fallbackSongs.clear();
}

async function decodeWholeSong(raw, blob, key, estimate) {
  if (!(estimate <= FALLBACK_BUDGET))
    throw new Error(
      'This browser cannot stream this audio codec at this length (it lacks WebCodecs audio). Convert the file to WAV, or use a current version of Safari, Chrome, Edge or Firefox.'
    );
  const cached = key && fallbackSongs.get(key);
  if (cached) {
    fallbackSongs.delete(key);
    fallbackSongs.set(key, cached);
    return cached.promise;
  }
  const entry = { bytes: estimate };
  entry.promise = blob
    .arrayBuffer()
    .then((bytes) => raw.decodeAudioData(bytes))
    .catch((error) => {
      throw new Error('This browser cannot decode this audio file. Convert it to WAV.', {
        cause: error,
      });
    });
  if (key) fallbackSongs.set(key, entry);
  try {
    const song = await entry.promise;
    entry.bytes = song.length * song.numberOfChannels * 4;
    let total = [...fallbackSongs.values()].reduce((sum, value) => sum + value.bytes, 0);
    for (const [other, value] of fallbackSongs) {
      if (total <= FALLBACK_BUDGET) break;
      if (value === entry) continue;
      fallbackSongs.delete(other);
      total -= value.bytes;
    }
    return song;
  } catch (error) {
    if (key && fallbackSongs.get(key) === entry) fallbackSongs.delete(key);
    throw error;
  }
}

/** A song's length from one whole decode (the fallback); later windows reuse it. */
export async function decodedSongDuration(raw, blob, cacheKey) {
  return (await decodeWholeSong(raw, blob, cacheKey, blob.size * 25)).duration;
}

function windowFrom(raw, song, start, end, budget) {
  const rate = song.sampleRate,
    channels = song.numberOfChannels;
  const first = Math.floor(start * rate);
  const last = Math.min(song.length, Math.ceil(end * rate) + 1);
  const frames = last - first;
  if (frames <= 0) throw new Error('Requested audio is outside the source.');
  if (frames * channels * 4 > budget)
    throw new Error('Source window exceeds the audio memory budget. Use a shorter range.');
  const result = raw.createBuffer(channels, frames, rate);
  for (let channel = 0; channel < channels; channel++)
    result.getChannelData(channel).set(song.getChannelData(channel).subarray(first, last));
  return { buffer: result, offset: first / rate };
}

async function fallbackWindow(raw, blob, input, track, start, end, budget, options) {
  const duration = track ? await input.getDurationFromMetadata([track]).catch(() => null) : null;
  const channels = (track && (await track.getNumberOfChannels().catch(() => 2))) || 2;
  // Decoded float PCM at the context rate; unknown lengths assume a typical
  // compression ratio (a 128 kbps MP3 decodes to about 24 times its size).
  const estimate =
    Number.isFinite(duration) && duration > 0
      ? duration * (raw.sampleRate || 48000) * channels * 4
      : blob.size * 25;
  const song = await decodeWholeSong(raw, blob, options.cacheKey, estimate);
  if (options.signal?.aborted) throw new Error('Source decoding cancelled.');
  return windowFrom(raw, song, start, end, budget);
}

export async function decodeCompressedWindow(raw, blob, start, end, budget, options = {}) {
  if (![start, end, budget].every(Number.isFinite) || start < 0 || end <= start || budget <= 0)
    throw new Error('Invalid source window.');
  const { Input, BlobSource, ALL_FORMATS, AudioBufferSink } = await import('mediabunny');
  const source = new BlobSource(blob, { maxCacheSize: 2 * 1024 * 1024 });
  if (options.onRead) source.on('read', options.onRead);
  const input = new Input({ source, formats: ALL_FORMATS });
  const abort = () => input.dispose();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    if (options.signal?.aborted) throw new Error('Source decoding cancelled.');
    // An unknown container is left to the browser's own decoder.
    const track = await input.getPrimaryAudioTrack().catch(() => null);
    if (!track || !(await track.canDecode().catch(() => false)))
      return await fallbackWindow(raw, blob, input, track, start, end, budget, options);
    const channels = await track.getNumberOfChannels();
    const rate = await track.getSampleRate();
    if (
      !Number.isInteger(channels) ||
      channels < 1 ||
      channels > 32 ||
      rate < 8000 ||
      rate > 384000
    )
      throw new Error('Unsupported source channel count or sample rate.');
    const gapless = await mp3Gapless(blob);
    if (options.signal?.aborted) throw new Error('Source decoding cancelled.');
    const priming = gapless?.startFrames ?? 0;
    const metadataDuration = await input.getDurationFromMetadata([track]);
    const duration =
      metadataDuration == null ? null : metadataDuration - (gapless?.trimFrames ?? 0) / rate;
    const first = Math.floor(start * rate);
    const last = Math.ceil(Math.min(end, duration ?? end) * rate) + 1;
    const frames = last - first;
    if (frames <= 0) throw new Error('Requested audio is outside the source.');
    if (frames * channels * 4 > budget)
      throw new Error('Source window exceeds the audio memory budget. Use a shorter range.');
    const result = raw.createBuffer(channels, frames, rate);
    let copied = 0;
    // One second of preroll stabilizes inter-frame codec history. The sink may
    // seek earlier for codec dependencies; only the requested PCM is retained.
    const sink = new AudioBufferSink(track);
    for await (const { buffer, timestamp } of sink.buffers(
      Math.max(0, start + priming / rate - 1),
      (last + priming) / rate
    )) {
      if (options.signal?.aborted) throw new Error('Source decoding cancelled.');
      if (buffer.sampleRate !== rate || buffer.numberOfChannels !== channels)
        throw new Error('Audio format changed inside the source. Convert it to PCM WAV.');
      const position = Math.round(timestamp * rate) - priming - first;
      const sourceStart = Math.max(0, -position);
      const targetStart = Math.max(0, position);
      const count = Math.min(buffer.length - sourceStart, frames - targetStart);
      if (count <= 0) continue;
      for (let channel = 0; channel < channels; channel++) {
        const pcm = buffer.getChannelData(channel).subarray(sourceStart, sourceStart + count);
        for (const value of pcm)
          if (!Number.isFinite(value)) throw new Error('Source contains invalid samples.');
        result.getChannelData(channel).set(pcm, targetStart);
      }
      copied += count;
    }
    if (!copied)
      throw new Error('No audio was decoded for this source window. Relink the original file.');
    return { buffer: result, offset: first / rate };
  } finally {
    options.signal?.removeEventListener('abort', abort);
    input.dispose();
  }
}
