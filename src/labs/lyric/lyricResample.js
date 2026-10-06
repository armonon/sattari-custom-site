// A plain linear-interpolation resampler. It is not broadcast quality, but
// Whisper only needs a reasonable 16 kHz approximation of the waveform to
// transcribe words and their timestamps, not a pristine downmix.

/** Resamples `samples` from `fromRate` Hz to `targetRate` Hz by linear interpolation. */
export function resampleLinear(samples, fromRate, targetRate) {
  if (!samples?.length || fromRate === targetRate) return samples;
  const ratio = fromRate / targetRate;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = srcPos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}
