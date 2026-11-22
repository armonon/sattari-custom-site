// Practice-quality time stretching (WSOLA) and resampling for the stem player.
//
// Slowing down without changing pitch: stretch time by alpha = output/input.
// Transposing without changing speed: stretch by the pitch ratio, then play
// (or resample) faster/slower by the same ratio. For speed v and pitch ratio
// r, stretch by r / v and play at rate r.
//
// All stems share one alignment path computed on a guide signal (the mono sum
// of every stem), so when the stretched stems are mixed they stay
// phase-coherent with each other. This is a practice tool, not mastering-grade
// processing: expect some smearing on transients and at extreme settings.

export const FRAME = 2048;
export const HOP = FRAME / 2;
const SEARCH = 256; // samples either side
const DECIMATE = 4;

export const pitchRatio = (semitones) => 2 ** (semitones / 12);
export const stretchFactor = (speed, semitones) => pitchRatio(semitones) / speed;

let window;
function hann() {
  if (!window) {
    window = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME);
  }
  return window;
}

/** Mono guide at 1/DECIMATE rate for alignment search. */
export function guideSignal(channelSets) {
  const length = Math.max(...channelSets.map((channels) => channels[0].length));
  const guide = new Float32Array(Math.ceil(length / DECIMATE));
  for (const channels of channelSets)
    for (const channel of channels)
      for (let i = 0, j = 0; i < channel.length; i += DECIMATE, j++) guide[j] += channel[i];
  return guide;
}

/**
 * WSOLA alignment: for each output frame, the input start position.
 * alpha > 1 makes audio longer (slower).
 */
export function wsolaPath(guide, inputLength, alpha, { signal } = {}) {
  const analysisHop = HOP / alpha;
  const frames = Math.max(1, Math.ceil((inputLength * alpha) / HOP) + 1);
  const positions = new Float64Array(frames);
  const corrLength = FRAME / DECIMATE / 2;
  const search = SEARCH / DECIMATE;
  let previous = 0;
  for (let k = 1; k < frames; k++) {
    if (k % 512 === 0) signal?.throwIfAborted?.();
    const nominal = k * analysisHop;
    // Natural continuation of the previously chosen frame.
    const target = (previous + HOP) / DECIMATE;
    const centre = nominal / DECIMATE;
    let best = centre;
    let bestScore = -Infinity;
    const t = Math.round(target);
    for (let delta = -search; delta <= search && t + corrLength < guide.length; delta++) {
      const candidate = Math.round(centre + delta);
      if (candidate < 0 || candidate + corrLength >= guide.length) continue;
      let score = 0;
      let energy = 1e-9;
      for (let i = 0; i < corrLength; i++) {
        const value = guide[candidate + i];
        score += value * guide[t + i];
        energy += value * value;
      }
      score /= Math.sqrt(energy);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    const position = bestScore === -Infinity ? nominal : best * DECIMATE;
    positions[k] = Math.max(0, Math.min(inputLength - 1, position));
    previous = positions[k];
  }
  return positions;
}

/** Overlap-add one channel along a shared path. Output length = round(n * alpha). */
export function applyPath(channel, positions, alpha) {
  const length = Math.max(1, Math.round(channel.length * alpha));
  const out = new Float32Array(length + FRAME);
  const weight = new Float32Array(length + FRAME);
  const w = hann();
  for (let k = 0; k < positions.length; k++) {
    const from = Math.round(positions[k]);
    const to = k * HOP;
    for (let i = 0; i < FRAME; i++) {
      const at = to + i;
      if (at >= out.length) break;
      const source = from + i;
      out[at] += (source < channel.length ? channel[source] : 0) * w[i];
      weight[at] += w[i];
    }
  }
  const result = new Float32Array(length);
  for (let i = 0; i < length; i++) result[i] = weight[i] > 1e-3 ? out[i] / weight[i] : 0;
  return result;
}

/**
 * Stretch several stems coherently. stems: { id: [left, right] }.
 * Returns { id: [left, right] } each round(n * alpha) frames.
 */
export function stretchStems(stems, alpha, options = {}) {
  const entries = Object.entries(stems);
  if (Math.abs(alpha - 1) < 1e-6)
    return Object.fromEntries(
      entries.map(([id, channels]) => [id, channels.map((c) => c.slice())])
    );
  const length = Math.max(...entries.map(([, channels]) => channels[0].length));
  const path = wsolaPath(
    guideSignal(entries.map(([, channels]) => channels)),
    length,
    alpha,
    options
  );
  return Object.fromEntries(
    entries.map(([id, channels]) => [
      id,
      channels.map((channel) => applyPath(channel, path, alpha)),
    ])
  );
}

/** Cubic (Catmull-Rom) resampling: plays `rate` times faster (rate 2 = an octave up, half length). */
export function resample(channel, rate) {
  if (Math.abs(rate - 1) < 1e-9) return channel.slice();
  const length = Math.max(1, Math.round(channel.length / rate));
  const out = new Float32Array(length);
  const at = (i) => channel[Math.min(channel.length - 1, Math.max(0, i))];
  for (let i = 0; i < length; i++) {
    const x = i * rate;
    const j = Math.floor(x);
    const t = x - j;
    const p0 = at(j - 1),
      p1 = at(j),
      p2 = at(j + 1),
      p3 = at(j + 2);
    out[i] =
      p1 +
      0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  }
  return out;
}
