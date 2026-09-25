// Demux compressed packets from Blob byte ranges and decode only a source-time
// interval. Lazy import keeps codec/demux code off the normal PCM startup path.
// No decodeAudioData fallback: unsupported codecs fail without allocating a song.
import { mp3Gapless } from './mp3Gapless.js';

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
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode()))
      throw new Error(
        'This browser cannot window-decode this audio codec. Convert the source to PCM WAV or use a supported browser.'
      );
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
