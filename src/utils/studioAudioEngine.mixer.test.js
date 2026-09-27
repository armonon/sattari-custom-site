import { afterEach, describe, expect, it, vi } from 'vitest';

const clock = vi.hoisted(() => ({ now: 0 }));
vi.mock('tone', async (original) => {
  const actual = await original();
  class Gain {
    constructor(value = 1) {
      this.gain = { value, rampTo: vi.fn() };
      this.connect = vi.fn((node) => node);
      this.dispose = vi.fn();
    }
  }
  return { ...actual, now: () => clock.now, Gain, connect: vi.fn(), disconnect: vi.fn() };
});
vi.mock('./mixerReturns', async (original) => ({
  ...(await original()),
  createReturnBus: vi.fn((raw, bus, params, options) => ({
    bus,
    params,
    options,
    input: { kind: `return-${bus}` },
    output: { kind: `return-${bus}-out` },
    update: vi.fn(),
    setTempo: vi.fn(),
    dispose: vi.fn(),
  })),
}));
vi.mock('./mixerMeters', async (original) => ({
  ...(await original()),
  LevelMeter: class {
    constructor() {
      this.attach = vi.fn((source) => (this.source = source));
      this.setActive = vi.fn();
      this.read = vi.fn((reading) => Object.assign(reading, { peakDb: -6, rmsDb: -12 }));
      this.dispose = vi.fn();
    }
  },
}));

import * as Tone from 'tone';
import { StudioAudioEngine, validPerformanceInput } from './studioAudioEngine';
import { createReturnBus, normalizeReturns, sendGain } from './mixerReturns';
import { newEffect } from './arrangementEffects';

afterEach(() => {
  vi.clearAllMocks();
  clock.now = 0;
});

const audioParam = (value = 0) => ({
  value,
  cancelAndHoldAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
});
const deck = () => ({
  output: new Tone.Gain(1),
  sends: new Map(),
  cueSend: { gain: audioParam(0) },
  inserts: { update: vi.fn() },
  cue: false,
});
function mixerEngine() {
  const engine = Object.create(StudioAudioEngine.prototype);
  const raw = { currentTime: 0, sampleRate: 48000 };
  engine.master = { context: { rawContext: raw } };
  engine.getAudioContext = () => ({ rawContext: raw });
  engine.decks = new Map([['A', deck()]]);
  engine.returnSettings = normalizeReturns();
  engine.returnBuses = new Map();
  engine.levelMeters = new Map();
  engine.metering = false;
  engine.masterCompressor = { reduction: 0 };
  engine.limiter = { reduction: 0 };
  engine.output = { kind: 'program' };
  engine.installPerformanceCapture();
  return engine;
}
function recordFrom(engine) {
  engine.performanceStartedAt = clock.now;
  engine.performanceEvents = [];
  engine.performanceLast.clear();
  engine.performanceJournal = { append: vi.fn() };
}

