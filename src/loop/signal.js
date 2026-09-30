export function signalLevel(samples) {
  let sum = 0,
    peak = 0;
  for (const sample of samples) {
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return { rms, peak, db: 20 * Math.log10(Math.max(rms, 0.000001)) };
}

export function noiseThreshold(levels) {
  const sorted = [...levels].filter(Number.isFinite).sort((a, b) => a - b);
  return Math.max(0.0012, (sorted[Math.floor(sorted.length * 0.9)] || 0) * 2.8);
}

export function detectAttack(previous, rms, threshold, now) {
  const audible = rms >= threshold;
  const rise =
    audible &&
    (previous.rms < threshold || (rms > previous.rms * 1.8 && rms - previous.rms > threshold));
  const attack = rise && now - previous.at > 120;
  return { rms, at: attack ? now : previous.at, id: previous.id + (attack ? 1 : 0), attack };
}
