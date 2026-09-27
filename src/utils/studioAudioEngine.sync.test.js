import { afterEach, describe, expect, it, vi } from 'vitest';

const clock = vi.hoisted(() => ({ now: 0 }));
const journals = vi.hoisted(() => []);
vi.mock('tone', async (original) => ({ ...(await original()), now: () => clock.now }));
vi.mock('./performanceJournal', () => ({
  PerformanceJournal: class {
    constructor() {
      this.append = vi.fn();
      journals.push(this);
    }
    async start() {}
    async attach() {}
    dispose() {}
  },
}));
vi.mock('./sourceCapture', () => ({
  SourceCapture: class {
    id = 'capture';
    async start() {}
  },
}));

import { StudioAudioEngine, validPerformanceInput } from './studioAudioEngine';
import { phaseError, sourceBeat } from './syncClock';
import { reconstructPerformance } from './performanceReplay';
import { emptyArrangement } from './arrangementModel';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const lane = (duration = 300) => ({
  duration,
  pitch: 0,
  player: { start: vi.fn(), stop: vi.fn(), scheduleLoop: vi.fn(), playbackRate: 1, detune: 0 },
});
const deck = (overrides = {}) => ({
  playing: false,
  offset: 0,
  startedAt: 0,
  playbackRate: 1,
  pitch: 0,
  keyLock: true,
  looping: false,
  loopStart: 0,
  loopEnd: 0,
  lanes: new Map([['fullMix', lane()]]),
  ...overrides,
});
function engineFixture(decks = {}) {
  const engine = Object.create(StudioAudioEngine.prototype);
  engine.decks = new Map(Object.entries(decks));
  engine.getAudioContext = () => ({ rawContext: { currentTime: clock.now, sampleRate: 48000 } });
  engine.unlock = async () => {};
  engine.installPerformanceCapture();
  return engine;
}
function recordFrom(engine) {
  engine.performanceStartedAt = clock.now;
  engine.performanceEvents = [];
  engine.performanceLast.clear();
  engine.performanceJournal = { append: vi.fn() };
}
const transportEvents = (engine) =>
  engine.performanceEvents.filter((event) => event.type === 'deckTransport');

