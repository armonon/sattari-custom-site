// Continuous audio-time clock. Tempo edits change the slope, never past beats.
export class SyncClock {
  constructor(bpm = 120, time = 0) {
    this.bpm = bpm;
    this.time = time;
    this.beat = 0;
  }
  beatAt(time) {
    return this.beat + ((time - this.time) * this.bpm) / 60;
  }
  setTempo(bpm, time) {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    this.beat = this.beatAt(time);
    this.time = time;
    this.bpm = bpm;
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
