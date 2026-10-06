// Clean alpha DSP: offline, deterministic voice cleanup for a single mono
// recording. Pure functions operating on Float32Array, no Web Audio graph
// inside the DSP itself (mirrors the house style in ../vox/voxDsp.js), so the
// same code runs in a worker and in unit tests and always produces the exact
// same output for the exact same input.
//
// Chain order: high-pass -> noise reduction -> de-esser -> compressor ->
// loudness normalisation + true-peak limiter. Every stage takes an `amount`
// 0-100 and returns `dry + (amount/100) * (processed - dry)`, so the UI can
// offer a per-stage toggle + slider. For the two stages whose own algorithm
// is explicitly amount-driven (spectral denoise's over-subtraction/floor,
// the de-esser's threshold/depth), `amount` shapes the "processed" signal
// *and* is used again for this final crossfade -- at amount=0 every stage
// collapses to an exact, bit-identical dry bypass regardless of how its
// internal parameters were derived, which keeps the public contract uniform.
import { fft, ifft, hannWindow } from './fft';
import { ProgrammeMeter } from '../../utils/loudnessDSP';

// Mirrors utils/masterOutput.js's trimGain(db) = 10 ** (db / 20) exactly; kept
// local so this file has no dependency beyond the loudness meter it reuses.
const trimGain = (db) => 10 ** (db / 20);

function wetDry(dry, processed, amount) {
  const wet = Math.max(0, Math.min(1, amount / 100));
  const out = new Float32Array(dry.length);
  for (let i = 0; i < dry.length; i++) out[i] = dry[i] + wet * (processed[i] - dry[i]);
  return out;
}

/** Integrated loudness / true peak / sample peak for a mono buffer, via the shared BS.1770 meter. */
export function measureLoudness(samples, rate) {
  const meter = new ProgrammeMeter(rate);
  const chunk = 1024;
  for (let i = 0; i < samples.length; i += chunk)
    meter.process(samples.subarray(i, Math.min(samples.length, i + chunk)));
  return meter.snapshot();
}

// ---------------------------------------------------------------------------
// 1. High-pass filter
// ---------------------------------------------------------------------------

/** RBJ cookbook 2nd-order Butterworth high-pass (Q = 1/sqrt(2), maximally flat). */
function highPassCoefficients(cutoffHz, rate) {
  const q = Math.SQRT1_2;
  const omega = (2 * Math.PI * cutoffHz) / rate;
  const alpha = Math.sin(omega) / (2 * q);
  const cosw = Math.cos(omega);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cosw) / 2 / a0,
    b1: -(1 + cosw) / a0,
    b2: (1 + cosw) / 2 / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

function lowPassCoefficients(cutoffHz, rate) {
  const q = Math.SQRT1_2;
  const omega = (2 * Math.PI * cutoffHz) / rate;
  const alpha = Math.sin(omega) / (2 * q);
  const cosw = Math.cos(omega);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosw) / 2 / a0,
    b1: (1 - cosw) / a0,
    b2: (1 - cosw) / 2 / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

// Direct-form-II-transposed biquad: carries z1/z2 state across the loop by
// hand (no BiquadFilterNode), so offline renders are sample-exact and
// reproducible in tests.
function applyBiquad(samples, { b0, b1, b2, a1, a2 }) {
  const out = new Float32Array(samples.length);
  let z1 = 0,
    z2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    out[i] = y;
  }
  return out;
}

export function highPass(samples, rate, { cutoffHz = 80, amount = 100 } = {}) {
  const clampedCutoff = Math.max(20, Math.min(rate / 2 - 100, cutoffHz));
  const processed = applyBiquad(samples, highPassCoefficients(clampedCutoff, rate));
  return wetDry(samples, processed, amount);
}

// ---------------------------------------------------------------------------
// 2. Noise reduction: spectral gating with a learned noise profile
// ---------------------------------------------------------------------------

export const DENOISE_FRAME = 2048;
export const DENOISE_HOP = 512; // 75% overlap: COLA-exact for a squared Hann window at size/4.
export const DENOISE_BINS = DENOISE_FRAME / 2 + 1;

function frameCount(length, frameSize, hop) {
  return length <= frameSize ? 1 : 1 + Math.floor((length - frameSize) / hop);
}

