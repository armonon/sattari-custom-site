// Fixed parallel input paths let automation change gain, monitoring and built-in
// input FX on the audio clock without connecting devices during replay.
export class ReplayInput {
  constructor(context, destination) {
    this.context = context;
    this.input = context.createGain();
    this.filter = context.createBiquadFilter();
    this.filter.type = 'highpass';
    this.compressor = context.createDynamicsCompressor();
    Object.assign(this.compressor.threshold, { value: -18 });
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;
    this.paths = ['direct', 'filtered', 'compressed'].map(() => context.createGain());
    for (const path of this.paths) {
      path.gain.value = 0;
      path.connect(destination);
    }
    this.input.connect(this.paths[0]);
    this.input.connect(this.filter);
    this.filter.connect(this.paths[1]);
    this.filter.connect(this.compressor);
    this.compressor.connect(this.paths[2]);
  }
  schedule(state, when, initial = false) {
    const number = (value, fallback, min, max) =>
      Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
    const set = (param, value) =>
      initial ? param.setValueAtTime(value, when) : param.setTargetAtTime(value, when, 0.005);
    set(this.input.gain, 10 ** (number(state.gainDb, 0, -60, 24) / 20));
    set(this.filter.frequency, number(state.highpass, 80, 20, 300));
    const audible = state.monitor && state.status === 'connected';
    const active = state.lowLatency ? 0 : state.compression ? 2 : 1;
    this.paths.forEach((path, index) => {
      // OFF is exact, matching the live safety gate. Preserve prior scheduled
      // events: never cancel the whole future automation from a lookahead pass.
      if (!audible || index !== active) path.gain.setValueAtTime(0, when);
      else set(path.gain, 1);
    });
  }
  dispose() {
    for (const node of [this.input, this.filter, this.compressor, ...this.paths]) node.disconnect();
  }
}
