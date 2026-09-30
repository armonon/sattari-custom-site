import { fft } from 'demucs-web/fft';

// Browser port of SattariSongKeyEstimator.h, the current Auto Pitch file AutoKey
// path. Keep its A-indexed PCP, profiles, resampling and raw correlation margin.
// Source fingerprint and adapter differences: docs/STEM_SEPARATOR.md.
export const AUTO_KEY_ENGINE = 'sattari-autokey';
export const AUTO_KEY_MIN_MARGIN = 0.1;
const RATE = 16000;
const SIZE = 4096;
const BINS = SIZE / 2 + 1;
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR = [1, 0, 0.42, 0, 0.53, 0.37, 0, 0.77, 0, 0.38, 0.21, 0.3];
const MINOR = [1, 0, 0.36, 0.39, 0, 0.38, 0, 0.74, 0.27, 0, 0.42, 0.23];
const HARMONICS = [
  [0, 3],
  [12 * Math.log2(3) - 12, 1],
  [12 * Math.log2(5) - 24, 1 / Math.max(1, 0.5 * Math.log2(5))],
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const wrap = (value) => ((value % 12) + 12) % 12;
const window = Float32Array.from(
  { length: SIZE },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1))
);
const areaScale = Math.fround(2 / window.reduce((sum, value) => sum + value, 0));
for (let i = 0; i < SIZE; i++) window[i] *= areaScale;

function correlation(pcp, profile, shift) {
  const pcpMean = pcp.reduce((sum, value) => sum + value, 0) / 12;
  const profileMean = profile.reduce((sum, value) => sum + value, 0) / 12;
  let numerator = 0,
    pcpEnergy = 0,
    profileEnergy = 0;
  for (let i = 0; i < 12; i++) {
    const a = pcp[i] - pcpMean;
    const b = profile[wrap(i - shift)] - profileMean;
    numerator += a * b;
    pcpEnergy += a * a;
    profileEnergy += b * b;
  }
  const denominator = Math.sqrt(pcpEnergy * profileEnergy);
  return denominator > 1e-30 ? numerator / denominator : -1;
}

function candidate(index) {
  const root = ((index % 12) + 9) % 12;
  const minor = index >= 12;
  return { root, minor, key: `${NOTES[root]} ${minor ? 'minor' : 'major'}` };
}

function decide(pcp) {
  const scores = Array(24).fill(-1);
  let majorIndex = 0,
    minorIndex = 12;
  for (let shift = 0; shift < 12; shift++) {
    scores[shift] = correlation(pcp, MAJOR, shift);
    scores[shift + 12] = correlation(pcp, MINOR, shift);
    if (scores[shift] > scores[majorIndex]) majorIndex = shift;
    if (scores[shift + 12] > scores[minorIndex]) minorIndex = shift + 12;
  }
  const winner = scores[minorIndex] >= scores[majorIndex] ? minorIndex : majorIndex;
  if (!Number.isFinite(scores[winner]) || scores[winner] <= -1)
    return { valid: false, key: null, confidence: 0, alternative: null };
  let alternative = -1;
  for (let i = 0; i < scores.length; i++) {
    if (i !== winner && (alternative < 0 || scores[i] > scores[alternative])) alternative = i;
  }
  return {
    valid: true,
    ...candidate(winner),
    confidence: clamp(scores[winner] - scores[alternative], 0, 1),
    alternative: { ...candidate(alternative), score: scores[alternative] },
  };
}

export class SattariAutoKey {
  constructor(sampleRate, totalSamples) {
    if (
      !Number.isFinite(sampleRate) ||
      sampleRate <= 0 ||
      !Number.isSafeInteger(totalSamples) ||
      totalSamples <= 0
    )
      throw new Error('AutoKey requires a sample rate and a complete audio length.');
    this.ratio = sampleRate / RATE;
    this.target = Math.round(totalSamples / this.ratio);
    this.inputSamples = 0;
    this.outputSamples = 0;
    this.nextBoundary = this.boundary(1);
    this.bucketSum = 0;
    this.bucketCount = 0;
    this.lastInput = 0;
    this.frameFill = 0;
    this.frames = 0;
    this.finalised = false;
    this.frame = new Float32Array(SIZE);
    this.windowed = new Float32Array(SIZE);
    this.real = new Float32Array(SIZE);
    this.imaginary = new Float32Array(SIZE);
    this.spectrum = new Float32Array(BINS);
    this.pcp = new Float64Array(12);
  }

  boundary(count) {
    return Math.max(1, Math.round(count * this.ratio));
  }

  addSamples(samples) {
    if (this.finalised) return;
    for (const value of samples) {
      const sample = Number.isFinite(value) ? Math.fround(value) : 0;
      this.lastInput = sample;
      this.bucketSum += sample;
      this.bucketCount++;
      this.inputSamples++;
      while (this.inputSamples >= this.nextBoundary && this.outputSamples < this.target) {
        this.emit(this.bucketCount ? this.bucketSum / this.bucketCount : this.lastInput);
        this.bucketSum = 0;
        this.bucketCount = 0;
        this.nextBoundary = this.boundary(this.outputSamples + 1);
      }
    }
  }

  emit(sample) {
    this.frame[this.frameFill++] = sample;
    this.outputSamples++;
    if (this.frameFill === SIZE) {
      this.analyseFrame();
      this.frameFill = 0;
    }
  }

