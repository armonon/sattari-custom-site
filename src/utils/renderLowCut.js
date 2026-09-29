// Offline snapshots have a fixed cutoff. Native IIR keeps the same high-pass
// response without the low-frequency gain-cancellation error measured in
// Chromium's BiquadFilter render path on Linux. Live automation stays in Tone.
// Coefficients: https://www.w3.org/TR/webaudio/#filters-characteristics
export function createRenderLowCut(context, frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0 || frequency >= context.sampleRate / 2)
    throw new RangeError('Render low-cut frequency must be between zero and Nyquist.');
  const omega = (2 * Math.PI * frequency) / context.sampleRate;
  const cosine = Math.cos(omega);
  // Web Audio high-pass Q is in decibels; Tone.Filter's existing default is 1.
  const alpha = Math.sin(omega) / (2 * 10 ** (1 / 20));
  // Normalize in JS double precision; browser coefficient normalization can
  // otherwise shift the response at very low cutoffs.
  const a0 = 1 + alpha;
  return context.createIIRFilter(
    [(1 + cosine) / (2 * a0), -(1 + cosine) / a0, (1 + cosine) / (2 * a0)],
    [1, (-2 * cosine) / a0, (1 - alpha) / a0]
  );
}