describe('modelled loop position', () => {
  it('matches the audio when a stored loop is enabled after seeking before it', async () => {
    clock.now = 100;
    const a = deck({ playing: true, offset: 40, startedAt: 90, loopStart: 60, loopEnd: 62 });
    const engine = engineFixture({ A: a });
    recordFrom(engine);
    expect(engine.seekDeck('A', 10)).toBe(true); // audible from 100.035
    clock.now = 101;
    // StemDeckChannel re-sends the stored region when loop is toggled on.
    expect(engine.setLoopRegion('A', true, 60, 62)).toBe(true);
    clock.now = 102.035;
    // The grain players only wrap after passing loopEnd, so audio is still at 12 s.
    expect(engine.getDeckPosition('A')).toBeCloseTo(12, 9);
    engine.pauseDeck('A');
    expect(transportEvents(engine).at(-1).args[1]).toMatchObject({ action: 'pause' });
    expect(transportEvents(engine).at(-1).args[1].position).toBeCloseTo(12, 9);
    expect(await engine.playDeck('A')).toBe(true);
    const [startTime, offset] = a.lanes.get('fullMix').player.start.mock.calls.at(-1);
    expect(startTime).toBeCloseTo(102.07, 9);
    expect(offset).toBeCloseTo(12, 9); // resumes where it paused, not at 60 s
    clock.now = a.startedAt + 50.5; // 62.5 s of source: wrapped into the loop
    expect(engine.getDeckPosition('A')).toBeCloseTo(60.5, 9);
  });

  it('still jumps into the loop when enabled past loopEnd, like the players', () => {
    clock.now = 10;
    const a = deck({ playing: true, offset: 70, startedAt: 10 });
    const engine = engineFixture({ A: a });
    engine.setLoopRegion('A', true, 60, 62);
    clock.now = 10.5;
    expect(engine.getDeckPosition('A')).toBeCloseTo(60.5, 9);
  });

  it('exits a loop in place after N cycles, like DJ players, and journals that position', () => {
    clock.now = 100;
    const a = deck({ playing: true, offset: 58, startedAt: 100 });
    const player = a.lanes.get('fullMix').player;
    const engine = engineFixture({ A: a });
    recordFrom(engine);
    engine.setLoopRegion('A', true, 60, 62); // entered at 102 s of the clock
    clock.now = 110;
    engine.setPlaybackRate('A', 1.25); // a rate change mid-loop keeps the same audio
    expect(engine.getDeckPosition('A')).toBeCloseTo(60, 9); // 4 cycles in
    clock.now = 118.56; // + 8.56 s at 1.25x: 5.35 more cycles
    expect(engine.getDeckPosition('A')).toBeCloseTo(60.7, 9);
    expect(engine.setLoopRegion('A', false, 60, 62)).toBe(true);
    // The players re-anchor at the same audio time (see WindowedGrainPlayer).
    expect(player.scheduleLoop).toHaveBeenLastCalledWith(
      { loop: false, loopStart: 60, loopEnd: 62 },
      118.56
    );
    expect(engine.getDeckPosition('A')).toBeCloseTo(60.7, 9);
    clock.now = 119.56;
    expect(engine.getDeckPosition('A')).toBeCloseTo(61.95, 9); // continues, no jump
    clock.now = 121.56;
    expect(engine.getDeckPosition('A')).toBeCloseTo(64.45, 9); // and plays past the loop
    engine.pauseDeck('A');
    expect(transportEvents(engine).at(-1).args[1].position).toBeCloseTo(64.45, 9);
    const exit = engine.performanceEvents.find(
      (event) => event.type === 'setLoopRegion' && !event.args[1]
    );
    expect(exit.scheduledTime).toBeCloseTo(18.56, 9);
  });

  it('exits a paused or not-yet-started loop at the displayed position', () => {
    clock.now = 10;
    const paused = deck({ offset: 100, looping: true, loopStart: 60, loopEnd: 62 });
    const scheduled = deck({ playing: true, offset: 70, startedAt: 10.2 });
    const engine = engineFixture({ A: paused, B: scheduled });
    expect(engine.getDeckPosition('A')).toBe(60);
    engine.setLoopRegion('A', false, 60, 62);
    expect(paused.offset).toBe(60);
    engine.setLoopRegion('B', true, 60, 62);
    engine.setLoopRegion('B', false, 60, 62); // before its audio starts: nothing looped
    expect(scheduled).toMatchObject({ offset: 70, startedAt: 10.2 });
  });

  it('re-anchors a plain Tone.GrainPlayer tick clock at the wrapped position', () => {
    clock.now = 20;
    const clockTicks = { getTicksAtTime: vi.fn(() => 73.5 / 0.1), setTicksAtTime: vi.fn() };
    const a = deck({ playing: true, looping: true, loopStart: 60, loopEnd: 62, startedAt: 0 });
    a.lanes.get('fullMix').player = {
      loop: true,
      loopStart: 60,
      loopEnd: 62,
      grainSize: 0.1,
      _clock: clockTicks,
    };
    const engine = engineFixture({ A: a });
    engine.setLoopRegion('A', false, 60, 62);
    expect(clockTicks.getTicksAtTime).toHaveBeenCalledWith(20);
    expect(clockTicks.setTicksAtTime.mock.calls[0][0] * 0.1).toBeCloseTo(61.5, 9);
    expect(clockTicks.setTicksAtTime.mock.calls[0][1]).toBe(20);
    expect(a.lanes.get('fullMix').player.loop).toBe(false);
  });
});

describe('reopening a live loop exit', () => {
  it('reconstructs the same in-place positions the live engine journaled', () => {
    clock.now = 100;
    const a = deck({ playing: true, offset: 58, startedAt: 100 });
    const engine = engineFixture({ A: a });
    recordFrom(engine);
    engine.setLoopRegion('A', true, 60, 62);
    clock.now = 110;
    engine.setPlaybackRate('A', 1.25);
    clock.now = 118.56;
    engine.setLoopRegion('A', false, 60, 62);
    clock.now = 121.56;
    engine.pauseDeck('A');
    const paused = transportEvents(engine).at(-1).args[1].position;
    const take = {
      assetId: 'safety',
      duration: 22,
      timelineStart: 0,
      events: [
        {
          time: 0,
          type: 'initialState',
          args: [
            {
              decks: [
                {
                  id: 'A',
                  playing: true,
                  position: 58,
                  playbackRate: 1,
                  lanes: { fullMix: { assetId: 'song', duration: 300 } },
                },
              ],
            },
          ],
        },
        ...structuredClone(engine.performanceEvents),
      ],
    };
    const { clips } = reconstructPerformance(emptyArrangement(), take).tracks[0];
    const positionAt = (time) => {
      const clip = clips.findLast((item) => item.start <= time);
      return clip.offset + (time - clip.start) * clip.rate;
    };
    expect(paused).toBeCloseTo(64.45, 9);
    expect(clips.at(-1).start + clips.at(-1).duration).toBeCloseTo(21.56, 9);
    expect(positionAt(21.56)).toBeCloseTo(paused, 9);
    expect(positionAt(18.56)).toBeCloseTo(60.7, 9); // the exit, in place
    expect(clips.find((clip) => clip.start === 18.56)).toMatchObject({ rate: 1.25 });
  });
});