  finalise() {
    if (this.finalised) return;
    while (this.outputSamples < this.target) {
      this.emit(this.bucketCount ? this.bucketSum / this.bucketCount : this.lastInput);
      this.bucketSum = 0;
      this.bucketCount = 0;
    }
    if (this.frameFill) {
      this.frame.fill(0, this.frameFill);
      this.analyseFrame();
      this.frameFill = 0;
    }
    this.finalised = true;
  }

  analyseFrame() {
    for (let i = 0; i < SIZE; i++) this.windowed[i] = this.frame[i] * window[i];
    fft(this.real, this.imaginary, this.windowed, SIZE);
    const spectrum = this.spectrum;
    for (let i = 0; i < BINS; i++)
      spectrum[i] = Math.sqrt(this.real[i] ** 2 + this.imaginary[i] ** 2);
    const binHz = RATE / SIZE;
    const firstBin = Math.ceil(25 / binHz);
    const lastBin = Math.min(BINS - 2, Math.floor(3500 / binHz));
    const peaks = [];
    if (spectrum[firstBin] > spectrum[firstBin + 1] && spectrum[firstBin] > Math.fround(0.0001))
      peaks.push({ magnitude: spectrum[firstBin], frequency: firstBin * binHz });
    for (let bin = firstBin + 1; bin <= lastBin; bin++) {
      const left = spectrum[bin - 1],
        middle = spectrum[bin],
        right = spectrum[bin + 1];
      if (!(middle > left && middle >= right && middle > 0.0001)) continue;
      const denominator = left - 2 * middle + right;
      const delta = Math.abs(denominator) > 1e-30 ? (0.5 * (left - right)) / denominator : 0;
      peaks.push({
        magnitude: middle - 0.25 * (left - right) * delta,
        frequency: (bin + delta) * binHz,
      });
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude || a.frequency - b.frequency);
    peaks.length = Math.min(60, peaks.length);

    const envelope = new Float64Array(43);
    for (let point = 0; point < 43; point++) {
      const frequency = point * 100;
      const beginHz = frequency - Math.max(50, frequency * 0.34);
      const endHz = frequency + Math.max(50, frequency * 0.58);
      const begin = clamp(Math.floor((beginHz / 8000) * (BINS - 1) + 0.5), 0, BINS - 1);
      const end = clamp(Math.floor((endHz / 8000) * (BINS - 1) + 0.5), begin + 1, BINS);
      const centre = 0.5 * (begin + end);
      const halfLength = end - centre;
      let numerator = 0,
        denominator = 0;
      for (let bin = begin; bin < end; bin++) {
        const shape = (1 - Math.abs(bin - centre) / halfLength) ** 4;
        const energy = spectrum[bin] ** 2;
        const weight = shape * energy;
        numerator += energy * weight;
        denominator += weight;
      }
      const power = denominator > 0 ? numerator / denominator : 0;
      envelope[point] = power > 1e-30 ? 10 * Math.log10(power) : -300;
    }
    envelope[42] = envelope[41];
    const framePcp = new Float64Array(12);
    for (const { magnitude, frequency } of peaks) {
      const peakDb = 20 * Math.log10(Math.max(magnitude, 1e-30));
      const position = clamp(frequency / 100, 0, 42);
      const low = Math.floor(position),
        high = Math.min(42, low + 1);
      const localEnvelope = envelope[low] + (position - low) * (envelope[high] - envelope[low]);
      let whitenedDb = -200;
      if (peakDb > localEnvelope) whitenedDb = 0;
      else if (peakDb > localEnvelope - 30) whitenedDb = peakDb - localEnvelope;
      whitenedDb -= (20 * frequency) / 4000;
      const whitenedMagnitude = 10 ** (whitenedDb / 20);
      for (const [semitones, strength] of HARMONICS) {
        const pitch = frequency * 2 ** (-semitones / 12);
        const binPosition = 12 * Math.log2(pitch / 440);
        const energy = whitenedMagnitude ** 2 * strength ** 2;
        for (let bin = Math.ceil(binPosition - 0.5); bin <= Math.floor(binPosition + 0.5); bin++)
          framePcp[wrap(bin)] += Math.cos(Math.PI * Math.abs(binPosition - bin)) * energy;
      }
    }
    for (let i = 0; i < 12; i++) this.pcp[i] += framePcp[i];
    this.frames++;
  }

  result() {
    const chroma = Array.from(this.pcp, (value) => (this.frames ? value / this.frames : 0));
    const peak = Math.max(...chroma);
    for (let i = 0; i < 12; i++) {
      chroma[i] = peak > 1e-30 ? chroma[i] / peak : 0;
      if (chroma[i] < 0.2) chroma[i] = 0;
    }
    return { ...decide(chroma), chroma, frames: this.frames };
  }
}

// Bounded mono scratch space avoids another full-track allocation in the worker.
export function analyzeAutoKey(left, right, sampleRate, useChannel = null) {
  const estimator = new SattariAutoKey(sampleRate, left.length);
  const mono = new Float32Array(Math.min(16384, left.length));
  for (let start = 0; start < left.length; start += mono.length) {
    const length = Math.min(mono.length, left.length - start);
    for (let i = 0; i < length; i++) {
      const at = start + i;
      mono[i] =
        useChannel === 0 ? left[at] : useChannel === 1 ? right[at] : (left[at] + right[at]) / 2;
    }
    estimator.addSamples(mono.subarray(0, length));
  }
  estimator.finalise();
  return estimator.result();
}
