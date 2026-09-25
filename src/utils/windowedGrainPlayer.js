import * as Tone from 'tone';

// Tone 15.1.22 compatibility adapter. The grain clock, envelopes, playback-rate
// compensation and graph remain Tone's; only each grain's source is paged.
// Guard with actual rendered-PCM comparisons when updating the pinned Tone version.
export class WindowedGrainPlayer extends Tone.GrainPlayer {
  constructor(source, pool, options = {}) {
    super(options);
    this.source = source;
    this.pool = pool;
    this.failure = null;
    this.underruns = 0;
    this.lastPrefetch = -1;
    this.leases = new Map();
  }
  get duration() {
    return this.source.duration;
  }
  get loopStart() {
    return super.loopStart;
  }
  set loopStart(value) {
    if (this.source && (!Number.isFinite(value) || value < 0 || value > this.duration))
      throw new Error('Loop start is outside the source.');
    super.loopStart = value;
  }
  get loopEnd() {
    return super.loopEnd;
  }
  set loopEnd(value) {
    if (this.source && (!Number.isFinite(value) || value < 0 || value > this.duration))
      throw new Error('Loop end is outside the source.');
    super.loopEnd = value;
  }
  prepareWindow(position, region = this) {
    return this.pool.prepare(this.source, position, region);
  }
  _tick(time) {
    const offset = this._clock.getTicksAtTime(time) * this._grainSize;
    if (!this.loop && offset >= this.duration) {
      this.stop(time);
      return;
    }
    if (offset >= this.lastPrefetch + 1 || offset < this.lastPrefetch) {
      this.lastPrefetch = offset;
      if (!this.preparing) {
        this.preparing = this.prepareWindow(offset)
          .catch((error) => {
            this.failure = error;
          })
          .finally(() => {
            this.preparing = null;
          });
      }
    }
    const pitch = 2 ** (this.detune / 1200);
    const span =
      (this._grainSize / this.playbackRate + this._overlap) * pitch + 2 / this.source.sampleRate;
    const page = this.pool.acquire(this.source, offset, span, this);
    if (!page || this.failure) {
      this.underruns++;
      this.failure ||= new Error(
        'Source audio was not ready in time. Playback stopped; the safety recording is preserved.'
      );
      this.stop(time);
      return;
    }
    const grain = new Tone.ToneBufferSource({
      context: this.context,
      url: page.buffer,
      fadeIn: offset < this._overlap ? 0 : this._overlap,
      fadeOut: this._overlap,
      loop: page.loop,
      loopStart: page.loopStart || 0,
      loopEnd: page.loopEnd || 0,
      playbackRate: pitch,
    }).connect(this.output);
    this._activeSources.push(grain);
    const release = () => {
      if (this.leases.delete(grain)) page.release();
    };
    this.leases.set(grain, release);
    grain.onended = () => {
      release();
      const index = this._activeSources.indexOf(grain);
      if (index >= 0) this._activeSources.splice(index, 1);
      // OfflineContext first schedules its graph, then renders it. Disconnecting
      // a finished scheduled grain during that first phase would erase its audio.
      if (!this.context.isOffline) grain.dispose();
    };
    grain.start(time, page.offset);
    grain.stop(time + this._grainSize / this.playbackRate);
  }
  dispose() {
    for (const release of this.leases.values()) release();
    return super.dispose();
  }
}
