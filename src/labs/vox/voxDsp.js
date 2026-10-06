// Vox alpha DSP: offline pitch tracking, scale snapping and TD-PSOLA pitch
// shifting for a single monophonic vocal. Pure functions, no Web Audio, so the
// same code runs in the worker and in unit tests. Written for this repo; no
// third-party DSP code (Rubber Band and similar GPL libraries are not used).
import { detectFundamental, reduceSampleRate } from '../../loop/pitch';
import { decideSongKey } from '../../loop/autoKey';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const HARMONY_STEPS = { third: 2, fifth: 4 };
export const VOX_MAX_SECONDS = 180;

const PITCH_RATE = 11025;
const FRAME = 1024;
const HOP = 128;
const MIN_HZ = 75;
const MAX_HZ = 1000;

const wrap12 = (value) => ((value % 12) + 12) % 12;
export const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
export const midiToName = (midi) =>
  `${NOTE_NAMES[wrap12(Math.round(midi))]}${Math.floor(Math.round(midi) / 12) - 1}`;

export function parseKey(text) {
  const match = /^([A-G](?:#|b)?)\s*(major|minor|chromatic)?$/i.exec(String(text || '').trim());
  if (!match) return null;
  const flats = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
  const name = flats[match[1]] || match[1].toUpperCase();
  const root = NOTE_NAMES.indexOf(name);
  if (root < 0) return null;
  return { root, mode: (match[2] || 'major').toLowerCase() };
}

export function keyLabel({ root, mode }) {
  return mode === 'chromatic' ? 'Chromatic' : `${NOTE_NAMES[root]} ${mode}`;
}

/** Pitch classes of the scale, as offsets from C. */
export function scalePitchClasses(root, mode) {
  return (SCALES[mode] || SCALES.major).map((step) => wrap12(root + step));
}

/** The nearest MIDI note (integer) whose pitch class is in the scale. */
export function snapToScale(midi, root, mode) {
  const classes = scalePitchClasses(root, mode);
  let best = Math.round(midi);
  let distance = Infinity;
  for (let candidate = Math.floor(midi) - 2; candidate <= Math.ceil(midi) + 2; candidate++) {
    if (!classes.includes(wrap12(candidate))) continue;
    const d = Math.abs(candidate - midi);
    if (d < distance - 1e-9) {
      distance = d;
      best = candidate;
    }
  }
  return best;
}

/** The scale note `steps` degrees above an in-scale MIDI note (3rd = 2, 5th = 4). */
export function diatonicAbove(midi, root, mode, steps) {
  if (mode === 'chromatic') return midi + (steps === 2 ? 4 : steps === 4 ? 7 : steps);
  const classes = scalePitchClasses(root, mode);
  let note = midi;
  for (let moved = 0; moved < steps; ) {
    note += 1;
    if (classes.includes(wrap12(note))) moved++;
  }
  return note;
}

function median3(a, b, c) {
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
}

/**
 * YIN pitch track (the same detector Learn uses) at about 11 kHz, 11.6 ms hop.
 * f0 is 0 for unvoiced frames. Very short voiced islands are dropped, and a
 * 3-frame median removes single-frame octave glitches.
 */
export function trackPitch(samples, rate, onProgress = () => {}) {
  const reduced = reduceSampleRate(samples, rate, PITCH_RATE);
  const data = reduced.samples;
  const pitchRate = reduced.rate;
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const floor = Math.max(0.0015, peak * 0.03);
  const frames = Math.max(0, Math.floor((data.length - FRAME) / HOP) + 1);
  const raw = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    const at = frame * HOP;
    const result = detectFundamental(
      data.subarray(at, at + FRAME),
      pitchRate,
      MIN_HZ,
      MAX_HZ,
      floor
    );
    raw[frame] = result ? result.frequency : 0;
    if (frame % 200 === 0) onProgress(frame / Math.max(1, frames));
  }
  const f0 = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    if (!raw[i]) continue;
    const a = raw[i - 1] || raw[i],
      c = raw[i + 1] || raw[i];
    f0[i] = median3(a, raw[i], c);
  }
  // Drop voiced islands shorter than 4 frames (~45 ms): breaths and consonants.
  for (let i = 0; i < frames; ) {
    if (!f0[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end < frames && f0[end]) end++;
    if (end - i < 4) f0.fill(0, i, end);
    i = end;
  }
  onProgress(1);
  // Frame centre in seconds: (frame * HOP + FRAME / 2) / pitchRate.
  return { f0, hopSeconds: HOP / pitchRate, offsetSeconds: FRAME / 2 / pitchRate };
}

export function pitchAt(track, seconds) {
  const index = Math.round((seconds - track.offsetSeconds) / track.hopSeconds);
  if (index < 0 || index >= track.f0.length) return 0;
  return track.f0[index];
}

export function voicedRatio(track) {
  if (!track.f0.length) return 0;
  let voiced = 0;
  for (const value of track.f0) if (value > 0) voiced++;
  return voiced / track.f0.length;
}

/** Key from the sung notes: pitch-class durations scored with Sattari AutoKey's profiles. */
export function detectVocalKey(track) {
  const histogram = Array(12).fill(0);
  let voiced = 0;
  for (const hz of track.f0) {
    if (!hz) continue;
    voiced++;
    histogram[wrap12(Math.round(hzToMidi(hz)))] += 1;
  }
  const distinct = histogram.filter((value) => value > voiced * 0.02).length;
  if (voiced * track.hopSeconds < 2 || distinct < 3)
    return { valid: false, reason: voiced ? 'few-notes' : 'no-voice' };
  // decideSongKey expects the native A-indexed pitch-class profile.
  const pcp = histogram.map((_, index) => histogram[(index + 9) % 12]);
  const result = decideSongKey(pcp);
  if (!result.valid) return { valid: false, reason: 'ambiguous' };
  return {
    valid: true,
    root: result.root,
    mode: result.minor ? 'minor' : 'major',
    margin: result.margin,
    alternative: result.alternative?.key || null,
  };
}

/**
 * Per-frame pitch shift in semitones for the lead (and optional harmony).
 * strength 0..1 is how much of the distance to the scale note is removed;
 * speedMs is the glide time toward a new target note (0 = instant/robotic).
 */
export function correctionCurve(track, { root, mode, strength = 1, speedMs = 40, harmony = null }) {
  const n = track.f0.length;
  const lead = new Float32Array(n);
  const harm = new Float32Array(n);
  const alpha = speedMs > 0 ? 1 - Math.exp(-(track.hopSeconds * 1000) / speedMs) : 1;
  const steps = HARMONY_STEPS[harmony] || 0;
  let target = null;
  let smoothed = null;
  for (let i = 0; i < n; i++) {
    const hz = track.f0[i];
    if (!hz) {
      target = null;
      smoothed = null;
      continue;
    }
    const midi = hzToMidi(hz);
    const snapped = snapToScale(midi, root, mode);
    // Hysteresis: keep the current note until the voice is clearly nearer another.
    if (
      target === null ||
      (snapped !== target && Math.abs(midi - target) - Math.abs(midi - snapped) > 0.2)
    )
      target = snapped;
    smoothed = smoothed === null ? target : smoothed + alpha * (target - smoothed);
    const leadShift = Math.max(-6, Math.min(6, strength * (smoothed - midi)));
    lead[i] = leadShift;
    if (steps) harm[i] = leadShift + (diatonicAbove(target, root, mode, steps) - target);
  }
  return { lead, harmony: steps ? harm : null };
}

function curveAt(track, curve, seconds) {
  const position = (seconds - track.offsetSeconds) / track.hopSeconds;
  const i = Math.floor(position);
  if (i < 0) return curve[0] || 0;
  if (i >= curve.length - 1) return curve[curve.length - 1] || 0;
  const t = position - i;
  return curve[i] * (1 - t) + curve[i + 1] * t;
}

/** Pitch-synchronous analysis marks at full rate: [{at, period, voiced}]. */
export function analysisMarks(samples, rate, track) {
  const marks = [];
  const unvoicedPeriod = Math.round(rate * 0.005);
  let position = 0;
  let wasVoiced = false;
  while (position < samples.length) {
    const hz = pitchAt(track, position / rate);
    if (hz > 0) {
      const period = rate / hz;
      let at = Math.round(position);
      // Lock onto the waveform's local maximum so grains are pitch-synchronous.
      const radius = Math.max(1, Math.round(wasVoiced ? period * 0.2 : period * 0.5));
      let best = at,
        bestValue = -Infinity;
      for (
        let j = Math.max(0, at - (wasVoiced ? radius : 0));
        j <= Math.min(samples.length - 1, at + radius);
        j++
      ) {
        if (samples[j] > bestValue) {
          bestValue = samples[j];
          best = j;
        }
      }
      if (marks.length && best <= marks[marks.length - 1].at) best = at;
      at = best;
      marks.push({ at, period, voiced: true });
      position = at + period;
      wasVoiced = true;
    } else {
      marks.push({ at: Math.round(position), period: unvoicedPeriod, voiced: false });
      position += unvoicedPeriod;
      wasVoiced = false;
    }
  }
  return marks;
}

/**
 * TD-PSOLA: Hann grains two analysis periods long, re-spaced at the shifted
 * period. Duration and formants are kept; amplitude is normalised by the
 * summed window so shifted passages keep their level.
 */
export function psola(samples, rate, track, curve, marks = analysisMarks(samples, rate, track)) {
  const n = samples.length;
  const out = new Float32Array(n);
  const weight = new Float32Array(n);
  if (!marks.length) return out;
  let k = 0;
  let synthesis = marks[0].at;
  while (synthesis < n) {
    while (
      k + 1 < marks.length &&
      Math.abs(marks[k + 1].at - synthesis) <= Math.abs(marks[k].at - synthesis)
    )
      k++;
    const mark = marks[k];
    const shift = mark.voiced ? curveAt(track, curve, synthesis / rate) : 0;
    const ratio = 2 ** (shift / 12);
    const half = Math.max(2, Math.round(mark.period));
    const center = Math.round(synthesis);
    for (let j = -half; j <= half; j++) {
      const target = center + j;
      const source = mark.at + j;
      if (target < 0 || target >= n || source < 0 || source >= n) continue;
      const w = 0.5 + 0.5 * Math.cos((Math.PI * j) / half);
      out[target] += samples[source] * w;
      weight[target] += w;
    }
    synthesis += mark.voiced ? mark.period / ratio : mark.period;
  }
  for (let i = 0; i < n; i++)
    out[i] = weight[i] > 0.25 ? out[i] / weight[i] : out[i] * 4 * weight[i];
  return out;
}

export function peakLevel(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak;
}

/** Corrected lead, optional harmony and a mix (harmony at `harmonyGain`), peak-limited to -1 dBFS. */
export function renderVox(samples, rate, track, options, marks) {
  const analysis = marks || analysisMarks(samples, rate, track);
  const curves = correctionCurve(track, options);
  const lead = psola(samples, rate, track, curves.lead, analysis);
  const harmony = curves.harmony ? psola(samples, rate, track, curves.harmony, analysis) : null;
  const gain = options.harmonyGain ?? 0.6;
  const mix = new Float32Array(lead.length);
  for (let i = 0; i < lead.length; i++) mix[i] = lead[i] + (harmony ? harmony[i] * gain : 0);
  const ceiling = 10 ** (-1 / 20);
  const peak = peakLevel(mix);
  if (peak > ceiling) {
    const scale = ceiling / peak;
    for (let i = 0; i < mix.length; i++) mix[i] *= scale;
  }
  return { lead, harmony, mix, curve: curves.lead };
}
