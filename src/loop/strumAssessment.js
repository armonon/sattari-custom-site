import { signalLevel } from './signal.js';

export function captureQuality(samples, rate, noiseFloor = 0.002) {
  const level = signalLevel(samples);
  let clipped = 0;
  for (const value of samples) if (Math.abs(value) >= 0.985) clipped++;
  return {
    ...level,
    duration: samples.length / rate,
    clippedFraction: clipped / Math.max(1, samples.length),
    noiseFloor,
  };
}

// Conservative evidence check for the displayed voicing, not chord recognition or
// a calibrated accuracy probability. Every expected absolute pitch must overlap.
export function assessStrum(notes, targetMidis, quality) {
  const expected = [...new Set(targetMidis)].sort((a, b) => a - b);
  const base = { expected, heard: [], missing: expected, extra: [], overlap: 0 };
  if (!expected.length || !Number.isFinite(quality?.rms)) return { ...base, status: 'unavailable' };
  if (quality.clippedFraction > 0.015) return { ...base, status: 'clipped' };
  if (quality.rms < Math.max(0.0008, quality.noiseFloor * 0.7)) return { ...base, status: 'quiet' };
  const usable = notes.filter(
    (n) =>
      Number.isInteger(n.midi) &&
      Number.isFinite(n.start) &&
      Number.isFinite(n.end) &&
      n.end - n.start >= 0.09 &&
      n.confidence >= 0.3
  );
  const pitches = new Set(expected.map((midi) => midi % 12));
  const boundaries = [...new Set(usable.flatMap((n) => [n.start, n.end]))].sort((a, b) => a - b);
  let best = base;
  let completeStart = null;
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const start = boundaries[i],
      end = boundaries[i + 1],
      at = (start + end) / 2;
    const active = usable.filter((n) => n.start <= at && n.end > at);
    const activeMidis = new Set(active.map((n) => n.midi));
    const heard = expected.filter((midi) => activeMidis.has(midi));
    const missing = expected.filter((midi) => !activeMidis.has(midi));
    const extra = [...activeMidis].filter((midi) => !pitches.has(midi % 12));
    if (
      heard.length > best.heard.length ||
      (heard.length === best.heard.length && extra.length < best.extra.length)
    )
      best = { expected, heard, missing, extra, overlap: end - start };
    if (!missing.length && !extra.length) {
      completeStart ??= start;
      if (end - completeStart >= 0.12)
        return {
          expected,
          heard,
          missing,
          extra,
          overlap: end - completeStart,
          status: 'matched',
        };
    } else {
      completeStart = null;
    }
  }
  return { ...best, status: 'not-confirmed' };
}