/** Averaged (median) magnitude spectrum of a quiet region, for use as a noise floor. */
export function estimateNoiseProfile(samples, rate, { startSeconds = 0, endSeconds } = {}) {
  const end = endSeconds ?? samples.length / rate;
  const startSample = Math.max(0, Math.round(startSeconds * rate));
  const endSample = Math.max(startSample + 1, Math.min(samples.length, Math.round(end * rate)));
  const region = samples.subarray(startSample, endSample);
  const window = hannWindow(DENOISE_FRAME);
  const count = frameCount(region.length, DENOISE_FRAME, DENOISE_HOP);
  const byBin = Array.from({ length: DENOISE_BINS }, () => new Float64Array(count));
  const re = new Float64Array(DENOISE_FRAME),
    im = new Float64Array(DENOISE_FRAME);
  for (let f = 0; f < count; f++) {
    const start = f * DENOISE_HOP;
    for (let i = 0; i < DENOISE_FRAME; i++) {
      const s = start + i;
      re[i] = (s < region.length ? region[s] : 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < DENOISE_BINS; b++) byBin[b][f] = Math.hypot(re[b], im[b]);
  }
  const profile = new Float32Array(DENOISE_BINS);
  for (let b = 0; b < DENOISE_BINS; b++) {
    // 50th percentile across frames: a conservative noise-floor estimate that
    // ignores the occasional louder frame inside the "quiet" region.
    const sorted = Array.from(byBin[b]).sort((a, c) => a - c);
    profile[b] = sorted[Math.floor(sorted.length / 2)] || 0;
  }
  return profile;
}

/** Quietest contiguous ~0.5s window in the signal, for a zero-configuration noise profile. */
export function autoDetectNoiseWindow(samples, rate, windowSeconds = 0.5) {
  const windowSize = Math.max(1, Math.min(samples.length, Math.round(windowSeconds * rate)));
  if (samples.length <= windowSize) return { startSeconds: 0, endSeconds: samples.length / rate };
  const step = Math.max(1, Math.round(rate * 0.1));
  let bestStart = 0,
    sum = 0;
  for (let i = 0; i < windowSize; i++) sum += samples[i] * samples[i];
  let bestRms = sum / windowSize;
  for (let start = step; start + windowSize <= samples.length; start += step) {
    sum = 0;
    for (let i = start; i < start + windowSize; i++) sum += samples[i] * samples[i];
    const rms = sum / windowSize;
    if (rms < bestRms) {
      bestRms = rms;
      bestStart = start;
    }
  }
  return { startSeconds: bestStart / rate, endSeconds: (bestStart + windowSize) / rate };
}

/**
 * Classic spectral subtraction / gate: STFT the whole signal, shrink each
 * bin toward silence in proportion to how close it is to the learned noise
 * floor, keep phase untouched, overlap-add back with Hann/Hann COLA
 * normalisation. Not a trained/neural model on purpose -- this stays a
 * self-contained spectral gate so Clean needs no new dependency or license
 * review. `amount` sets both the over-subtraction factor and the gain floor
 * (more aggressive, lower floor as amount rises) and is reapplied as the
 * final wet/dry mix.
 */
export function spectralDenoise(samples, rate, { noiseProfile = null, amount = 60 } = {}) {
  const profile =
    noiseProfile || estimateNoiseProfile(samples, rate, autoDetectNoiseWindow(samples, rate));
  const overSubtraction = 1 + (amount / 100) * 2;
  const floorGain = Math.max(0.05, 0.15 - (amount / 100) * 0.1);
  const window = hannWindow(DENOISE_FRAME);
  const count = frameCount(samples.length, DENOISE_FRAME, DENOISE_HOP);
  const output = new Float64Array(samples.length);
  const weight = new Float64Array(samples.length);
  const re = new Float64Array(DENOISE_FRAME),
    im = new Float64Array(DENOISE_FRAME);
  const half = DENOISE_FRAME / 2;
  for (let f = 0; f < count; f++) {
    const start = f * DENOISE_HOP;
    for (let i = 0; i < DENOISE_FRAME; i++) {
      const s = start + i;
      re[i] = (s < samples.length ? samples[s] : 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < DENOISE_BINS; b++) {
      const mag = Math.hypot(re[b], im[b]);
      const phase = Math.atan2(im[b], re[b]);
      const floor = profile[b] || 0;
      const gain = Math.max(floorGain, 1 - overSubtraction * (floor / Math.max(mag, 1e-9)));
      const newMag = mag * gain;
      re[b] = newMag * Math.cos(phase);
      im[b] = newMag * Math.sin(phase);
    }
    // Mirror bins 1..half-1 so the inverse FFT of this real signal stays real.
    for (let b = 1; b < half; b++) {
      re[DENOISE_FRAME - b] = re[b];
      im[DENOISE_FRAME - b] = -im[b];
    }
    ifft(re, im);
    for (let i = 0; i < DENOISE_FRAME; i++) {
      const s = start + i;
      if (s >= samples.length) break;
      const w = window[i];
      output[s] += re[i] * w; // synthesis window = analysis window (Hann)
      weight[s] += w * w;
    }
  }
  const processed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++)
    processed[i] = weight[i] > 1e-6 ? output[i] / weight[i] : 0;
  return wetDry(samples, processed, amount);
}

// ---------------------------------------------------------------------------
// 3. De-esser
// ---------------------------------------------------------------------------

/** 4-9 kHz band via a cascaded 2nd-order Butterworth high-pass + low-pass. */
function bandpass(samples, rate, lowHz, highHz) {
  const highPassed = applyBiquad(samples, highPassCoefficients(lowHz, rate));
  return applyBiquad(highPassed, lowPassCoefficients(highHz, rate));
}

/**
 * Broad-band de-esser: split off the 4-9 kHz sibilant band, follow its
 * envelope, and pull that band down (only that band, not the full signal)
 * whenever it rises above a threshold set relative to the clip's overall
 * RMS. This is a broad-band reduction, not a trained sibilance detector --
 * see the page LIMITS for what that trade-off costs on real material.
 */
export function deEss(samples, rate, { amount = 50 } = {}) {
  const sibilant = bandpass(samples, rate, 4000, 9000);
  const rest = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) rest[i] = samples[i] - sibilant[i];

  const attackCoeff = Math.exp(-1 / (rate * 0.002));
  const releaseCoeff = Math.exp(-1 / (rate * 0.05));
  const envelope = new Float32Array(samples.length);
  let env = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(sibilant[i]);
    env =
      v > env
        ? attackCoeff * env + (1 - attackCoeff) * v
        : releaseCoeff * env + (1 - releaseCoeff) * v;
    envelope[i] = env;
  }

  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
  const overallRms = Math.sqrt(sumSq / Math.max(1, samples.length));
  const thresholdRatio = 1.6 - (amount / 100) * 0.9; // higher amount -> lower, more sensitive threshold
  const threshold = Math.max(1e-6, overallRms * thresholdRatio);
  const reductionDepth = 0.3 + (amount / 100) * 0.6; // higher amount -> deeper reduction

  const processed = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const gain = envelope[i] > threshold ? Math.pow(threshold / envelope[i], reductionDepth) : 1;
    processed[i] = rest[i] + sibilant[i] * gain;
  }
  return wetDry(samples, processed, amount);
}

