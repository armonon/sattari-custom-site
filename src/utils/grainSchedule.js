// A bounded native-audio queue, not a change to the shared transport lookahead.
// Musical controls invalidate only unplayed grains, so extra resilience does not
// add a second of control latency. Tick positions remain Tone's pinned clock.
export class GrainSchedule {
  constructor(player, horizon = 1) {
    this.player = player;
    this.horizon = horizon;
    this.cursor = this.now;
    this.pumping = false;
    this.scheduled = new Map();
  }
  get now() {
    // Tone prepares offline graphs using its simulated audio clock before the
    // underlying OfflineAudioContext starts rendering (raw.currentTime is 0).
    return this.player.context.isOffline
      ? this.player.context.currentTime
      : this.player.context.rawContext.currentTime;
  }
  invalidate(time) {
    for (const grain of this.player._activeSources) {
      if (grain.startTime >= time - 1e-8) grain.cancel();
    }
    this.cursor = Math.min(this.cursor, time);
    for (const [key, at] of this.scheduled) if (at >= time - 1e-8) this.scheduled.delete(key);
  }
  pump() {
    if (this.pumping || this.player.disposed || this.player.failure) return;
    this.pumping = true;
    for (const [key, at] of this.scheduled) if (at < this.now - 0.1) this.scheduled.delete(key);
    const end = this.now + this.horizon;
    const start = this.cursor;
    // Advance before calling out: a natural stop can invalidate this cursor.
    this.cursor = Math.max(start, end);
    try {
      let deferred = false;
      if (end > start)
        this.player._clock._tickSource.forEachTickBetween(start, end, (time) => {
          if (deferred) return;
          // Tone's floating-point boundary search can emit the same tick on
          // adjacent intervals. A grain must only be emitted once per sample.
          const key = Math.round(time * (this.player.context.sampleRate || 48000));
          if (this.scheduled.has(key)) return;
          if (this.player._tick(time) === false) {
            // A future page can still be decoding. Retry from this exact grain;
            // only the existing audible-time guard may declare an underrun.
            deferred = true;
            this.cursor = time;
          } else this.scheduled.set(key, time);
        });
    } finally {
      this.pumping = false;
    }
  }
}
