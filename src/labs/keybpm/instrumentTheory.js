import { fft, nextPowerOfTwo } from '../clean/fft';
import { detectFundamental } from '../../loop/pitch';
import { musicalAccidentals, parseTonic, spellInterval } from '../../utils/noteSpelling';

export const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const INSTRUMENTS = {
  guitar: { name: 'Guitar · standard', notes: [40, 45, 50, 55, 59, 64] },
  'drop-d': { name: 'Guitar · drop D', notes: [38, 45, 50, 55, 59, 64] },
  bass: { name: 'Bass · four strings', notes: [28, 33, 38, 43] },
  'bass-five': { name: 'Bass · five strings', notes: [23, 28, 33, 38, 43] },
  violin: { name: 'Violin', notes: [55, 62, 69, 76] },
  viola: { name: 'Viola', notes: [48, 55, 62, 69] },
  cello: { name: 'Cello', notes: [36, 43, 50, 57] },
  ukulele: { name: 'Ukulele · high G', notes: [67, 60, 64, 69] },
  chromatic: { name: 'Chromatic · any single note', notes: [] },
};
export const SCALES = {
  major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  minor: { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  'major-pentatonic': {
    name: 'Major pentatonic',
    degrees: [0, 1, 2, 4, 5, 7],
    steps: [0, 2, 4, 7, 9, 12],
  },
  'minor-pentatonic': {
    name: 'Minor pentatonic',
    degrees: [0, 2, 3, 4, 6, 7],
    steps: [0, 3, 5, 7, 10, 12],
  },
  blues: { name: 'Minor blues', degrees: [0, 2, 3, 3, 4, 6, 7], steps: [0, 3, 5, 6, 7, 10, 12] },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10, 12] },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10, 12] },
};
export const noteLabel = (midi) =>
  `${PITCH_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const noteFrequency = (midi, reference = 440) => reference * 2 ** ((midi - 69) / 12);
export const centsFrom = (frequency, midi, reference = 440) =>
  1200 * Math.log2(frequency / noteFrequency(midi, reference));
export const scaleNotes = (root, scale, octave = 3) =>
  (SCALES[scale] || SCALES.major).steps.map((step) => 12 * (octave + 1) + Number(root) + step);

export function spelledScale(root, scale, octave) {
  const tonic = parseTonic(root);
  const pattern = SCALES[scale] || SCALES.major;
  return pattern.steps.map((step, i) => {
    const note = spellInterval(tonic, octave, step, pattern.degrees?.[i] ?? i);
    return { midi: note.midi, label: musicalAccidentals(note.name) + note.octave };
  });
}

// YIN provides the periodicity check. A windowed spectrum resolves ambiguous
// octave candidates and refines short periods that span only a few samples.
export function detectTunerPitch(samples, rate) {
  // Allow a rough second-harmonic estimate above 4 kHz at the upper edge.
  // The final measured fundamental must still be within 25–2000 Hz.
  const pitch = detectFundamental(samples, rate, 24, 4500, 0.004);
  if (!pitch) return null;
  if (pitch.frequency < 350 && pitch.clarity >= 0.995) return pitch.frequency >= 25 ? pitch : null;
  const size = nextPowerOfTwo(samples.length * 2);
  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  for (let i = 0; i < samples.length; i++) {
    real[i] = samples[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / samples.length));
  }
  fft(real, imag);
  const binHz = rate / size;
  const amplitude = new Float64Array(size / 2);
  for (let i = 1; i < amplitude.length; i++) amplitude[i] = Math.hypot(real[i], imag[i]);

  // Only actual local peaks count as partials. A strong nearby partial can
  // otherwise masquerade as a quieter fundamental through spectral leakage.
  function partial(expected, tolerance = 0.007) {
    const center = expected / binHz;
    const margin = Math.max(1, center * tolerance);
    const end = Math.min(amplitude.length - 2, Math.ceil(center + margin));
    let best = null;
    for (let k = Math.max(2, Math.floor(center - margin)); k <= end; k++) {
      const level = amplitude[k];
      if (
        !level ||
        level <= (best?.level ?? 0) ||
        level < amplitude[k - 1] ||
        level < amplitude[k + 1]
      )
        continue;
      const left = Math.log(Math.max(1e-30, amplitude[k - 1]) / level);
      const right = Math.log(Math.max(1e-30, amplitude[k + 1]) / level);
      const delta = left + right ? (0.5 * (left - right)) / (left + right) : 0;
      const frequency = (k + delta) * binHz;
      if (Math.abs(frequency - expected) <= Math.max(binHz * 0.6, expected * tolerance))
        best = { frequency, level };
    }
    return best;
  }

  function strongestHarmonic(candidate, count, tolerance) {
    let frequency = candidate;
    let level = 0;
    for (let n = 1; n <= count; n++) {
      const peak = partial(candidate * n, tolerance);
      if (peak && peak.level > level) {
        frequency = peak.frequency / n;
        level = peak.level;
      }
    }
    return { frequency, level };
  }

  // A high note can have as few as six samples per cycle. Anchor the
  // rough period to a measurable partial before comparing narrow peaks.
  const estimate =
    pitch.frequency < 350
      ? pitch.frequency
      : strongestHarmonic(pitch.frequency, 6, pitch.frequency > 2000 ? 0.045 : 0.025).frequency;
  let candidate = estimate;
  const parts = [1, 2, 3, 4, 5, 6].map((n) => partial(estimate * n)?.level ?? 0);
  const strongest = Math.max(...parts);
  if (strongest > 0) {
    const half = estimate / 2;
    const oddBelow = [1, 3, 5].map((n) => partial(half * n)?.level ?? 0);
    // Odd partials distinguish alternating cycles from two repetitions
    // of a higher string. A single faint peak cannot pull a note down an octave.
    if (
      half >= 25 &&
      pitch.clarity < 0.995 &&
      (oddBelow[0] > strongest * 0.14 || oddBelow.filter((a) => a > strongest * 0.075).length >= 2)
    ) {
      candidate = half;
    } else if (
      estimate >= 350 &&
      estimate * 2 <= 2020 &&
      Math.max(parts[0], parts[2], parts[4]) < strongest * 0.055 &&
      (parts[1] >= strongest * 0.25 ||
        (parts[3] >= strongest * 0.25 && parts[5] >= strongest * 0.12))
    ) {
      // A short, bright note can skip YIN's first threshold crossing.
      // Only double if there is positive support and no significant odd partial.
      candidate *= 2;
    } else if (
      estimate >= 350 &&
      estimate * 1.5 <= 2020 &&
      Math.max(parts[0], parts[1]) < strongest * 0.055 &&
      parts[2] >= strongest * 0.5 &&
      (partial(estimate * 1.5)?.level ?? 0) > strongest * 0.12
    ) {
      // If the first two partials are absent, a third harmonic alone can
      // explain YIN's spurious subharmonic. Require a real peak between them.
      candidate *= 1.5;
    }
  }
  const frequency =
    candidate === estimate ? estimate : strongestHarmonic(candidate, 3, 0.007).frequency;
  if (frequency < 25 || frequency > 2000) return null;
  const semitones = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(semitones);
  return { ...pitch, frequency, midi, cents: Math.round((semitones - midi) * 100) };
}