describe('beat-sync corrections are derived, not journaled', () => {
  const gridA = { id: 'A', bpm: 120, beatOffset: 0, waveform: [1, 2, 3] };
  const gridB = { id: 'B', bpm: 100, beatOffset: 0, syncQuantum: 1 };

  async function syncedTake() {
    clock.now = 10;
    const a = deck({ playing: true, offset: 0, startedAt: 10 });
    const b = deck({ playing: true, offset: 0.13, startedAt: 10, playbackRate: 1.2 });
    const engine = engineFixture({ A: a, B: b });
    Object.assign(engine, {
      recorder: null,
      liveInput: { record: {}, monitor: {}, rawRecord: {} },
      padPlayers: new Map(),
      output: {},
    });
    engine.setProjectTempo(120);
    engine.setDeckSync('B', true, gridB, gridA);
    engine.setTempoFollow('B', null, 120);
    await engine.startRecording({ longSession: true, sources: false });
    return { engine, a, b };
  }
  const redraw = (engine, bpm = 120) => {
    // What a UI redraw sends: fresh objects, unchanged intent.
    engine.setProjectTempo(bpm);
    engine.setPlaybackRate('A', engine.decks.get('A').playbackRate);
    engine.setDeckSync('B', true, { ...gridB }, { ...gridA });
    engine.setTempoFollow('A', null, bpm);
    engine.setTempoFollow('B', null, bpm);
  };
  const phase = (engine) =>
    phaseError(
      sourceBeat(engine.getDeckPosition('A'), gridA),
      sourceBeat(engine.getDeckPosition('B'), gridB)
    );

  it('journals O(user actions) for a synced take while the controller keeps phase lock', async () => {
    const { engine, b } = await syncedTake();
    const corrections = vi.spyOn(engine, 'applyPlaybackRates');
    for (let step = 1; step <= 2400; step++) {
      clock.now = 10 + step * 0.025;
      engine.updateBeatSync();
      if (step % 40 === 0) redraw(engine);
      if (step === 1200) engine.seekDeck('B', 40); // one user action at 30 s
    }
    // Each correction used to journal setPlaybackRate plus a deckTransport "rate".
    expect(corrections.mock.calls.length).toBeGreaterThan(200);
    expect(b.syncLocked).toBe(true);
    expect(Math.abs(phase(engine))).toBeLessThan(0.02);
    const types = engine.performanceEvents.map((event) => event.type);
    expect(types).toEqual([
      'setProjectTempo',
      'setDeckSync',
      'setPlaybackRate', // the redraw's unchanged leader rate, de-duplicated after once
      'seekDeck',
      'deckTransport',
    ]);
    expect(transportEvents(engine)[0].args[1]).toMatchObject({ action: 'seek', position: 40 });
    expect(journals.at(-1).append).toHaveBeenCalledTimes(types.length);
    // The opening intent carries what replay needs: the clock phase and a compact grid.
    const [tempo, sync] = engine.performanceEvents;
    expect(tempo.args).toEqual([120, expect.any(Number)]);
    expect(tempo.scheduledTime).toBe(0);
    expect(sync.args).toEqual([
      'B',
      true,
      { id: 'B', bpm: 100, beatOffset: 0, syncQuantum: 1, followTempoMap: false },
      { id: 'A', bpm: 120, beatOffset: 0, syncQuantum: 1, followTempoMap: false },
    ]);
  });

  it('journals user tempo and sync changes once each and never a derived rate', async () => {
    const { engine, b } = await syncedTake();
    clock.now = 11;
    redraw(engine, 124);
    engine.setPlaybackRate('A', 124 / 120); // the user retempos the leader
    for (let step = 1; step <= 800; step++) {
      clock.now = 11 + step * 0.025;
      engine.updateBeatSync();
    }
    engine.setDeckSync('B', false, gridB, gridA);
    engine.setDeckSync('B', false, gridB, gridA);
    const types = engine.performanceEvents.slice(2).map((event) => event.type);
    expect(types).toEqual([
      'setProjectTempo',
      'setPlaybackRate', // redraw: unchanged leader rate
      'setPlaybackRate', // user: leader to 124 BPM
      'deckTransport',
      'setDeckSync',
    ]);
    expect(transportEvents(engine).map((event) => event.args[0])).toEqual(['A']);
    expect(b.playbackRate).toBeCloseTo(1.24, 3);
  });

  it('never confirms a derived correction as the outcome of a pending user command', async () => {
    const { engine } = await syncedTake();
    const unlocking = Promise.resolve();
    engine.unlock = () => {
      clock.now += 0.025;
      engine.updateBeatSync(); // a correction lands while Play awaits unlock
      return unlocking;
    };
    expect(await engine.playDeck('B')).toBe(true); // already playing: no transition
    expect(transportEvents(engine)).toHaveLength(0);
  });
});