describe('deck sends', () => {
  it('builds nothing for a silent send, then one send and its return on first use', () => {
    const engine = mixerEngine(),
      a = engine.decks.get('A');
    expect(engine.setDeckSend('A', 'a', 0)).toBe(true);
    expect(a.sends.size).toBe(0);
    expect(createReturnBus).not.toHaveBeenCalled();
    expect(engine.setDeckSend('A', 'a', 50)).toBe(true);
    const send = a.sends.get('a');
    expect(a.output.connect).toHaveBeenCalledWith(send);
    expect(Tone.connect).toHaveBeenCalledWith(send, engine.returnBuses.get('a').input);
    expect(createReturnBus).toHaveBeenCalledTimes(1);
    expect(createReturnBus.mock.calls[0][3]).toEqual({ bpm: 120, live: true });
    expect(send.gain.rampTo).toHaveBeenLastCalledWith(sendGain(50), 0.03);
    // Lowering keeps the node (no rebuild clicks); the bus stays for its tail.
    expect(engine.setDeckSend('A', 'a', 0)).toBe(true);
    expect(a.sends.get('a')).toBe(send);
    expect(send.gain.rampTo).toHaveBeenLastCalledWith(0, 0.03);
    expect(createReturnBus).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown buses and damaged amounts before touching the graph', () => {
    const engine = mixerEngine();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(engine.setDeckSend('A', 'c', 50)).toBe(false);
    expect(engine.setDeckSend('A', 'a', NaN)).toBe(false);
    expect(engine.setDeckSend('A', 'a', Infinity)).toBe(false);
    expect(engine.decks.get('A').sends.size).toBe(0);
    expect(validPerformanceInput('setDeckSend', ['A', 'b', '35'])).toBe(true);
  });

  it('ramps at the replay time when one is set', () => {
    const engine = mixerEngine();
    engine.performanceParameterTime = 5;
    engine.setDeckSend('A', 'b', 100);
    expect(engine.decks.get('A').sends.get('b').gain.rampTo).toHaveBeenCalledWith(1, 0.03, 5);
  });

  it('creates returns at the session tempo and retimes them with it', () => {
    const engine = mixerEngine();
    engine.setProjectTempo(96);
    engine.setDeckSend('A', 'b', 40);
    const bus = engine.returnBuses.get('b');
    expect(bus.options.bpm).toBe(96);
    engine.setProjectTempo(128);
    expect(bus.setTempo).toHaveBeenCalledWith(128);
  });
});

describe('returns', () => {
  it('merges and clamps edits, and updates only a bus that exists', () => {
    const engine = mixerEngine();
    expect(engine.setReturn('a', { size: 500 })).toBe(true);
    expect(engine.getReturns().a.size).toBe(100);
    expect(engine.getReturns().a.decay).toBe(normalizeReturns().a.decay);
    engine.setDeckSend('A', 'a', 30);
    const bus = engine.returnBuses.get('a');
    expect(bus.params.size).toBe(100);
    engine.setReturn('a', { level: 40 });
    expect(bus.update).toHaveBeenCalledWith(
      expect.objectContaining({ size: 100, level: 40 }),
      undefined
    );
  });

  it('ignores unknown buses and damaged values', () => {
    const engine = mixerEngine();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(engine.setReturn('z', { level: 10 })).toBe(false);
    expect(engine.setReturn('b', { feedback: NaN })).toBe(false);
    expect(engine.getReturns()).toEqual(normalizeReturns());
  });
});

describe('deck inserts and cue', () => {
  it('passes valid effects to the deck rack and rejects damaged ones', () => {
    const engine = mixerEngine(),
      inserts = engine.decks.get('A').inserts;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const effects = [newEffect('eq'), newEffect('heat')];
    expect(engine.setDeckInserts('A', effects)).toBe(true);
    expect(inserts.update).toHaveBeenCalledWith(effects);
    expect(engine.setDeckInserts('A', [{ id: 'x', type: 'fuzz', bypass: false, params: {} }])).toBe(
      false
    );
    expect(engine.setDeckInserts('A', 'eq')).toBe(false);
    expect(inserts.update).toHaveBeenCalledTimes(1);
  });

  it('keeps the sounding rack when a burst of rebuilds is refused', () => {
    const engine = mixerEngine();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    engine.decks.get('A').inserts.update.mockImplementation(() => {
      throw new Error('Effects are still changing. Try again in a moment.');
    });
    expect(engine.setDeckInserts('A', [newEffect('eq')])).toBe(false);
  });

  it('fades the pre-fader cue tap in and out', () => {
    const engine = mixerEngine(),
      gain = engine.decks.get('A').cueSend.gain;
    engine.master.context.rawContext.currentTime = 2;
    expect(engine.setDeckCue('A', true)).toBe(true);
    expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, 2.02);
    engine.setDeckCue('A', false);
    expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 2.02);
    expect(engine.decks.get('A').cue).toBe(false);
  });
});

