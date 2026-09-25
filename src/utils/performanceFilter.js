// Shared by live playback and timestamped replay so their curves cannot drift.
export function performanceFilter(value = 50) {
  const normalized = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 50));
  if (normalized < 48)
    return { type: 'lowpass', frequency: 70 * (20000 / 70) ** (normalized / 48) };
  if (normalized > 52)
    return { type: 'highpass', frequency: 20 * (7500 / 20) ** ((normalized - 52) / 48) };
  return { type: 'lowpass', frequency: 20000 };
}
