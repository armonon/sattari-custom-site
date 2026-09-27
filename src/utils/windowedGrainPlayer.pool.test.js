import { afterEach, expect, it, vi } from 'vitest';

const gains = vi.hoisted(() => []);
vi.mock('tone', async (original) => {
  const Tone = await original();
  // Tone.Param / Web Audio timeline semantics that matter here: cancelScheduledValues(t)
  // drops every event scheduled at or after t; every other call adds an event.
  const timelineParam = () => {
    const param = { events: [] };
    const add =
      (type, timeIndex) =>
      (...args) => {
        param.events.push({ type, args, time: args[timeIndex] });
        return param;
      };
    param.setValueAtTime = add('setValueAtTime', 1);
    param.linearRampToValueAtTime = add('linearRampToValueAtTime', 1);
    param.linearRampTo = add('linearRampTo', 2);
    param.cancelAndHoldAtTime = add('cancelAndHoldAtTime', 0);
    param.cancelScheduledValues = (time) => {
      param.events = param.events.filter((event) => event.time < time);
      (param.cancelled ||= []).push(time);
      return param;
    };
    return param;
  };
  class Gain {
    get cancelled() {
      return this.gain.cancelled;
    }
    constructor(options) {
      this.gain = timelineParam();
      // Tone's Param constructor schedules a non-default initial value like this.
      if (options.gain === 0) this.gain.setValueAtTime(0, 0);
      this.connections = [];
      gains.push(this);
    }
    connect(node) {
      this.connections.push(node);
      return this;
    }
    dispose() {
      this.disposed = true;
    }
  }
  return { ...Tone, Gain, connect: vi.fn() };
});

import { GrainPlayer } from 'tone';
import { WindowedGrainPlayer } from './windowedGrainPlayer';

afterEach(() => {
  gains.length = 0;
  vi.restoreAllMocks();
});

function fixture({ offline = false } = {}) {
  const sources = [];
  const raw = {
    currentTime: 0,
    sampleRate: 48000,
    createBufferSource: () => {
      const source = {
        playbackRate: { setValueAtTime: vi.fn() },
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn((at) => {
          source.stopAt = Math.min(source.stopAt ?? Infinity, at);
        }),
      };
      sources.push(source);
      return source;
    },
  };
  const player = Object.create(WindowedGrainPlayer.prototype);
  Object.defineProperty(player, 'context', {
    value: { isOffline: offline, rawContext: raw, now: () => raw.currentTime },
  });
  Object.assign(player, {
    ...(offline ? {} : { envelopes: [], grainSchedule: {} }),
    _grainSize: 0.085,
    _overlap: 0.035,
    _activeSources: [],
    leases: new Map(),
    source: { duration: 600, sampleRate: 48000 },
    output: { id: 'lane output' },
    pool: {
      acquire: vi.fn(() => ({ buffer: {}, offset: 0, loop: false, release: vi.fn() })),
    },
    _clock: {
      frequency: { getValueAtTime: () => 1 / 0.085 },
      _state: { getNextState: () => null },
    },
    prefetchWindow: vi.fn(),
    sourceOffsetAt: (time) => time,
  });
  // Grains are queued ahead of the audio clock; native sources end on that clock.
  const grains = [];
  const advance = (currentTime) => {
    raw.currentTime = currentTime;
    for (const source of sources)
      if (source.stopAt <= currentTime && !source.ended) {
        source.ended = true;
        source.onended?.();
      }
  };
  const play = (count) => {
    for (let k = 0; k < count; k++) {
      const time = 1 + grains.length * 0.085;
      advance(Math.max(0, time - 0.5));
      player._tick(time);
      // Snapshot the envelope this grain was given, as scheduled.
      const envelope = gains.find((gain) =>
        gain.gain.events.some((event) => event.type === 'setValueAtTime' && event.args[1] === time)
      );
      grains.push({
        time,
        envelope,
        timeline: envelope.gain.events.map(({ type, args }) => ({ type, args })),
      });
    }
  };
  return { player, sources, play, grains, advance };
}

