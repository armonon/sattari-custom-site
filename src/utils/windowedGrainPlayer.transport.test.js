import { expect, it, vi } from 'vitest';

vi.mock('tone', async (original) => {
  const Tone = await original();
  const param = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    linearRampTo: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  class Gain {
    constructor() {
      this.gain = param();
    }
    connect() {
      return this;
    }
    dispose() {}
  }
  return { ...Tone, Gain, connect: vi.fn() };
});

import { WindowedGrainPlayer } from './windowedGrainPlayer';

const GRAIN = 0.1;
// Piecewise-constant tick frequency (ticks/s = rate / grainSize) from time 0.
function frequency(rate) {
  const events = [{ time: -Infinity, value: rate / GRAIN }];
  return {
    setValueAtTime(value, time) {
      events.push({ time, value });
      events.sort((a, b) => a.time - b.time);
    },
    getValueAtTime: (time) => events.findLast((event) => event.time <= time).value,
    getTicksAtTime(time) {
      let ticks = 0;
      events.forEach(({ time: from, value }, i) => {
        const start = Math.max(0, from),
          end = Math.min(time, events[i + 1]?.time ?? Infinity);
        if (end > start) ticks += (end - start) * value;
      });
      return ticks;
    },
  };
}
function player({ currentTime = 0 } = {}) {
  const sources = [];
  const raw = {
    currentTime,
    sampleRate: 48000,
    createBufferSource: () => {
      const source = {
        playbackRate: { setValueAtTime: vi.fn() },
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      sources.push(source);
      return source;
    },
  };
  const target = Object.create(WindowedGrainPlayer.prototype);
  Object.defineProperty(target, 'context', {
    value: { isOffline: false, rawContext: raw, now: () => raw.currentTime },
  });
  Object.assign(target, {
    loop: false,
    _loopStart: 0,
    _loopEnd: 0,
    _grainSize: GRAIN,
    _overlap: 0.035,
    _activeSources: [],
    leases: new Map(),
    envelopes: [],
    source: { duration: 300, sampleRate: 48000 },
    output: {},
    pool: { acquire: vi.fn(() => ({ buffer: {}, offset: 0, release: vi.fn() })) },
    _clock: { frequency: frequency(1), _state: { getNextState: () => null } },
    prefetchWindow: vi.fn(),
    // Started at 100 s of the clock from 58 s of source.
    sourceStarts: [{ time: 100, ticks: 58 / GRAIN }],
  });
  return { target, raw, sources };
}

it('leaves a loop in place after N cycles instead of jumping by the time spent looping', () => {
  const { target } = player();
  target.scheduleLoop({ loop: true, loopStart: 60, loopEnd: 62 }, 100);
  target._clock.frequency.setValueAtTime(1.25 / GRAIN, 110); // rate change mid-loop
  target.scheduleLoop({ loop: false, loopStart: 60, loopEnd: 62 }, 118.56);
  // While looping, the clock stays unwrapped (each page read wraps it).
  expect(target.sourceOffsetAt(118)).toBeCloseTo(78, 9);
  expect(target.loopStateAt(118).loop).toBe(true);
  // 78.7 s of clock = 9.35 passes through 60-62: the exit continues at 60.7 s.
  expect(target.sourceOffsetAt(118.56)).toBeCloseTo(60.7, 9);
  expect(target.sourceOffsetAt(119.56)).toBeCloseTo(61.95, 9);
  expect(target.loopStateAt(119).loop).toBe(false);
});

it('resolves the exit position lazily when a rate change is queued before it', () => {
  const { target } = player();
  target.scheduleLoop({ loop: true, loopStart: 60, loopEnd: 62 }, 100);
  target.scheduleLoop({ loop: false, loopStart: 60, loopEnd: 62 }, 118.56);
  target._clock.frequency.setValueAtTime(2 / GRAIN, 115); // arrives after the exit was queued
  // 58 + 15 + 3.56 * 2 = 80.12 s of clock -> 60.12 s inside the loop.
  expect(target.sourceOffsetAt(118.56)).toBeCloseTo(60.12, 9);
});

it('fixes a played exit anchor before pruning the anchor it resolves from', () => {
  const { target, raw } = player({ currentTime: 119 });
  target.scheduleLoop({ loop: true, loopStart: 60, loopEnd: 62 }, 100);
  target.scheduleLoop({ loop: false, loopStart: 60, loopEnd: 62 }, 118.56);
  target._tick(119.05);
  expect(target.sourceStarts).toHaveLength(1);
  expect(target.sourceStarts[0].ticks * GRAIN).toBeCloseTo(60.56, 9);
  raw.currentTime = 120;
  expect(target.sourceOffsetAt(120)).toBeCloseTo(62, 9);
  expect(target.pool.acquire.mock.calls[0][1]).toBeCloseTo(61.05, 9); // the grain read
});

it('queues synced-deck pitch that follows each grain rate and survives rate corrections', () => {
  const { target, sources } = player({ currentTime: 4.9 });
  target.sourceStarts = [{ time: 0, ticks: 10 / GRAIN }];
  target._clock.frequency.setValueAtTime(1.2 / GRAIN, 4);
  target.schedulePitch(5, 200, { followRate: true }); // +2 semitones, key lock off
  target._tick(4.95); // before the queued change: the deck's current detune (0)
  expect(sources[0].playbackRate.setValueAtTime).toHaveBeenCalledWith(1, 0);
  target._tick(5.05);
  expect(sources[1].playbackRate.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
    1.2 * 2 ** (2 / 12),
    12
  );
  // A derived correction changes only the rate; the queued pitch still applies.
  target._clock.frequency.setValueAtTime(1.25 / GRAIN, 5.1);
  target._tick(5.15);
  expect(sources[2].playbackRate.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
    1.25 * 2 ** (2 / 12),
    12
  );
  // Key lock on: the musical pitch alone, whatever the rate.
  target.schedulePitch(5.2, 200, { followRate: false });
  target._tick(5.25);
  expect(sources[3].playbackRate.setValueAtTime.mock.calls[0][0]).toBeCloseTo(2 ** (2 / 12), 12);
  expect(() => target.schedulePitch(6, NaN)).toThrow('Invalid pitch');
});