describe('scheduled starts', () => {
  it('keeps a future start anchored when rate or pitch changes before it', async () => {
    clock.now = 50;
    const a = deck();
    const engine = engineFixture({ A: a });
    expect(await engine.playDeck('A', 20, 50.2)).toBe(true); // playArrangement runway
    engine.setPlaybackRate('A', 1.5);
    engine.setDeckPitch('A', 2);
    expect(a).toMatchObject({ offset: 20, startedAt: 50.2 });
    clock.now = 51.2;
    expect(engine.getDeckPosition('A')).toBeCloseTo(21.5, 9);
    engine.setPlaybackRate('A', 1);
    expect(a.startedAt).toBe(51.2);
    expect(a.offset).toBeCloseTo(21.5, 9);
  });

  it('does not apply tempo-follow corrections before a scheduled start, nor journal them', () => {
    vi.useFakeTimers();
    clock.now = 10;
    const a = deck({ playing: true, startedAt: 10.3 });
    const engine = engineFixture({ A: a });
    recordFrom(engine);
    const beats = Array.from({ length: 40 }, (_, i) => ({ time: i * 0.6 })); // 100 BPM
    engine.setTempoFollow('A', beats, 120);
    vi.advanceTimersByTime(300);
    expect(a.playbackRate).toBe(1);
    expect(a.startedAt).toBe(10.3);
    clock.now = 10.4;
    vi.advanceTimersByTime(100);
    expect(a.playbackRate).toBeCloseTo(1.2, 9);
    engine.setTempoFollow('A', null, 120);
    expect(vi.getTimerCount()).toBe(0);
    // Intent on and off; the derived 1.2x correction itself is not an event.
    expect(engine.performanceEvents.map((event) => event.args.slice(1))).toEqual([
      [beats.map(({ time }) => ({ time })), 120],
      [null, null],
    ]);
  });
});

