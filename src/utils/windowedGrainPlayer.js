import * as Tone from 'tone';
import { GrainSchedule } from './grainSchedule';

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
    if (!this.context.isOffline) {
      this.grainSchedule = new GrainSchedule(this);
      // Keep Tone's state/tick timeline, but queue native sources independently
      // of its short UI-clock lookahead. Offline rendering retains the oracle.
      this._clock.callback = () => {};
      this.pumpGrains = () => this.grainSchedule.pump();
      this.context.on('tick', this.pumpGrains);
    }
  }
  get detune() {
    return this.pitchCents || 0;
  }
  set detune(value) {
    this.pitchCents = value;
    if (this.pitchSchedule) {
      const time = this.context.now();
      this.pitchSchedule = this.pitchSchedule.filter((entry) => entry.time < time);
      this.pitchSchedule.push({ time, value });
      this.requeueGrains(time);
    } else this.requeueGrains();
  }
  get grainSize() {
    return super.grainSize;
  }
  set grainSize(value) {
    super.grainSize = value;
    this.requeueGrains();
  }
  requeueGrains(time) {
    if (!this.grainSchedule) return;
    this.grainSchedule.invalidate(time ?? this.context.now());
    this.grainSchedule.pump();
  }
  schedulePlaybackRate(rate, time, detune = this.detune) {
    if (!Number.isFinite(rate) || rate < 0.001) throw new Error('Invalid playback rate.');
    this._clock.frequency.setValueAtTime(rate / this._grainSize, time);
    this.pitchSchedule ||= [{ time: -Infinity, value: this.detune }];
    this.pitchSchedule.push({ time, value: detune });
    this.pitchSchedule.sort((a, b) => a.time - b.time);
    this.requeueGrains(time);
  }
  get duration() {
    return this.source.duration;
  }
  _start(time, offset = 0, duration) {
    // Keep an independent start anchor. Tone's stop/start tick query can return
    // its intervening reset-to-zero when a generated tick is a few floating-
    // point ULPs before a same-time seek boundary.
    this.sourceStarts ||= [];
    this.sourceStarts.push({
      time,
      ticks: this.toSeconds(offset) * this._clock.frequency.getValueAtTime(time),
    });
    this.sourceStarts.sort((a, b) => a.time - b.time);
    super._start(time, offset, duration);
    this.requeueGrains(time);
  }
  sourceOffsetAt(time) {
    const anchor = this.sourceStarts?.findLast((start) => start.time <= time + 1e-8);
    if (!anchor) return this._clock.getTicksAtTime(time) * this._grainSize;
    const frequency = this._clock.frequency;
    return (
      (anchor.ticks +
        frequency.getTicksAtTime(Math.max(time, anchor.time)) -
        frequency.getTicksAtTime(anchor.time)) *
      this._grainSize
    );
  }
  _stop(time) {
    // Source.stop cancels future starts. Their position anchors must be
    // canceled too, or a later resumed take can jump to an abandoned seek.
    if (this.sourceStarts)
      this.sourceStarts = this.sourceStarts.filter((start) => start.time < time);
    super._stop(time);
    if (this.grainSchedule) {
      this.grainSchedule.invalidate(time);
      // Native stops are enqueued immediately, not when a UI callback finally
      // observes the clock's stop event (which could be after a seek).
      for (const grain of this._activeSources) if (grain.startTime < time) grain.stop(time);
    }
  }
  _onstop(time) {
    if (!this.grainSchedule) return super._onstop(time);
    this.onstop(this);
  }
  get loopStart() {
    return super.loopStart;
  }
  set loopStart(value) {
    if (this.source && (!Number.isFinite(value) || value < 0 || value > this.duration))
      throw new Error('Loop start is outside the source.');
    super.loopStart = value;
    this.requeueGrains();
  }
  get loopEnd() {
    return super.loopEnd;
  }
  set loopEnd(value) {
    if (this.source && (!Number.isFinite(value) || value < 0 || value > this.duration))
      throw new Error('Loop end is outside the source.');
    super.loopEnd = value;
    this.requeueGrains();
  }
  prepareWindow(position, region = this) {
    this.preparationEpoch = (this.preparationEpoch || 0) + 1;
    // The old prefetch must not block read-ahead at a newly prepared seek.
    // Its generation guard retires it after its current admitted decode.
    this.preparing = null;
    return this.warmWindow(position, region);
  }
  warmWindow(position, region = this) {
    // Reading a future replay destination is not a live seek: keep the
    // currently audible source's background read-ahead intact.
    if (region === this) region = this.loopStateAt(this.context.now());
    return this.pool.prepare(this.source, position, region);
  }
  prefetchWindow(position, region) {
    if (this.preparing) return this.preparing;
    const epoch = this.preparationEpoch;
    const job = this.pool
      .prepare(
        this.source,
        position,
        region,
        () => !this.disposed && epoch === this.preparationEpoch
      )
      .catch((error) => {
        // A cold seek/loop may supersede a background read. An old read failure
        // must not stop the newly prepared destination or overwrite its status.
        if (!this.disposed && epoch === this.preparationEpoch) {
          this.failure = error;
          this.stop(this.context.now());
        }
      })
      .finally(() => {
        if (this.preparing === job) this.preparing = null;
      });
    this.preparing = job;
    return job;
  }
  scheduleLoop(region, time) {
    if (!this.loopSchedule)
      this.loopSchedule = [
        {
          time: -Infinity,
          loop: this.loop,
          loopStart: this.loopStart,
          loopEnd: this.loopEnd || this.duration,
        },
      ];
    this.loopSchedule.push({ ...region, time });
    this.loopSchedule.sort((a, b) => a.time - b.time);
    this.requeueGrains(time);
  }
  loopStateAt(time) {
    if (!this.loopSchedule) return this;
    for (let i = this.loopSchedule.length - 1; i >= 0; i--)
      if (this.loopSchedule[i].time <= time) return this.loopSchedule[i];
    return this.loopSchedule[0];
  }
  _tick(time) {
    if (this.failure) return;
    if (!this.grainSchedule && Math.abs(time - this.lastGrainTime) < 1e-8) return;
    // Never burst a backlog of obsolete grains after the message thread stalls.
    // This is an explicit deadline failure, not a source-read failure or recovery.
    if (!this.context.isOffline && this.context.rawContext.currentTime - time > 0.05) {
      this.deadlineMisses = (this.deadlineMisses || 0) + 1;
      this.failure = new Error(
        'Audio scheduling fell behind under system load. Playback stopped; check the recording status before continuing.'
      );
      this.lastUnderrun = {
        kind: 'scheduler-deadline',
        lateness: this.context.rawContext.currentTime - time,
        time,
      };
      this.stop(this.context.now());
      return;
    }
    // Do not discard state merely because a prefetch queried a future time.
    const played = Math.min(time, this.context.rawContext.currentTime);
    while (this.loopSchedule?.length > 1 && this.loopSchedule[1].time <= played)
      this.loopSchedule.shift();
    while (this.sourceStarts?.length > 1 && this.sourceStarts[1].time <= played)
      this.sourceStarts.shift();
    while (this.pitchSchedule?.length > 1 && this.pitchSchedule[1].time <= played)
      this.pitchSchedule.shift();
    const offset = this.sourceOffsetAt(time);
    const region = this.loopStateAt(time);
    if (!region.loop && offset >= this.duration) {
      this.stop(time);
      return;
    }
    if (offset >= this.lastPrefetch + 1 || offset < this.lastPrefetch) {
      this.lastPrefetch = offset;
      this.prefetchWindow(offset, region);
    }
    const detune =
      this.pitchSchedule?.findLast((entry) => entry.time <= time)?.value ?? this.detune;
    const pitch = 2 ** (detune / 1200);
    const playbackRate = this._clock.frequency.getValueAtTime(time) * this._grainSize;
    const span =
      (this._grainSize / playbackRate + this._overlap) * pitch + 2 / this.source.sampleRate;
    const page = this.pool.acquire(this.source, offset, span, region);
    if (!page) {
      if (this.grainSchedule && time > this.context.rawContext.currentTime + 0.1) {
        this.prefetchWindow(offset, region);
        return false;
      }
      this.underruns++;
      this.lastUnderrun = {
        time,
        offset,
        span,
        region: { loop: region.loop, loopStart: region.loopStart, loopEnd: region.loopEnd },
        pages: [...this.pool.pages.values()]
          .filter((p) => p.source === this.source)
          .map((p) => [p.offset, p.buffer.duration]),
        priorFailure: this.failure?.message,
      };
      this.failure ||= new Error(
        'Source audio was not ready in time. Playback stopped; check the recording status before continuing.'
      );
      this.stop(time);
      return;
    }
    // Use native one-shot sources: envelopes and source retirement run on the
    // audio clock. ToneBufferSource adds a message-thread timeout plus an idle
    // disposal callback for every grain (hundreds per second across decks).
    const raw = this.context.rawContext;
    this.lastGrainTime = time;
    const source = raw.createBufferSource();
    // Keep Tone's envelope timeline semantics (including interrupting an attack)
    // while retiring the source itself on the native audio clock.
    const envelope = new Tone.Gain({ context: this.context, gain: 0 });
    source.buffer = page.buffer;
    source.loop = page.loop;
    source.loopStart = page.loopStart || 0;
    source.loopEnd = page.loopEnd || 0;
    source.playbackRate.setValueAtTime(pitch, 0);
    Tone.connect(source, envelope);
    envelope.connect(this.output);
    const fadeIn = offset < this._overlap ? 0 : this._overlap;
    const stopAt = time + this._grainSize / playbackRate;
    envelope.gain.setValueAtTime(fadeIn ? 0 : 1, time);
    if (fadeIn) envelope.gain.linearRampToValueAtTime(1, time + fadeIn);
    envelope.gain.linearRampTo(0, this._overlap, stopAt);
    let disposed = false;
    const grain = {
      startTime: time,
      canceled: false,
      fadeOut: this._overlap,
      cancel: () => {
        // Only called for a grain that has not reached the audio clock. Keep
        // its lease until onended; stop-before-start is a native silent cancel.
        if (grain.canceled) return;
        grain.canceled = true;
        source.stop(Math.max(0, raw.currentTime));
      },
      stop: (at) => {
        if (grain.canceled) return;
        if (at >= stopAt + this._overlap) return;
        // Match GrainPlayer's hard-stop contract: cancel its pending release
        // before cutting the attack/sustain. Never revive an already-ended grain.
        envelope.gain.cancelScheduledValues(time + fadeIn + 1 / raw.sampleRate);
        envelope.gain.cancelAndHoldAtTime(at);
        envelope.gain.setValueAtTime(0, at);
        source.stop(at);
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        source.onended = null;
        source.disconnect();
        envelope.dispose();
      },
    };
    this._activeSources.push(grain);
    const release = () => {
      if (this.leases.delete(grain)) page.release();
    };
    this.leases.set(grain, release);
    source.onended = () => {
      release();
      const index = this._activeSources.indexOf(grain);
      if (index >= 0) this._activeSources.splice(index, 1);
      // Offline renderers may deliver end callbacks before the final output
      // quantum is committed. Leave that graph connected through completion.
      if (!this.context.isOffline) grain.dispose();
    };
    source.start(time, page.offset);
    source.stop(stopAt + this._overlap);
    if (this.grainSchedule) {
      const stop = this._clock._state.getNextState('stopped', time);
      if (stop) grain.stop(stop.time);
    }
  }
  dispose() {
    if (this.pumpGrains) this.context.off('tick', this.pumpGrains);
    for (const release of this.leases.values()) release();
    return super.dispose();
  }
}
