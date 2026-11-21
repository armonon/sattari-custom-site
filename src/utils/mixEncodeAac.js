// M4A/AAC encoding of a rendered mix with the browser's own encoder (WebCodecs
// via mediabunny, already a site dependency). Loaded only when chosen.
// AAC is lossy and adds encoder priming/padding, so WAV stays the choice for
// sample-exact alignment; M4A is for phones, messages and students.
export const AAC_BITRATE = 192000;

export async function aacSupported(sampleRate = 44100) {
  try {
    const { canEncodeAudio } = await import('mediabunny');
    return await canEncodeAudio('aac', { numberOfChannels: 2, sampleRate, bitrate: AAC_BITRATE });
  } catch {
    return false;
  }
}

/** render: renderMix() result. Returns an audio/mp4 Blob. */
export async function encodeMixAac(render, { signal, onProgress = () => {} } = {}) {
  const { AudioSample, AudioSampleSource, BufferTarget, Mp4OutputFormat, Output } =
    await import('mediabunny');
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const source = new AudioSampleSource({ codec: 'aac', bitrate: AAC_BITRATE });
  output.addAudioTrack(source);
  await output.start();
  const [left, right] = render.channels;
  const chunk = render.sampleRate; // one second per sample
  try {
    for (let start = 0; start < render.frames; start += chunk) {
      signal?.throwIfAborted();
      const frames = Math.min(chunk, render.frames - start);
      const data = new Float32Array(frames * 2);
      data.set(left.subarray(start, start + frames), 0);
      data.set(right.subarray(start, start + frames), frames);
      const sample = new AudioSample({
        data,
        format: 'f32-planar',
        numberOfChannels: 2,
        sampleRate: render.sampleRate,
        timestamp: start / render.sampleRate,
      });
      await source.add(sample);
      sample.close();
      onProgress((start + frames) / render.frames);
    }
    source.close();
    await output.finalize();
  } catch (error) {
    await output.cancel().catch(() => {});
    throw error;
  }
  return new Blob([target.buffer], { type: 'audio/mp4' });
}