describe('non-finite control values', () => {
  const beats = [{ time: 0 }, { time: 0.5 }, { time: 1 }];
  it.each([
    ['setPlaybackRate', ['A', NaN]],
    ['setPlaybackRate', ['A', Infinity]],
    ['setPlaybackRate', ['A', undefined]],
    ['setPlaybackRate', ['A', null]],
    ['setPlaybackRate', ['A', 'fast']],
    ['setDeckPitch', ['A', NaN]],
    ['setStemPitch', ['A', 'fullMix', -Infinity]],
    ['seekDeck', ['A', NaN]],
    ['playDeck', ['A', NaN]],
    ['playDeck', ['A', 4, Infinity]],
    ['setDeckGain', ['A', NaN]],
    ['setDeckFader', ['A', Infinity]],
    ['setCrossfader', [NaN]],
    ['setDeckEq', ['A', { low: NaN }]],
    ['setDeckFx', ['A', { echo: Infinity }]],
    ['setDeckFilter', ['A', NaN]],
    ['setLaneState', ['A', 'fullMix', { level: NaN }]],
    ['setLaneState', ['A', 'fullMix', { duration: Infinity }]],
    ['setLaneFx', ['A', 'fullMix', { send: NaN }]],
    ['setMasterLevel', [NaN]],
    ['setMasterProcessing', [{ width: NaN }]],
    ['setMasterStems', [{ vocals: { level: Infinity } }]],
    ['setLoopRegion', ['A', true, NaN, 4]],
    ['setLoop', ['A', true, Infinity]],
    ['setPadGain', [0, NaN]],
    ['triggerPad', [NaN, 220]],
    ['setProjectTempo', [NaN]],
    ['setDeckSync', ['A', true, { id: 'A', bpm: NaN }, null]],
    ['setTempoFollow', ['A', beats, Infinity]],
    ['alignDeck', ['A', { bpm: 120 }, null, NaN]],
    ['setInputSettings', [{ gainDb: NaN }]],
  ])('ignores %s(%j) without mutating state or the journal', async (method, args) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clock.now = 20;
    const a = deck({ playing: true, offset: 3, startedAt: 18, gain: 80, fader: 70 });
    const engine = engineFixture({ A: a });
    engine.crossfader = 50;
    engine.padPlayers = new Map([[0, { level: 82, gain: { gain: { rampTo: vi.fn() } } }]]);
    recordFrom(engine);
    const before = JSON.stringify([...engine.decks], (key, value) =>
      value instanceof Map ? [...value] : value
    );
    expect(await engine[method](...args)).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(
      JSON.stringify([...engine.decks], (key, value) => (value instanceof Map ? [...value] : value))
    ).toBe(before);
    expect(engine.crossfader).toBe(50);
    expect(engine.padPlayers.get(0).level).toBe(82);
    expect(Number.isFinite(engine.getDeckPosition('A'))).toBe(true);
    expect(engine.performanceEvents).toHaveLength(0);
    expect(engine.performanceJournal.append).not.toHaveBeenCalled();
  });

  it('still accepts finite numbers, numeric form strings and omitted optional values', () => {
    expect(validPerformanceInput('setCrossfader', ['40'])).toBe(true);
    expect(validPerformanceInput('playDeck', ['A'])).toBe(true);
    expect(validPerformanceInput('setLoopRegion', ['A', false])).toBe(true);
    expect(validPerformanceInput('setDeckEq', ['A', { low: 60 }])).toBe(true);
    expect(validPerformanceInput('triggerPad', [4, 'C4'])).toBe(true);
    expect(validPerformanceInput('setDeckSync', ['A', false, { bpm: NaN }])).toBe(true);
    expect(validPerformanceInput('deckTransport', ['A', { position: 3, rate: NaN }])).toBe(false);
    clock.now = 1;
    const a = deck();
    const engine = engineFixture({ A: a });
    engine.setPlaybackRate('A', '1.25');
    expect(a.playbackRate).toBe(1.25);
  });
});

describe('master assist compressor', () => {
  const param = () => ({
    linearRampTo: vi.fn(),
    setValueAtTime: vi.fn(),
    set value(_) {
      throw new Error('A stepped compressor parameter clicks.');
    },
  });
  it('glides from the held value at the live or journaled parameter time', () => {
    clock.now = 3;
    const engine = engineFixture();
    const compressor = { threshold: param(), ratio: param(), attack: param(), release: param() };
    engine.masterCompressor = compressor;
    engine.setMasterAssist(true, 'Club -9');
    expect(compressor.threshold.linearRampTo).toHaveBeenCalledWith(-12, 0.04, 3);
    expect(compressor.ratio.linearRampTo).toHaveBeenCalledWith(3.4, 0.04, 3);
    expect(compressor.attack.linearRampTo).toHaveBeenCalledWith(0.006, 0.04, 3);
    expect(compressor.release.linearRampTo).toHaveBeenCalledWith(0.14, 0.04, 3);
    recordFrom(engine);
    clock.now = 4;
    engine.setMasterAssist(false);
    expect(compressor.ratio.linearRampTo).toHaveBeenLastCalledWith(1, 0.04, 4);
    expect(engine.performanceEvents[0]).toMatchObject({
      type: 'setMasterAssist',
      scheduledTime: 1,
    });
    for (const key of Object.keys(compressor))
      expect(compressor[key].setValueAtTime).not.toHaveBeenCalled();
  });
});
