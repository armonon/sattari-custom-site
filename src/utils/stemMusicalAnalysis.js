import { chromaForRange, estimateKeyFromChroma } from './audioAnalysis';
import { trackTempo } from './tempoMap';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const rounded = (value) => Math.round(value * 10) / 10;
const db = (value) => (value > 0 ? rounded(20 * Math.log10(value)) : null);
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];

export function musicalAnalysisWindows(duration) {
  const count = Math.min(3, Math.max(1, Math.ceil(duration / 20)));
  const length = Math.min(20, duration / count);
  return Array.from({ length: count }, (_, i) => {
    const start = count === 1 ? 0 : (i * (duration - length)) / (count - 1);
    return { start, end: start + length };
  });
}

function compactWindow(left, right, rate, window, useChannel) {
  const stride = Math.max(1, Math.floor(rate / 11025));
  const from = Math.floor(window.start * rate);
  const length = Math.floor((window.end * rate - from) / stride);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let offset = 0; offset < stride; offset++) {
      const at = from + i * stride + offset;
      sum +=
        useChannel === 0 ? left[at] : useChannel === 1 ? right[at] : (left[at] + right[at]) / 2;
    }
    samples[i] = sum / stride;
  }
  return { samples, rate: rate / stride };
}

function hasRhythmicDynamics(samples, rate) {
  const hop = Math.max(1, Math.round(rate * 0.05));
  const levels = [];
  for (let from = 0; from + hop <= samples.length; from += hop) {
    let energy = 0;
    for (let i = from; i < from + hop; i++) energy += samples[i] ** 2;
    levels.push(Math.sqrt(energy / hop));
  }
  levels.sort((a, b) => a - b);
  const high = levels[Math.floor(levels.length * 0.9)] || 0;
  const low = levels[Math.floor(levels.length * 0.1)] || 0;
  // Tiny energy fluctuations in sustained tones are not rhythmic onsets.
  return high > 0 && (high - low) / high >= 0.15;
}

export function analyzeStemAudio(left, right, rate, { stem = 'song', channels = 2 } = {}) {
  if (!left?.length || left.length !== right?.length || !Number.isFinite(rate) || rate <= 0)
    throw new Error('Invalid analysis audio.');
  let leftEnergy = 0,
    rightEnergy = 0,
    mixEnergy = 0,
    peak = 0;
  for (let i = 0; i < left.length; i++) {
    const l = left[i],
      r = right[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) throw new Error('Invalid audio samples.');
    leftEnergy += l * l;
    rightEnergy += r * r;
    mixEnergy += ((l + r) / 2) ** 2;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
  }
  const rms = Math.sqrt((leftEnergy + rightEnergy) / (left.length * 2));
  const duration = left.length / rate;
  const silent = rms < 10 ** (-65 / 20);
  const windows = silent || duration < 3 ? [] : musicalAnalysisWindows(duration);
  const chroma = Array(12).fill(0);
  const tempos = [];
  // Preserve antiphase material that would disappear in a simple stereo sum.
  const useChannel =
    mixEnergy < Math.max(leftEnergy, rightEnergy) * 0.05
      ? leftEnergy >= rightEnergy
        ? 0
        : 1
      : null;
  if (!silent && duration >= 3) {
    for (const window of windows) {
      const part = compactWindow(left, right, rate, window, useChannel);
      if (stem !== 'drums') {
        const pitches = chromaForRange(part.samples, part.rate, 0, 1, 20);
        pitches.forEach((value, i) => {
          chroma[i] += value / windows.length;
        });
      }
      if (!hasRhythmicDynamics(part.samples, part.rate)) continue;
      const tempo = trackTempo(part.samples, part.rate);
      const supported = tempo.beats.filter((beat) => !beat.inferred).length;
      if (tempo.confidence >= 0.55 && supported >= 6) {
        const intervals = tempo.beats.slice(1).map((beat, i) => beat.time - tempo.beats[i].time);
        tempos.push({ bpm: 60 / median(intervals), confidence: tempo.confidence });
      }
    }
  }
  const ranked = chroma
    .map((weight, i) => ({ note: NOTES[i], weight }))
    .sort((a, b) => b.weight - a.weight);
  const tonal = ranked.slice(0, 3).reduce((sum, note) => sum + note.weight, 0) >= 0.42;
  const notes = tonal
    ? ranked.filter(({ weight }) => weight >= Math.max(0.075, ranked[0].weight * 0.2)).slice(0, 5)
    : [];
  const keyResult =
    tonal && notes.length >= 3 && ranked[0].weight < 0.7 ? estimateKeyFromChroma(chroma) : null;
  const bpm = tempos.length ? median(tempos.map((tempo) => tempo.bpm)) : null;
  const consistentTempo =
    bpm !== null && tempos.every((tempo) => Math.abs(tempo.bpm - bpm) / bpm < 0.08);
  return {
    version: 1,
    status: 'ready',
    stem,
    duration,
    sampleRate: rate,
    channels,
    rmsDb: db(rms),
    peakDb: db(peak),
    key: keyResult?.key || null,
    keyEvidence: keyResult
      ? keyResult.confidence >= 0.55
        ? 'supported'
        : 'tentative'
      : 'insufficient',
    keyReason:
      stem === 'drums'
        ? 'percussion'
        : silent
          ? 'quiet'
          : duration < 3
            ? 'short'
            : !keyResult
              ? 'limited-harmony'
              : null,
    bpm: consistentTempo ? Math.round(bpm) : null,
    tempoEvidence: consistentTempo
      ? tempos.length === windows.length && tempos.every((tempo) => tempo.confidence >= 0.8)
        ? 'supported'
        : 'tentative'
      : 'insufficient',
    tempoReason: silent
      ? 'quiet'
      : duration < 3
        ? 'short'
        : !tempos.length
          ? 'no-pulse'
          : !consistentTempo
            ? 'variable'
            : null,
    prominentNotes: notes.map(({ note }) => note),
    analyzedSeconds: rounded(windows.reduce((sum, window) => sum + window.end - window.start, 0)),
    windows,
  };
}

// Analysis is optional metadata; a failed estimate must never discard valid stems.
export function safeAnalyzeStemAudio(...args) {
  try {
    return analyzeStemAudio(...args);
  } catch {
    return { version: 1, status: 'unavailable' };
  }
}
