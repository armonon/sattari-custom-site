// Browser port of Sattari's model-free SongKeyEstimator, used by Sattari Key.
// Source: sattari-plugins-main/core/include/sattari_audio_core/SattariSongKeyEstimator.h
// SHA-256: 3a5077177165801c619790a498b3d39db7cd2ae0c447ff5fd02793e20af6d0bf
// See docs/LOOP_AUTOKEY.md for provenance, parity evidence and accuracy limits.
const RATE = 16000;
const SIZE = 4096;
const BINS = SIZE / 2 + 1;
const SECTION_FRAMES = 59;
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MAJOR = [1, 0, 0.42, 0, 0.53, 0.37, 0, 0.77, 0, 0.38, 0.21, 0.3];
const MINOR = [1, 0, 0.36, 0.39, 0, 0.38, 0, 0.74, 0.27, 0, 0.42, 0.23];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const zeros = () => Array(12).fill(0);

// Match the native rounded-bucket resampler, including its short final bucket.
export function keyResample(input, rate, target = RATE) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid audio sample rate.');
  const ratio = rate / target;
  const output = new Float32Array(Math.round(input.length / ratio));
  let cursor = 0;
  for (let i = 0; i < output.length; i++) {
    const boundary = Math.min(input.length, Math.max(1, Math.round((i + 1) * ratio)));
    let sum = 0;
    const start = cursor;
    while (cursor < boundary) {
      const v = input[cursor++];
      sum += Number.isFinite(v) ? v : 0;
    }
    const last = input[Math.max(0, cursor - 1)];
    output[i] = cursor > start ? sum / (cursor - start) : Number.isFinite(last) ? last : 0;
  }
  return output;
}

function createSpectrum() {
  const window = Float32Array.from(
    { length: SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1))
  );
  const scale = Math.fround(2 / window.reduce((a, b) => a + b, 0));
  for (let i = 0; i < SIZE; i++) window[i] *= scale;
  const reversed = new Uint16Array(SIZE);
  for (let i = 1; i < SIZE; i++) reversed[i] = (reversed[i >> 1] >> 1) | ((i & 1) << 11);
  const real = new Float64Array(SIZE),
    imaginary = new Float64Array(SIZE);
  const spectrum = new Float32Array(BINS);
  return (samples, offset) => {
    imaginary.fill(0);
    for (let i = 0; i < SIZE; i++)
      real[reversed[i]] = Math.fround((samples[offset + i] || 0) * window[i]);
    for (let length = 2; length <= SIZE; length *= 2) {
      const angle = (-2 * Math.PI) / length;
      const cr = Math.cos(angle),
        ci = Math.sin(angle);
      for (let start = 0; start < SIZE; start += length) {
        let wr = 1,
          wi = 0;
        for (let j = 0; j < length / 2; j++) {
          const a = start + j,
            b = a + length / 2;
          const tr = wr * real[b] - wi * imaginary[b];
          const ti = wr * imaginary[b] + wi * real[b];
          real[b] = real[a] - tr;
          imaginary[b] = imaginary[a] - ti;
          real[a] += tr;
          imaginary[a] += ti;
          const next = wr * cr - wi * ci;
          wi = wr * ci + wi * cr;
          wr = next;
        }
      }
    }
    for (let i = 0; i < BINS; i++) spectrum[i] = Math.hypot(real[i], imaginary[i]);
    return spectrum;
  };
}

