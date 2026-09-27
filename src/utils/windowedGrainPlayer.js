import * as Tone from 'tone';
import { GrainSchedule } from './grainSchedule';

// Idle envelopes kept per player: above the ~26 grains a 1 s horizon holds at 2x.
const IDLE_ENVELOPES = 64;

// The same wrap each grain's page read applies (SourceWindowPool.acquire).
const wrapInLoop = (offset, { loopStart, loopEnd }) =>
  loopEnd > loopStart && offset >= loopEnd
    ? loopStart + ((offset - loopStart) % (loopEnd - loopStart))
    : offset;

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
      // A Tone.Gain per grain (~190/s across 16 lanes) churned the GC; a pause
      // over 50 ms trips the scheduler deadline stop in _tick. Reuse envelopes.
      this.envelopes = [];
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
  acquireEnvelope() {
    const reused = this.envelopes?.pop();
    if (reused) return reused;
    const envelope = new Tone.Gain({ context: this.context, gain: 0 });
    envelope.connect(this.output);
    return envelope;
  }
  // Called from the grain's `ended` event. The pooled node stays connected to the
  // output, and its finished automation is left alone: Chrome posts `ended` while
  // it is still rendering the quantum the source stopped in, so editing that
  // envelope's timeline here can race the last frames of its fade-out. Every later
  // grain's automation starts after this one ended, so the history never matters.
  // Only a grain cancelled before it started leaves future events; its source never
  // sounded, so they can be dropped safely.
  releaseEnvelope(envelope, cancelledFrom) {
    if (this.disposed || !this.envelopes || this.envelopes.length >= IDLE_ENVELOPES) {
      envelope.dispose();
      return;
    }
    if (Number.isFinite(cancelledFrom)) envelope.gain.cancelScheduledValues(cancelledFrom);
    this.envelopes.push(envelope);
  }
  schedulePlaybackRate(rate, time, detune = this.detune) {
    if (!Number.isFinite(rate) || rate < 0.001) throw new Error('Invalid playback rate.');
    this._clock.frequency.setValueAtTime(rate / this._grainSize, time);
    this.pitchSchedule ||= [{ time: -Infinity, value: this.detune }];
    this.pitchSchedule.push({ time, value: detune });
    this.pitchSchedule.sort((a, b) => a.time - b.time);
    this.requeueGrains(time);
  }
  // Replay of a deck whose rate a re-derived sync controller keeps adjusting: the
  // queued musical pitch holds from `time` and never touches the rate. With key
  // lock off, each grain adds the transposition of its own playback rate.
  schedulePitch(time, cents, { followRate = false } = {}) {
    if (!Number.isFinite(cents)) throw new Error('Invalid pitch.');
    this.pitchSchedule ||= [{ time: -Infinity, value: this.detune }];
    this.pitchSchedule.push({ time, value: cents, followRate });
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
    const index = this.sourceStarts?.findLastIndex((start) => start.time <= time + 1e-8) ?? -1;
    if (index < 0) return this._clock.getTicksAtTime(time) * this._grainSize;
    return this.offsetFromAnchor(index, time);
  }
  offsetFromAnchor(index, time) {
    const anchor = this.sourceStarts[index],
      frequency = this._clock.frequency;
    return (
      ((anchor.exit ? this.exitTicks(index) : anchor.ticks) +
        frequency.getTicksAtTime(Math.max(time, anchor.time)) -
        frequency.getTicksAtTime(anchor.time)) *
      this._grainSize
    );
  }
  // A loop-exit anchor continues from where the previous anchor had reached,
  // wrapped into the loop it leaves. Resolved lazily: a later rate change
  // before the exit still moves the position the exit starts from.
  exitTicks(index) {
    const { time, exit } = this.sourceStarts[index];
    const reached =
      index > 0
        ? this.offsetFromAnchor(index - 1, time)
        : this._clock.getTicksAtTime(time) * this._grainSize;
    return wrapInLoop(reached, exit) / this._grainSize;
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
    const previous = this.loopStateAt(time);
    this.loopSchedule.push({ ...region, time });
    this.loopSchedule.sort((a, b) => a.time - b.time);
    // Leaving a loop continues from the current position inside it, as DJ players
    // do; the unwrapped grain clock would jump ahead by the time spent looping.
    // Grains keep their usual crossfades across the re-anchor, so it cannot click.
    if (previous.loop && !region.loop && this.sourceStarts?.length) {
      const { loopStart, loopEnd } = previous;
      this.sourceStarts.push({ time, exit: { loopStart, loopEnd } });
      this.sourceStarts.sort((a, b) => a.time - b.time);
    }
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
    while (this.sourceStarts?.length > 1 && this.sourceStarts[1].time <= played) {
      // Fix a played exit anchor before dropping the anchor it resolves from.
      const [, next] = this.sourceStarts;
      if (next.exit) this.sourceStarts[1] = { time: next.time, ticks: this.exitTicks(1) };
      this.sourceStarts.shift();
    }
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
    const playbackRate = this._clock.frequency.getValueAtTime(time) * this._grainSize;
    const entry = this.pitchSchedule?.findLast((item) => item.time <= time);
    const detune = !entry
      ? this.detune
      : entry.followRate
        ? entry.value + 1200 * Math.log2(Math.max(0.01, playbackRate))
        : entry.value;
    const pitch = 2 ** (detune / 1200);
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
    // while retiring the source itself on the native audio clock. Offline renders
    // keep one envelope per grain: their graph stays connected until completion.
    const envelope = this.envelopes
      ? this.acquireEnvelope()
      : new Tone.Gain({ context: this.context, gain: 0 });
    source.buffer = page.buffer;
    source.loop = page.loop;
    source.loopStart = page.loopStart || 0;
    source.loopEnd = page.loopEnd || 0;
    source.playbackRate.setValueAtTime(pitch, 0);
    Tone.connect(source, envelope);
    if (!this.envelopes) envelope.connect(this.output);
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
        this.releaseEnvelope(envelope, grain.canceled ? time : undefined);
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
    // Tone disposes active grains here; with `disposed` set they release, not pool.
    super.dispose();
    for (const envelope of this.envelopes?.splice(0) || []) envelope.dispose();
    return this;
  }
}