// ---------------------------------------------------------------------------
// 4. Compressor
// ---------------------------------------------------------------------------

/**
 * Feed-forward peak-detector compressor: one-pole attack/release envelope
 * follower, hard-knee threshold/ratio gain curve in dB, automatic makeup
 * gain (70% of the average gain reduction while compressing, so the output
 * isn't just quieter) unless `makeupDb` is given. Defaults (ratio ~3:1,
 * -24 dB threshold) are tuned for gentle leveling, not limiting-style squash.
 */
export function compress(
  samples,
  rate,
  { thresholdDb = -24, ratio = 3, attackMs = 5, releaseMs = 60, makeupDb = null, amount = 100 } = {}
) {
  const attackCoeff = Math.exp(-1 / (rate * (attackMs / 1000)));
  const releaseCoeff = Math.exp(-1 / (rate * (releaseMs / 1000)));
  const n = samples.length;
  const envelope = new Float32Array(n);
  let env = 1e-6;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(samples[i]);
    env =
      v > env
        ? attackCoeff * env + (1 - attackCoeff) * v
        : releaseCoeff * env + (1 - releaseCoeff) * v;
    envelope[i] = env;
  }
  const gainDb = new Float32Array(n);
  let reductionSum = 0,
    reductionCount = 0;
  for (let i = 0; i < n; i++) {
    const envDb = 20 * Math.log10(Math.max(envelope[i], 1e-9));
    if (envDb > thresholdDb) {
      const reduction = (thresholdDb - envDb) * (1 - 1 / ratio);
      gainDb[i] = reduction;
      reductionSum += reduction;
      reductionCount++;
    }
  }
  const autoMakeup = reductionCount
    ? Math.min(24, Math.max(0, -0.7 * (reductionSum / reductionCount)))
    : 0;
  const makeupLinear = trimGain(makeupDb ?? autoMakeup);
  const processed = new Float32Array(n);
  for (let i = 0; i < n; i++) processed[i] = samples[i] * trimGain(gainDb[i]) * makeupLinear;
  return wetDry(samples, processed, amount);
}

// ---------------------------------------------------------------------------
// 5. Loudness normalisation + true-peak limiter
// ---------------------------------------------------------------------------

export const LOUDNESS_PRESETS = {
  podcast: { targetLufs: -16, targetPeakDb: -1, label: 'Podcast (−16 LUFS, −1 dBTP)' },
  music: { targetLufs: -14, targetPeakDb: -1, label: 'Music (−14 LUFS, −1 dBTP)' },
};