function pitchClasses(spectrum) {
  const binHz = RATE / SIZE;
  const first = Math.ceil(25 / binHz),
    last = Math.floor(3500 / binHz);
  const peaks = [];
  if (spectrum[first] > spectrum[first + 1] && spectrum[first] > 0.0001)
    peaks.push({ magnitude: spectrum[first], frequency: first * binHz });
  for (let bin = first + 1; bin <= last; bin++) {
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
  const envelope = Array.from({ length: 43 }, (_, point) => {
    const frequency = point * 100;
    const begin = clamp(
      Math.floor((frequency - Math.max(50, frequency * 0.34)) / binHz + 0.5),
      0,
      BINS - 1
    );
    const end = clamp(
      Math.floor((frequency + Math.max(50, frequency * 0.58)) / binHz + 0.5),
      begin + 1,
      BINS
    );
    const center = (begin + end) / 2,
      half = end - center;
    let numerator = 0,
      denominator = 0;
    for (let bin = begin; bin < end; bin++) {
      const shape = (1 - Math.abs(bin - center) / half) ** 4;
      const energy = spectrum[bin] ** 2;
      numerator += energy * shape * energy;
      denominator += shape * energy;
    }
    const power = denominator > 0 ? numerator / denominator : 0;
    return power > 1e-30 ? 10 * Math.log10(power) : -300;
  });
  envelope[42] = envelope[41];
  const pcp = zeros();
  for (const peak of peaks.slice(0, 60)) {
    const point = clamp(peak.frequency / 100, 0, 42),
      lo = Math.floor(point);
    const local = envelope[lo] + (point - lo) * (envelope[Math.min(42, lo + 1)] - envelope[lo]);
    const db = 20 * Math.log10(Math.max(peak.magnitude, 1e-30));
    const whitenedDb =
      (db > local ? 0 : db > local - 30 ? db - local : -200) - (20 * peak.frequency) / 4000;
    const magnitude = 10 ** (whitenedDb / 20);
    for (const [semitones, strength] of [
      [0, 3],
      [12 * Math.log2(3) - 12, 1],
      [12 * Math.log2(5) - 24, 1 / Math.max(1, 0.5 * Math.log2(5))],
    ]) {
      const position = 12 * Math.log2((peak.frequency * 2 ** (-semitones / 12)) / 440);
      for (let bin = Math.ceil(position - 0.5); bin <= Math.floor(position + 0.5); bin++)
        pcp[((bin % 12) + 12) % 12] +=
          Math.cos(Math.PI * Math.abs(position - bin)) * magnitude ** 2 * strength ** 2;
    }
  }
  return pcp;
}

function gate(pcp) {
  const peak = Math.max(...pcp);
  return pcp.map((v) => (peak > 1e-30 && v / peak >= 0.2 ? v / peak : 0));
}

function correlation(pcp, profile, shift) {
  const aMean = pcp.reduce((a, b) => a + b, 0) / 12,
    bMean = profile.reduce((a, b) => a + b, 0) / 12;
  let numerator = 0,
    aEnergy = 0,
    bEnergy = 0;
  for (let i = 0; i < 12; i++) {
    const a = pcp[i] - aMean,
      b = profile[(i - shift + 12) % 12] - bMean;
    numerator += a * b;
    aEnergy += a * a;
    bEnergy += b * b;
  }
  const denominator = Math.sqrt(aEnergy * bEnergy);
  return denominator > 1e-30 ? numerator / denominator : -1;
}

export function decideSongKey(pcp) {
  const choices = [MAJOR, MINOR].flatMap((profile, mode) =>
    pcp.map((_, shift) => ({
      root: (shift + 9) % 12,
      minor: Boolean(mode),
      key: `${NAMES[(shift + 9) % 12]} ${mode ? 'minor' : 'major'}`,
      score: correlation(pcp, profile, shift),
    }))
  );
  // Native mode tie goes to minor, then the first shift in that mode.
  choices.sort((a, b) => b.score - a.score || Number(b.minor) - Number(a.minor));
  const [best, alternative] = choices;
  return best.score > -1 && Number.isFinite(best.score)
    ? { ...best, valid: true, margin: clamp(best.score - alternative.score, 0, 1), alternative }
    : { valid: false, margin: 0, key: null, alternative: null };
}

export function analyzeAutoKey(input, rate, onProgress = () => {}) {
  const samples = keyResample(input, rate);
  const spectrum = createSpectrum();
  const global = zeros();
  let section = zeros(),
    count = 0;
  const sections = [];
  const finish = (end) => {
    const result = decideSongKey(gate(section));
    if (result.valid)
      sections.push({ ...result, start: Math.max(0, end - (count * SIZE) / RATE), end });
    section = zeros();
    count = 0;
  };
  for (let offset = 0; offset < samples.length; offset += SIZE) {
    const pcp = pitchClasses(spectrum(samples, offset));
    for (let i = 0; i < 12; i++) {
      global[i] += pcp[i];
      section[i] += pcp[i];
    }
    if (++count === SECTION_FRAMES) finish((offset + SIZE) / RATE);
    if (offset % (SIZE * 16) === 0) onProgress(offset / samples.length);
  }
  if (count) finish((Math.ceil(samples.length / SIZE) * SIZE) / RATE);
  const chroma = gate(global),
    result = decideSongKey(chroma);
  const votes = new Map();
  let total = 0;
  for (const item of sections) {
    const weight = Math.max(0.01, item.margin);
    total += weight;
    votes.set(item.key, (votes.get(item.key) || 0) + weight);
  }
  const agreement = total ? (votes.get(result.key) || 0) / total : 0;
  const strongestAlternative = Math.max(
    0,
    ...[...votes].filter(([key]) => key !== result.key).map(([, vote]) => vote)
  );
  const pitchClassesFound = chroma.filter((v) => v > 0).length;
  // These UI abstention rules are deliberately separate from native inference.
  // A margin is NOT a probability; no percent-correct claim is made.
  const evidence =
    !result.valid || pitchClassesFound < 3
      ? 'insufficient'
      : result.margin < 0.08 || pitchClassesFound < 5 || samples.length / RATE < 4
        ? 'tentative'
        : 'supported';
  return {
    ...result,
    engine: 'Sattari Song Key',
    version: 1,
    evidence,
    chroma,
    pitchClassesFound,
    sections,
    agreement,
    possibleModulation:
      sections.length >= 3 && agreement < 0.65 && strongestAlternative / total >= 0.22,
  };
}
