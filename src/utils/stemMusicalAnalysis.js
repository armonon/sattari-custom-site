import { analysisChannel, compactWindow } from './analysisMono';
import { analyzeAutoKey, AUTO_KEY_ENGINE, AUTO_KEY_MIN_MARGIN } from './sattariAutoKey';
import { chromaForRange } from './audioAnalysis';
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

/**
 * The beat tracker works on 20 ms frames, so its period is a whole number of
 * frames: 128 BPM comes out as 130, 174 as 176. This searches within 4% of that
 * period on a 5 ms onset envelope for the period whose multiples line up best,
 * then for the offset that puts the beats on the onsets.
 * Returns { period, time } in seconds; time is one beat near the window start.
 */
export function refineBeat(samples, rate, period) {
  const hop = Math.max(1, Math.round(rate / 200));
  const fps = rate / hop;
  const frames = Math.floor(samples.length / hop);
  if (!(period > 0) || frames < 8 * period * fps) return { period, time: 0 };
  const level = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let energy = 0;
    for (let i = frame * hop; i < (frame + 1) * hop; i++) energy += samples[i] * samples[i];
    level[frame] = Math.sqrt(energy / hop);
  }
  // Onsets only: rises in level.
  const onset = new Float32Array(frames);
  for (let frame = 1; frame < frames; frame++)
    onset[frame] = Math.max(0, level[frame] - level[frame - 1]);
  const at = (position) => {
    const index = Math.floor(position);
    if (index < 0 || index + 1 >= frames) return 0;
    const part = position - index;
    return onset[index] * (1 - part) + onset[index + 1] * part;
  };
  const coarse = period * fps;
  let best = coarse,
    bestScore = -1;
  for (let step = -80; step <= 80; step++) {
    const lag = coarse * (1 + step * 0.0005);
    let score = 0;
    for (const multiple of [1, 2, 4, 8])
      for (let frame = 0; frame < frames; frame++)
        if (onset[frame] > 0) score += onset[frame] * at(frame + lag * multiple);
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  let offset = 0,
    offsetScore = -1;
  for (let start = 0; start < best; start += 0.5) {
    let score = 0;
    for (let position = start; position < frames - 1; position += best) score += at(position);
    if (score > offsetScore) {
      offsetScore = score;
      offset = start;
    }
  }
  // An onset frame holds the rise that ended in it: the attack began a frame earlier.
  return { period: best / fps, time: Math.max(0, (offset - 0.5) / fps) };
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
  const useChannel = analysisChannel(leftEnergy, rightEnergy, mixEnergy);
  const autoKey =
    !silent && duration >= 3 && stem !== 'drums'
      ? analyzeAutoKey(left, right, rate, useChannel)
      : null;
  if (!silent && duration >= 3) {
    for (const window of windows) {
      const part = compactWindow(left, right, rate, window, useChannel);
      // AutoKey adds subharmonic hypotheses for key scoring, not note naming.
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
        const period = median(intervals);
        const fine = refineBeat(part.samples, part.rate, period);
        tempos.push({
          bpm: 60 / fine.period,
          confidence: tempo.confidence,
          // Where a beat actually falls in the song, for lining a click up with it.
          anchor: {
            time: Math.round((window.start + fine.time) * 1e4) / 1e4,
            period: Math.round(fine.period * 1e5) / 1e5,
          },
        });
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
    tonal && notes.length >= 3 && ranked[0].weight < 0.7 && autoKey?.valid ? autoKey : null;
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
    keyEngine: AUTO_KEY_ENGINE,
    keyEngineVersion: 1,
    keyConfidence: keyResult?.confidence ?? null,
    keyAlternative: keyResult?.alternative?.key || null,
    keyAnalyzedSeconds: autoKey ? rounded(duration) : 0,
    keyEvidence: keyResult
      ? keyResult.confidence >= AUTO_KEY_MIN_MARGIN
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
    // One measured beat per analyzed window: [{ time, period }] in seconds.
    beatAnchors: consistentTempo ? tempos.map((tempo) => tempo.anchor) : [],
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