// The automation one grain schedules on its envelope (Tone.Gain({ gain: 0 })).
const grainAutomation = (time) => [
  { type: 'setValueAtTime', args: [0, time] },
  { type: 'linearRampToValueAtTime', args: [1, time + 0.035] },
  { type: 'linearRampTo', args: [0, 0.035, time + 0.085] },
];

it('reuses a bounded set of grain envelopes, each grain scheduled exactly like a new one', () => {
  const { player, sources, play, grains } = fixture();
  play(300);
  expect(sources).toHaveLength(300);
  // ~0.62 s of grains are alive at once (0.5 s queue + 0.12 s grain), not 300 Gains.
  expect(gains.length).toBeGreaterThan(1);
  expect(gains.length).toBeLessThanOrEqual(10);
  expect(gains.every((gain) => gain.connections.length === 1 && !gain.disposed)).toBe(true);
  expect(gains.every((gain) => gain.connections[0] === player.output)).toBe(true);
  for (const [index, { time, envelope, timeline }] of grains.entries()) {
    // The grain's own automation is exactly a fresh envelope's...
    const own = timeline.filter(({ args }) => args.at(-1) >= time);
    expect(own).toEqual(grainAutomation(time));
    // ...and everything an earlier grain left on a recycled envelope ended before it.
    const previous = grains.slice(0, index).findLast((item) => item.envelope === envelope);
    if (previous) expect(previous.time + 0.12).toBeLessThanOrEqual(time);
  }
  const recycled = grains.filter(({ envelope }, index) =>
    grains.slice(0, index).some((previous) => previous.envelope === envelope)
  );
  expect(recycled.length).toBeGreaterThan(280);
});

it('never edits a finished envelope from its ended event, which can race the audio thread', () => {
  const { play } = fixture();
  play(40);
  expect(gains.every((gain) => !gain.cancelled)).toBe(true);
});

it('drops only the queued automation of a grain cancelled before it started', () => {
  const { player, play, grains, sources } = fixture();
  play(12);
  const last = grains.at(-1);
  // A seek or rate change cancels grains that have not reached the audio clock.
  for (const grain of [...player._activeSources])
    if (grain.startTime >= last.time - 1e-8) grain.cancel();
  // The browser then reports the silent, never-started source as ended.
  sources.at(-1).onended();
  expect(last.envelope.cancelled).toEqual([last.time]);
  expect(last.envelope.gain.events.every((event) => event.time < last.time)).toBe(true);
  expect(player.envelopes).toContain(last.envelope);
});

it('releases every pooled and active envelope on dispose', () => {
  const { player, play, grains, advance } = fixture();
  play(40);
  advance(grains.at(-1).time - 0.2); // some grains ended, later ones still queued
  expect(player.envelopes.length).toBeGreaterThan(0);
  expect(player._activeSources.length).toBeGreaterThan(0);
  // Tone's GrainPlayer.dispose marks the node disposed, then disposes active grains.
  vi.spyOn(GrainPlayer.prototype, 'dispose').mockImplementation(function () {
    this._wasDisposed = true;
    this._activeSources.forEach((grain) => grain.dispose());
    return this;
  });
  player.dispose();
  expect(player.envelopes).toHaveLength(0);
  expect(gains.every((gain) => gain.disposed)).toBe(true);
  expect(player.leases.size).toBe(0);
});

it('keeps one envelope per grain for offline renders, connected until completion', () => {
  const { player, sources, play } = fixture({ offline: true });
  play(20);
  expect(gains).toHaveLength(20);
  expect(gains.every((gain) => gain.connections[0] === player.output)).toBe(true);
  expect(sources.some((source) => source.ended)).toBe(true);
  expect(gains.some((gain) => gain.disposed)).toBe(false);
});
