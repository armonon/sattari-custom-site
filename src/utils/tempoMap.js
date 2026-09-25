// Bounded tempo-state path over onset evidence. Silence alone never creates a
// map. Weak beats inside a supported path are explicitly inferred. This is not
// a neural/downbeat or phrase detector.
export function decodeTempoPath(activation, fps = 50, { minBpm = 60, maxBpm = 200 } = {}) {
  const n = activation.length;
  if (n < fps * 3 || n > fps * 124) return { beats: [], confidence: 0 };
  const sorted = Array.from(activation).sort((a, b) => a - b),
    median = sorted[n >> 1];
  const max = sorted[n - 1],
    scale = Math.max((max - median) * 0.2, sorted[Math.floor(n * 0.9)] - median, 1e-8);
  if (max - median < 1e-5) return { beats: [], confidence: 0 };
  const lo = Math.floor((60 * fps) / maxBpm),
    hi = Math.ceil((60 * fps) / minBpm),
    width = hi - lo + 1;
  let prior = lo,
    bestCorrelation = -Infinity;
  for (let p = lo; p <= hi; p++) {
    let cross = 0,
      left = 0,
      right = 0;
    for (let t = p; t < n; t++) {
      const a = Math.max(0, activation[t] - median),
        b = Math.max(0, activation[t - p] - median);
      cross += a * b;
      left += a * a;
      right += b * b;
    }
    const score =
      cross / Math.sqrt(Math.max(1e-20, left * right)) +
      0.015 * Math.exp(-0.5 * (Math.log2((60 * fps) / p / 120) / 1.5) ** 2);
    if (score > bestCorrelation) {
      bestCorrelation = score;
      prior = p;
    }
  }
  const rows = hi + 1,
    scores = new Float32Array(rows * width).fill(-Infinity),
    parents = new Int16Array(n * width).fill(-1);
  const emission = (t) => 1.8 * Math.max(-0.35, Math.min(1.5, (activation[t] - median) / scale));
  let terminal = -Infinity,
    endFrame = 0,
    endPeriod = prior;
  for (let t = 0; t < n; t++)
    for (let p = lo; p <= hi; p++) {
      const at = (t % rows) * width + p - lo,
        penalty = 0.32 * ((p - prior) / prior) ** 2;
      scores[at] = t < hi ? emission(t) - penalty : -Infinity;
      if (t >= p) {
        const radius = Math.max(2, Math.ceil(p * 0.12));
        let best = -Infinity,
          previous = -1;
        for (let q = Math.max(lo, p - radius); q <= Math.min(hi, p + radius); q++) {
          const value = scores[((t - p) % rows) * width + q - lo] - 12 * ((p - q) / q) ** 2;
          if (value > best) {
            best = value;
            previous = q;
          }
        }
        const candidate = best + emission(t) - penalty;
        if (candidate > scores[at]) {
          scores[at] = candidate;
          parents[t * width + p - lo] = previous;
        }
      }
      if (t >= n - hi && scores[at] > terminal) {
        terminal = scores[at];
        endFrame = t;
        endPeriod = p;
      }
    }
  const beats = [];
  let t = endFrame,
    p = endPeriod;
  while (t >= 0) {
    beats.push({ time: t / fps, inferred: activation[t] - median < scale * 0.25 });
    const q = parents[t * width + p - lo];
    if (q < 0) break;
    t -= p;
    p = q;
  }
  beats.reverse();
  if (beats.length < 4) return { beats: [], confidence: 0 };
  const intervals = beats.slice(1).map((b, i) => b.time - beats[i].time),
    periods = [...intervals].sort((a, b) => a - b),
    mid = periods[periods.length >> 1];
  const supported = beats.filter((b) => !b.inferred).length / beats.length;
  const regularity =
    1 / (1 + intervals.reduce((sum, v) => sum + Math.abs(v - mid) / mid, 0) / intervals.length);
  return {
    beats,
    bpm: 60 / mid,
    confidence: Math.min(0.99, supported * regularity),
    method: 'tempo-state-onset-v1',
  };
}
export function trackTempo(samples, rate) {
  const fps = 50,
    hop = Math.max(1, Math.round(rate / fps)),
    actualFps = rate / hop;
  const activation = new Float32Array(Math.floor(samples.length / hop));
  let previous = 0;
  for (let frame = 0; frame < activation.length; frame++) {
    let energy = 0;
    for (let i = frame * hop; i < Math.min(samples.length, (frame + 2) * hop); i++)
      energy += samples[i] * samples[i];
    const rms = Math.sqrt(energy / (2 * hop));
    activation[frame] = Math.max(0, rms - previous);
    previous = rms;
  }
  const beats = [],
    scores = [];
  const block = Math.floor(actualFps * 120),
    overlap = Math.ceil(actualFps * 4);
  for (let at = 0; at < activation.length; at += block) {
    const from = Math.max(0, at - overlap),
      to = Math.min(activation.length, at + block);
    const part = decodeTempoPath(activation.subarray(from, to), actualFps);
    if (!part.beats.length) continue;
    scores.push(part.confidence);
    for (const beat of part.beats) {
      const time = beat.time + from / actualFps;
      const last = beats.at(-1);
      if (time < at / actualFps || (last && time - last.time < 0.25)) continue;
      beats.push({ ...beat, time });
    }
  }
  return {
    beats,
    confidence: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    method: 'tempo-state-onset-v1',
  };
}
export function tempoAt(beats, position, fallback = 120) {
  if (!beats || beats.length < 2) return fallback;
  let low = 0,
    high = beats.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (beats[mid].time <= position) low = mid;
    else high = mid - 1;
  }
  const start = Math.max(0, low - 1),
    end = Math.min(beats.length - 1, low + 2);
  const bpm = (60 * (end - start)) / (beats[end].time - beats[start].time);
  return Number.isFinite(bpm) && bpm >= 40 && bpm <= 260 ? bpm : fallback;
}
