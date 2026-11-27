// Beat grid for the stem player: beat times from the site's tempo tracker,
// bars assumed 4/4 with a user-adjustable bar start (downbeats are not
// detected), plus the pure helpers for snapping, bar loops and clicks.
import { trackTempo } from './tempoMap.js';

export const BEATS_PER_BAR = 4;
export const MIN_GRID_CONFIDENCE = 0.3;

/** Mono, ~11 kHz mix of the given channels for tempo tracking. */
export function rhythmSignal(channelSets, sampleRate) {
  const stride = Math.max(1, Math.floor(sampleRate / 11025));
  const frames = Math.max(...channelSets.map((channels) => channels[0].length));
  const out = new Float32Array(Math.floor(frames / stride));
  for (const channels of channelSets) {
    const [l, r = l] = channels;
    for (let i = 0; i < out.length; i++) {
      let sum = 0;
      for (let j = 0; j < stride; j++) {
        const at = i * stride + j;
        if (at < l.length) sum += (l[at] + r[at]) / 2;
      }
      out[i] += sum / stride;
    }
  }
  return { samples: out, rate: sampleRate / stride };
}

const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];

/** { beats: seconds[], bpm, confidence, usable } from a rhythm signal. */
export function computeBeatGrid(samples, rate) {
  const tempo = trackTempo(samples, rate);
  const beats = tempo.beats.map((beat) => beat.time).filter(Number.isFinite);
  const intervals = beats.slice(1).map((time, i) => time - beats[i]);
  const bpm = intervals.length ? 60 / median(intervals) : null;
  const usable =
    beats.length >= 8 && tempo.confidence >= MIN_GRID_CONFIDENCE && Number.isFinite(bpm);
  return {
    beats: usable ? beats : [],
    bpm: usable ? Math.round(bpm * 10) / 10 : null,
    confidence: tempo.confidence,
    usable,
  };
}

/** Index of the beat nearest to t (beats sorted ascending). */
export function nearestBeatIndex(beats, t) {
  if (!beats.length) return -1;
  let low = 0;
  let high = beats.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (beats[mid] < t) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && Math.abs(beats[low - 1] - t) <= Math.abs(beats[low] - t)) return low - 1;
  return low;
}

export const snapToBeat = (beats, t) => (beats.length ? beats[nearestBeatIndex(beats, t)] : t);

export const isDownbeat = (index, barOffset = 0) =>
  (((index - barOffset) % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0;

/** Start of the bar containing (or nearest before) t, for the bar offset. */
export function barStartIndex(beats, t, barOffset = 0) {
  let index = nearestBeatIndex(beats, t);
  if (index < 0) return -1;
  if (beats[index] > t + 0.05 && index > 0) index--;
  while (index > 0 && !isDownbeat(index, barOffset)) index--;
  return index;
}

/** { a, b } covering `bars` bars from the bar at t, or null past the grid. */
export function barLoop(beats, t, bars, barOffset = 0, duration = Infinity) {
  const start = barStartIndex(beats, t, barOffset);
  if (start < 0) return null;
  const endIndex = start + bars * BEATS_PER_BAR;
  let end;
  if (endIndex < beats.length) end = beats[endIndex];
  else {
    const interval =
      (beats.at(-1) - beats[Math.max(0, beats.length - 9)]) / Math.min(8, beats.length - 1);
    end = beats.at(-1) + (endIndex - beats.length + 1) * interval;
  }
  end = Math.min(end, duration);
  return end - beats[start] >= 0.25 ? { a: beats[start], b: end } : null;
}

/**
 * Click times on the playback timeline. Playback started at song position
 * `offset`, optionally looping [loopA, loopB). Returns [{ elapsed, downbeat }]
 * with elapsed in song seconds since start, within (fromElapsed, toElapsed].
 */
export function clicksBetween(
  beats,
  { offset, loopA = null, loopB = null, barOffset = 0 },
  fromElapsed,
  toElapsed
) {
  const out = [];
  const push = (elapsed, index) => {
    if (elapsed > fromElapsed && elapsed <= toElapsed)
      out.push({ elapsed, downbeat: isDownbeat(index, barOffset) });
  };
  const looping = loopA !== null && loopB !== null && loopB > loopA;
  const firstEnd = looping ? loopB : Infinity;
  for (let i = 0; i < beats.length; i++) {
    if (beats[i] < offset - 1e-6 || beats[i] >= firstEnd) continue;
    push(beats[i] - offset, i);
  }
  if (!looping) return out;
  const span = loopB - loopA;
  const firstPass = loopB - offset;
  const loopBeats = beats
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time >= loopA && time < loopB);
  for (
    let k = Math.max(0, Math.floor((fromElapsed - firstPass) / span));
    firstPass + k * span <= toElapsed;
    k++
  )
    for (const { time, index } of loopBeats) push(firstPass + k * span + (time - loopA), index);
  return out;
}

/**
 * Bar and beat at time t for the transport readout: { bar, beat } with bar 1
 * starting at the first downbeat (bar 0 is a pickup before it), or null
 * before the first beat or without a grid.
 */
export function beatPosition(beats, t, barOffset = 0) {
  if (!beats?.length || t < beats[0] - 0.05) return null;
  let index = nearestBeatIndex(beats, t);
  if (beats[index] > t + 0.05 && index > 0) index--;
  const relative = index - (((barOffset % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR);
  return {
    bar: Math.floor(relative / BEATS_PER_BAR) + 1,
    beat: (((relative % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR) + 1,
  };
}
