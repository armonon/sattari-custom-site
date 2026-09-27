import { tempoAt } from './tempoMap';

// Continuous audio-time clock. Tempo edits change the slope, never past beats.
export class SyncClock {
  constructor(bpm = 120, time = 0, beat = 0) {
    this.bpm = bpm;
    this.time = time;
    this.beat = beat;
  }
  segmentAt(time) {
    const anchors = this.anchors || [];
    let index = -1;
    while (index + 1 < anchors.length && anchors[index + 1].time <= time) index++;
    return index < 0 ? this : anchors[index];
  }
  beatAt(time) {
    const segment = this.segmentAt(time);
    return segment.beat + ((time - segment.time) * segment.bpm) / 60;
  }
  bpmAt(time) {
    return this.segmentAt(time).bpm;
  }
  setTempo(bpm, time) {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    this.beat = this.beatAt(time);
    this.time = time;
    this.bpm = bpm;
    this.anchors = undefined;
  }
  // Replay queues a journaled tempo change ahead of the audio clock together with
  // the beat it had live. Queries before its time keep the previous slope.
  anchor(bpm, time, beat) {
    if (![bpm, time, beat].every(Number.isFinite) || bpm <= 0) return;
    const anchors = (this.anchors || []).filter((next) => next.time < time);
    // Nothing queries seconds before a newly queued change; fold that history.
    while (anchors.length && anchors[0].time <= time - 5) Object.assign(this, anchors.shift());
    anchors.push({ bpm, time, beat });
    this.anchors = anchors;
  }
}

export const phaseError = (target, actual, quantum = 1) =>
  target - actual - Math.round((target - actual) / quantum) * quantum;

// Map a source position to the same fractional beat coordinates used for local
// tempo following. Binary search keeps long sets cheap.
export function sourceBeat(position, grid) {
  const beats = grid.followTempoMap && grid.analysis?.tempoMap?.beats;
  if (!beats || beats.length < 2) return ((position - (grid.beatOffset || 0)) * grid.bpm) / 60;
  const at = (i) => (typeof beats[i] === 'number' ? beats[i] : beats[i].time);
  let lo = 0,
    hi = beats.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (at(mid) <= position) lo = mid;
    else hi = mid;
  }
  const span = at(hi) - at(lo);
  return lo + (position - at(lo)) / Math.max(0.001, span);
}

export function sourceTime(beat, grid) {
  const beats = grid.followTempoMap && grid.analysis?.tempoMap?.beats;
  if (!beats || beats.length < 2) return (grid.beatOffset || 0) + (beat * 60) / grid.bpm;
  const at = (i) => (typeof beats[i] === 'number' ? beats[i] : beats[i].time);
  const lo = Math.max(0, Math.min(beats.length - 2, Math.floor(beat)));
  return at(lo) + (beat - lo) * (at(lo + 1) - at(lo));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const tempoMapBeats = (grid) =>
  grid.followTempoMap && grid.analysis?.tempoMap?.beats?.length > 1
    ? grid.analysis.tempoMap.beats
    : null;

// Audible leader tempo: its local grid tempo at `position`, scaled by its rate.
export function leaderTempo(reference, position, rate) {
  const beats = tempoMapBeats(reference);
  return (beats ? tempoAt(beats, position) : reference.bpm) * rate;
}

// One step of the follower phase controller. Live playback and replay
// reconstruction share it so re-derived corrections cannot drift apart.
export function beatSyncCorrection({ position, grid, target, leaderBpm }) {
  const error = phaseError(target, sourceBeat(position, grid), grid.syncQuantum === 4 ? 4 : 1);
  const beats = tempoMapBeats(grid);
  const base = leaderBpm / (beats ? tempoAt(beats, position) : grid.bpm);
  // No repeated seek/restart: bounded phase slew, max +/-2% pitch-preserved.
  return { error, rate: clamp(base * (1 + clamp(error * 0.5, -0.02, 0.02)), 0.5, 2) };
}

export const tempoFollowRate = (targetBpm, beats, position) =>
  clamp(targetBpm / tempoAt(beats, position), 0.5, 2);
