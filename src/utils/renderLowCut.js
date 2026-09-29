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
  return context.createIIRFilter(
    [(1 + cosine) / 2, -(1 + cosine), (1 + cosine) / 2],
    [1 + alpha, -2 * cosine, 1 - alpha]
  );
}