// Sliding-window minimum of the per-sample "gain needed to stay under the
// ceiling", looking `lookahead` samples ahead so the limiter can start
// pulling gain down before a peak arrives instead of clipping it.
function lookaheadMinimum(target, lookahead) {
  const n = target.length;
  const windowed = new Float32Array(n);
  const deque = [];
  for (let i = n - 1; i >= 0; i--) {
    while (deque.length && target[deque[deque.length - 1]] >= target[i]) deque.pop();
    deque.push(i);
    while (deque[0] > i + lookahead) deque.shift();
    windowed[i] = target[deque[0]];
  }
  return windowed;
}

function computeLookaheadGain(samples, rate, ceilingLinear, lookaheadMs = 3, releaseMs = 50) {
  const n = samples.length;
  const lookahead = Math.max(1, Math.round((rate * lookaheadMs) / 1000));
  const target = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(samples[i]);
    target[i] = a > ceilingLinear ? ceilingLinear / a : 1;
  }
  const windowed = lookaheadMinimum(target, lookahead);
  const attackCoeff = Math.exp(-1 / Math.max(1, rate * 0.0005));
  const releaseCoeff = Math.exp(-1 / Math.max(1, rate * (releaseMs / 1000)));
  const gain = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    const t = windowed[i];
    const coeff = t < g ? attackCoeff : releaseCoeff;
    g = coeff * g + (1 - coeff) * t;
    gain[i] = g;
  }
  return gain;
}

/**
 * Gentle true-peak limiter: a short lookahead (3 ms) + ~50 ms release
 * envelope smooths gain down before a peak and back up afterwards, instead
 * of hard per-sample clipping. That smoothing can itself overshoot the
 * ceiling slightly (and true peak is 4x-oversampled, so it can exceed what a
 * sample-domain pass alone catches), so this re-measures true peak with the
 * shared BS.1770 meter and, if still over, applies one or two small global
 * trims until it converges. This is a simplification documented up front:
 * it is not a sample-accurate ISP brick-wall limiter.
 */
function limitTruePeak(samples, rate, targetPeakDb) {
  let signal = samples;
  const ceilingLinear = trimGain(targetPeakDb - 0.3); // headroom for inter-sample peaks
  for (let pass = 0; pass < 4; pass++) {
    const { truePeak } = measureLoudness(signal, rate);
    if (!Number.isFinite(truePeak) || truePeak <= targetPeakDb + 0.05) break;
    if (pass === 0) {
      const gain = computeLookaheadGain(signal, rate, ceilingLinear);
      const next = new Float32Array(signal.length);
      for (let i = 0; i < signal.length; i++) next[i] = signal[i] * gain[i];
      signal = next;
    } else {
      const trim = trimGain(targetPeakDb - truePeak - 0.05);
      const next = new Float32Array(signal.length);
      for (let i = 0; i < signal.length; i++) next[i] = signal[i] * trim;
      signal = next;
    }
  }
  return signal;
}

/**
 * Measures integrated loudness with the shared ProgrammeMeter, computes the
 * linear gain to move it to `targetLufs` (mirroring masterOutput.js's
 * targetLufs/targetPeak/trimGain conventions), applies it, then runs the
 * true-peak limiter if the gained signal would exceed `targetPeakDb`.
 */
export function normalizeLoudness(
  samples,
  rate,
  { targetLufs = -16, targetPeakDb = -1, amount = 100 } = {}
) {
  const before = measureLoudness(samples, rate);
  const gain = Number.isFinite(before.integrated) ? trimGain(targetLufs - before.integrated) : 1;
  const gained = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) gained[i] = samples[i] * gain;
  const afterGain = measureLoudness(gained, rate);
  const processed =
    Number.isFinite(afterGain.truePeak) && afterGain.truePeak > targetPeakDb
      ? limitTruePeak(gained, rate, targetPeakDb)
      : gained;
  return wetDry(samples, processed, amount);
}

// ---------------------------------------------------------------------------
// 6. Full chain
// ---------------------------------------------------------------------------

export const CLEAN_STAGE_ORDER = ['highPass', 'denoise', 'deEss', 'compress', 'normalize'];

const STAGE_FN = {
  highPass,
  denoise: spectralDenoise,
  deEss,
  compress,
  normalize: normalizeLoudness,
};

/**
 * Runs the enabled stages in the fixed house order, each respecting its own
 * `enabled`/`amount`, and returns the result plus a before/after loudness
 * snapshot (via the shared meter) for the page's before/after display.
 */
export function processChain(samples, rate, stages = {}) {
  const before = measureLoudness(samples, rate);
  let out = samples;
  for (const name of CLEAN_STAGE_ORDER) {
    const config = stages[name];
    if (!config?.enabled) continue;
    out = STAGE_FN[name](out, rate, config);
  }
  const after = measureLoudness(out, rate);
  return { samples: out, before, after };
}