describe('recording', () => {
  it('journals sends, returns and inserts at audio times, never cue or metering', () => {
    clock.now = 10;
    const engine = mixerEngine();
    engine.cueRouter = { set: vi.fn(() => 'split') };
    recordFrom(engine);
    clock.now = 11.5;
    engine.setDeckSend('A', 'a', 25);
    engine.setReturn('b', { division: '1/8' });
    engine.setDeckInserts('A', [newEffect('comp')]);
    engine.setDeckCue('A', true);
    engine.setCue({ mode: 'split' });
    engine.setMetering(true);
    const events = engine.performanceEvents;
    expect(events.map((event) => event.type)).toEqual([
      'setDeckSend',
      'setReturn',
      'setDeckInserts',
    ]);
    expect(events[0]).toMatchObject({ args: ['A', 'a', 25], scheduledTime: 1.5 });
    expect(events[1]).toMatchObject({ args: ['b', { division: '1/8' }], scheduledTime: 1.5 });
  });
});

describe('channel meters', () => {
  it('reuses one readings object and reports gain reduction as negative dB', () => {
    const engine = mixerEngine();
    engine.masterCompressor.reduction = -2;
    engine.limiter.reduction = -3.5;
    engine.arrangementReduction = () => 1;
    engine.arrangementMeters = vi.fn();
    engine.setMetering(true);
    const first = engine.getChannelMeters();
    expect(engine.getChannelMeters()).toBe(first);
    expect(first.decks.A).toMatchObject({ peakDb: -6, rmsDb: -12 });
    expect(first.master).toMatchObject({ peakDb: -6, reductionDb: -3.5 });
    expect(first.returns.a.peakDb).toBe(-6);
    expect(engine.arrangementMeters).toHaveBeenCalledWith(first.tracks);
    engine.masterCompressor.reduction = 0;
    engine.limiter.reduction = 0;
    engine.arrangementReduction = () => 0;
    expect(engine.getChannelMeters().master.reductionDb).toBe(0);
  });

  it('meters a return created while the mixer is showing', () => {
    const engine = mixerEngine();
    engine.setMetering(true);
    engine.setDeckSend('A', 'b', 60);
    expect(engine.levelMeters.get('return:b').source).toBe(engine.returnBuses.get('b').output);
  });

  it('stops every meter when the mixer closes and tells the arranger', () => {
    const engine = mixerEngine();
    engine.arrangementMetering = vi.fn();
    engine.setMetering(true);
    engine.setMetering(false);
    for (const meter of engine.levelMeters.values())
      expect(meter.setActive).toHaveBeenLastCalledWith(false);
    expect(engine.arrangementMetering.mock.calls).toEqual([[true], [false]]);
  });
});

describe('output device', () => {
  it('ducks the cue route around a device switch', async () => {
    const engine = mixerEngine();
    const raw = engine.master.context.rawContext;
    raw.setSinkId = vi.fn(async () => {});
    engine.cueRouter = { duck: vi.fn(), refresh: vi.fn() };
    expect(await engine.setOutputDevice('usb-4ch')).toBe(true);
    expect(raw.setSinkId).toHaveBeenCalledWith('usb-4ch');
    expect(engine.cueRouter.duck.mock.invocationCallOrder[0]).toBeLessThan(
      raw.setSinkId.mock.invocationCallOrder[0]
    );
    expect(engine.cueRouter.refresh).toHaveBeenCalledTimes(1);
  });

  it('restores the route when the browser refuses the device', async () => {
    const engine = mixerEngine();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    engine.master.context.rawContext.setSinkId = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    engine.cueRouter = { duck: vi.fn(), refresh: vi.fn() };
    expect(await engine.setOutputDevice('gone')).toBe(false);
    expect(engine.cueRouter.refresh).toHaveBeenCalledTimes(1);
  });

  it('reports no device switching when the browser has no setSinkId', async () => {
    const engine = mixerEngine();
    engine.cueRouter = { duck: vi.fn(), refresh: vi.fn() };
    expect(await engine.setOutputDevice('x')).toBe(false);
    expect(engine.cueRouter.duck).not.toHaveBeenCalled();
  });
});
