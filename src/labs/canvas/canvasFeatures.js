// Audio features for Canvas. The decoded track is analysed once, up front, into
// per-frame envelopes (overall energy, low band, high band) and kick onsets.
// Rendering then reads features by loop time, so every frame of an exported
// loop is a pure function of (time, audio): the same input gives the same
// video, and the visual restarts exactly where the audio does.

export const FEATURE_FPS = 60;
const KICK_DECAY_SECONDS = 0.16;
const MIN_ONSET_GAP_SECONDS = 0.16;

/** Averages the channels of an AudioBuffer (or anything shaped like one). */
export function mixToMono(buffer) {
  const channels = buffer.numberOfChannels;
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / channels;
  }
  return out;
}

function onePole(cutoff, sampleRate) {
  return Math.exp((-2 * Math.PI * cutoff) / sampleRate);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function normalise(values) {
  const ref = percentile(values, 0.97) || 1;
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = Math.min(1, values[i] / ref);
  return out;
}

/**
 * Per-frame RMS envelopes and kick onsets for mono samples.
 * Low band: two one-pole low-passes at 150 Hz (kick and bass body).
 * High band: the signal minus a 3 kHz low-pass (hats, air, consonants).
 */
export function analyseSamples(samples, sampleRate, fps = FEATURE_FPS) {
  const hop = sampleRate / fps;
  const frames = Math.max(1, Math.floor(samples.length / hop));
  const energy = new Float32Array(frames);
  const low = new Float32Array(frames);
  const high = new Float32Array(frames);
  const aLow = onePole(150, sampleRate);
  const aHigh = onePole(3000, sampleRate);
  let lp1 = 0;
  let lp2 = 0;
  let hp = 0;
  for (let f = 0; f < frames; f++) {
    const start = Math.floor(f * hop);
    const end = Math.min(samples.length, Math.floor((f + 1) * hop));
    let e = 0;
    let l = 0;
    let h = 0;
    for (let i = start; i < end; i++) {
      const x = samples[i];
      lp1 = (1 - aLow) * x + aLow * lp1;
      lp2 = (1 - aLow) * lp1 + aLow * lp2;
      hp = (1 - aHigh) * x + aHigh * hp;
      const hi = x - hp;
      e += x * x;
      l += lp2 * lp2;
      h += hi * hi;
    }
    const n = Math.max(1, end - start);
    energy[f] = Math.sqrt(e / n);
    low[f] = Math.sqrt(l / n);
    high[f] = Math.sqrt(h / n);
  }

  // Kick onsets: positive low-band flux above an adaptive local threshold,
  // peak-picked with a minimum gap.
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, low[f] - low[f - 1]);
  const window = Math.round(fps * 0.5);
  const fluxPeak = percentile(flux, 0.99) || 1;
  const onsets = [];
  const strengths = [];
  const minGap = Math.round(MIN_ONSET_GAP_SECONDS * fps);
  let last = -Infinity;
  for (let f = 1; f < frames - 1; f++) {
    if (flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
    let sum = 0;
    let count = 0;
    for (let k = Math.max(0, f - window); k <= Math.min(frames - 1, f + window); k++) {
      sum += flux[k];
      count++;
    }
    const threshold = (sum / count) * 2.2 + fluxPeak * 0.12;
    if (flux[f] <= threshold || f - last < minGap) continue;
    last = f;
    onsets.push(f / fps);
    strengths.push(Math.min(1, flux[f] / fluxPeak));
  }

  return {
    fps,
    duration: samples.length / sampleRate,
    energy: normalise(energy),
    low: normalise(low),
    high: normalise(high),
    onsets,
    strengths,
  };
}

export function analyseBuffer(buffer) {
  return analyseSamples(mixToMono(buffer), buffer.sampleRate);
}

function smoothCircular(values, attack, release) {
  // Two passes so the state at the loop seam matches the state one loop later.
  const out = new Float32Array(values.length);
  let y = 0;
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < values.length; i++) {
      const x = values[i];
      y += (x - y) * (x > y ? attack : release);
      out[i] = y;
    }
  return out;
}

/**
 * The slice of an analysis that a loop of `length` seconds starting at
 * `start` plays, with a kick envelope that wraps around the loop seam.
 */
export function loopView(analysis, start, length) {
  const { fps } = analysis;
  const frames = Math.max(1, Math.round(length * fps));
  const first = Math.max(0, Math.round(start * fps));
  const pick = (source) => {
    const out = new Float32Array(frames);
    for (let i = 0; i < frames; i++) out[i] = source[Math.min(source.length - 1, first + i)] || 0;
    return out;
  };
  const onsets = [];
  analysis.onsets.forEach((time, index) => {
    const at = time - first / fps;
    if (at >= 0 && at < length) onsets.push({ time: at, strength: analysis.strengths[index] });
  });
  const kick = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    let value = 0;
    for (const onset of onsets) {
      // Age since this onset, counting the previous pass of the loop.
      const age = (t - onset.time + length) % length;
      value = Math.max(value, (0.45 + 0.55 * onset.strength) * Math.exp(-age / KICK_DECAY_SECONDS));
    }
    kick[i] = value;
  }
  return {
    fps,
    length,
    frames,
    energy: smoothCircular(pick(analysis.energy), 0.5, 0.08),
    low: smoothCircular(pick(analysis.low), 0.6, 0.12),
    high: smoothCircular(pick(analysis.high), 0.6, 0.15),
    kick,
    onsets,
  };
}

/** A built-in 120 BPM pulse so the preview moves before a track is loaded. */
export function demoView(length = 8, fps = FEATURE_FPS) {
  const frames = Math.round(length * fps);
  const onsets = [];
  for (let t = 0; t < length - 1e-6; t += 0.5) onsets.push({ time: t, strength: t % 2 ? 0.6 : 1 });
  const energy = new Float32Array(frames);
  const low = new Float32Array(frames);
  const high = new Float32Array(frames);
  const kick = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    const beat = (t % 0.5) / 0.5;
    kick[i] = Math.exp(-(beat * 0.5) / KICK_DECAY_SECONDS) * (Math.floor(t / 0.5) % 2 ? 0.6 : 1);
    low[i] = 0.25 + 0.6 * kick[i];
    high[i] = 0.3 + 0.25 * Math.max(0, Math.sin(Math.PI * 4 * t + 1.2));
    energy[i] = 0.35 + 0.25 * Math.sin((2 * Math.PI * t) / length) ** 2 + 0.3 * kick[i];
  }
  return { fps, length, frames, energy, low, high, kick, onsets, demo: true };
}

/** Feature values at loop time `t` (seconds). */
export function featuresAt(view, t) {
  const i = ((Math.floor(t * view.fps) % view.frames) + view.frames) % view.frames;
  return { energy: view.energy[i], low: view.low[i], high: view.high[i], kick: view.kick[i] };
}
