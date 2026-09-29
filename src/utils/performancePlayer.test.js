import { deferred } from '../test/deferred';
import { it, expect, vi } from 'vitest';
import {
  replayPlan,
  replayScheduling,
  REPLAY_METHODS,
  PerformancePlayer,
} from './performancePlayer';
import { newEffect } from './arrangementEffects';
import { getAudioAsset } from './audioProjectStore';
import { performanceFilter } from './performanceFilter';
vi.mock('./audioProjectStore', () => ({ getAudioAsset: vi.fn() }));
const take = () => ({
  duration: 8,
  events: [
    { time: 0, type: 'initialState', args: [{ dspVersion: 2, decks: [] }] },
    { time: 1, type: 'setDeckFx', args: ['A', { echo: 50 }] },
    { time: 2, type: 'deckTransport', args: ['A', { position: 3, rate: 1, playing: true }] },
    { time: 1.9, type: 'playDeck', args: ['A'] },
  ],
});
it.each([true, false])(
  'schedules rate and key-lock=%s pitch together without moving the UI early',
  (keyLock) => {
    const player = { schedulePlaybackRate: vi.fn(), stop: vi.fn(), start: vi.fn() };
    const deck = {
      playbackRate: 1,
      pitch: 2,
      keyLock,
      offset: 0,
      playing: false,
      lanes: new Map([['vocals', { player, duration: 100, pitch: -1 }]]),
    };
    const replay = new PerformancePlayer({});
    replay.raw = { currentTime: 5 };
    replay.engine = { decks: new Map([['A', deck]]), applyPlaybackRates: vi.fn() };
    replay.transport('A', { rate: 2, position: 20, playing: true }, 6);
    expect(player.schedulePlaybackRate).toHaveBeenCalledWith(2, 6, keyLock ? 100 : 1300);
    expect(player.start).toHaveBeenCalledWith(6, 10);
    expect(replay.engine.applyPlaybackRates).not.toHaveBeenCalled();
    expect(deck).toMatchObject({ playbackRate: 1, offset: 0, playing: false });
    replay.commitLoopStates(5.999);
    expect(deck.playing).toBe(false);
    replay.commitLoopStates(6);
    expect(deck).toMatchObject({ playbackRate: 2, offset: 20, playing: true, startedAt: 6 });
  }
);
it('commits replay loop display state only at its audible time and ignores replaced decks', () => {
  const lane = { duration: 60, player: { scheduleLoop: vi.fn() } };
  const deck = { looping: false, lanes: new Map([['vocals', lane]]) };
  const replay = new PerformancePlayer({});
  replay.engine = { decks: new Map([['A', deck]]) };
  replay.scheduleControl({ type: 'setLoopRegion', args: ['A', true, 4, 8] }, 10);
  expect(lane.player.scheduleLoop).toHaveBeenCalledWith(
    { loop: true, loopStart: 4, loopEnd: 8 },
    10
  );
  replay.commitLoopStates(9.999);
  expect(deck.looping).toBe(false);
  replay.commitLoopStates(10);
  expect(deck).toMatchObject({ looping: true, loopStart: 4, loopEnd: 8, loopTransitionTime: 10 });
  replay.scheduleControl({ type: 'setLoopRegion', args: ['A', false, 4, 8] }, 12);
  replay.commitLoopStates(11);
  expect(deck.looping).toBe(true);
  const replacement = { looping: true };
  replay.engine.decks.set('A', replacement);
  replay.commitLoopStates(12);
  expect(replacement.looping).toBe(true);
  expect(replay.pendingLoopStates).toHaveLength(0);
});
it('prefetches scheduled seeks and new loops after events have been partitioned for dispatch', async () => {
  const warm = vi.fn(async () => {});
  const replay = new PerformancePlayer({});
  replay.engine = {
    decks: new Map([
      ['A', { lanes: new Map([['vocals', { assetId: 'song', player: { warmWindow: warm } }]]) }],
    ]),
    padPlayers: new Map(),
  };
  replay.sourceCache = { prepare: vi.fn(async () => {}) };
  replay.sourceEvents = [];
  replay.plan = { events: [] };
  replay.transportEvents = [{ type: 'deckTransport', time: 5, args: ['A', { position: 150 }] }];
  replay.loopEvents = [{ type: 'setLoopRegion', time: 5, args: ['A', true, 75, 77] }];
  await replay.queueSources(3);
  expect(warm).toHaveBeenCalledWith(
    150,
    { loop: false, prepareSeconds: 1, priority: 1 },
    expect.any(Function),
    expect.any(Function)
  );
  expect(warm).toHaveBeenCalledWith(
    75,
    { loop: true, loopStart: 75, loopEnd: 77, prepareSeconds: 1, priority: 1 },
    expect.any(Function),
    expect.any(Function)
  );
});

it.each(['stop', 'replace', 'deadline'])(
  'prepares upcoming loops and seeks in deadline order and retires retention on %s',
  async (reason) => {
    const warm = vi.fn(async () => {});
    const lane = { assetId: 'song', player: { warmWindow: warm } };
    const deck = { lanes: new Map([['vocals', lane]]) };
    const replay = new PerformancePlayer({});
    replay.engine = { decks: new Map([['A', deck]]), padPlayers: new Map() };
    replay.raw = { currentTime: 10 };
    replay.base = 10;
    replay.sourceCache = { prepare: vi.fn(async () => {}) };
    replay.sourceEvents = [];
    replay.transportEvents = [
      { type: 'deckTransport', time: 7, args: ['A', { position: 150 }] },
      { type: 'deckTransport', time: 4, args: ['A', { position: 80, action: 'rate' }] },
      { type: 'deckTransport', time: 9, args: ['A', { position: 40 }] },
    ];
    replay.loopEvents = [{ type: 'setLoopRegion', time: 5, args: ['A', true, 75, 77] }];
    await replay.queueSources(0);
    expect(warm.mock.calls.map(([position]) => position)).toEqual([75, 150]);
    const [, , current, retainUntil] = warm.mock.calls[0];
    expect(current).toBe(retainUntil);
    expect(current()).toBe(true);
    if (reason === 'stop') replay.stopped = true;
    if (reason === 'replace') deck.lanes.delete('vocals');
    if (reason === 'deadline') replay.raw.currentTime = 15.2;
    expect(current()).toBe(false);
  }
);
it('uses source seconds for confirmed transport when a grain player runs at non-unit rate', () => {
  const source = { start: vi.fn(), stop: vi.fn() };
  const deck = {
    playing: false,
    playbackRate: 1,
    lanes: new Map([['full', { player: source, duration: 100 }]]),
  };
  const engine = { decks: new Map([['A', deck]]), applyPlaybackRates: vi.fn() };
  PerformancePlayer.prototype.transport.call(
    { engine },
    'A',
    { position: 30, rate: 1.5, playing: true },
    7.125
  );
  expect(source.start).toHaveBeenCalledWith(7.125, 20);
  expect(deck.playbackRate).toBe(1.5);
  expect(engine.applyPlaybackRates.mock.invocationCallOrder[0]).toBeLessThan(
    source.start.mock.invocationCallOrder[0]
  );
});
it('queues stable deck filter sweeps at audio time without switching future filter types early', () => {
  const initial = {
    decks: [
      { id: 'A', filter: 50 },
      { id: 'B', filter: 80 },
    ],
  };
  const low = { type: 'setDeckFilter', args: ['A', 25] };
  const high = { type: 'setDeckFilter', args: ['B', 90] };
  const switched = { type: 'setDeckFilter', args: ['A', 75] };
  expect(replayScheduling({ initial, events: [low, high] }).scheduled).toEqual([low, high]);
  const mixed = replayScheduling({ initial, events: [low, switched, high] });
  expect(mixed.scheduled).toEqual([high]);
  expect(mixed.dispatched).toEqual([low, switched]);
  const rampTo = vi.fn();
  const filter = { type: 'lowpass', frequency: { rampTo } };
  PerformancePlayer.prototype.scheduleControl.call(
    { engine: { decks: new Map([['A', { filter }]]) } },
    low,
    123.456
  );
  expect(rampTo).toHaveBeenCalledWith(performanceFilter(25).frequency, 0.035, 123.456);
  expect(filter.type).toBe('lowpass');
});
it('retains the live filter curve and neutral deadband', () => {
  expect(performanceFilter(0)).toEqual({ type: 'lowpass', frequency: 70 });
  expect(performanceFilter(48)).toEqual({ type: 'lowpass', frequency: 20000 });
  expect(performanceFilter(52)).toEqual({ type: 'lowpass', frequency: 20000 });
  expect(performanceFilter(100)).toEqual({ type: 'highpass', frequency: 7500 });
});
it('does not restart a playing source for a confirmed rate-only transition', () => {
  const source = { stop: vi.fn(), start: vi.fn() };
  const deck = {
    playing: true,
    playbackRate: 1,
    lanes: new Map([['vocals', { player: source, duration: 60 }]]),
  };
  const engine = { decks: new Map([['A', deck]]), applyPlaybackRates: vi.fn() };
  PerformancePlayer.prototype.transport.call(
    { engine },
    'A',
    { action: 'rate', playing: true, position: 10, rate: 1.2 },
    42
  );
  expect(source.stop).not.toHaveBeenCalled();
  expect(source.start).not.toHaveBeenCalled();
  expect(deck.playbackRate).toBe(1.2);
  expect(engine.applyPlaybackRates).toHaveBeenCalledWith(deck);
});
it('replays all built-in effect and master control event types through an explicit allowlist', () => {
  for (const name of [
    'setDeckEq',
    'setDeckFilter',
    'setDeckFx',
    'setLaneFx',
    'setDeckPitch',
    'setDeckKeyLock',
    'setStemPitch',
    'setMasterProcessing',
    'setMasterStems',
    'setLimiter',
    'setMasterAssist',
    'setLoopRegion',
  ])
    expect(REPLAY_METHODS.has(name)).toBe(true);
  expect(replayPlan(take()).events.map((e) => e.type)).toEqual(['setDeckFx', 'deckTransport']);
});
it('honors disabled/retimed edits and rejects unknown operations rather than invoking arbitrary methods', () => {
  const capture = take();
  capture.events[1].disabled = true;
  expect(replayPlan(capture).events).toHaveLength(1);
  capture.events.push({ time: 1, type: 'dispose', args: [] });
  expect(() => replayPlan(capture)).toThrow('Unsupported replay');
});
it('keeps another deck’s legacy transport when only one deck has confirmed events', () => {
  const capture = take();
  capture.events.push({ time: 1, type: 'playDeck', args: ['B'] });
  expect(replayPlan(capture).events.some((e) => e.type === 'playDeck' && e.args[0] === 'B')).toBe(
    true
  );
  expect(replayPlan(capture).warnings.join(' ')).toContain('Legacy transport');
});
it('warns that legacy random reverb and missing opening state cannot be recreated exactly', () => {
  const capture = take();
  capture.events[0].args[0] = { decks: [{ playing: true }] };
  expect(replayPlan(capture).warnings).toHaveLength(2);
});
it('schedules common effect ramps on AudioParams at their target time, not the timer callback time', () => {
  const rampTo = vi.fn(),
    wet = { rampTo };
  const player = { engine: { decks: new Map([['A', { reverb: { wet }, delay: { wet } }]]) } };
  PerformancePlayer.prototype.scheduleControl.call(
    player,
    { type: 'setDeckFx', args: ['A', { echo: 25, reverb: 50 }] },
    123.456
  );
  expect(rampTo.mock.calls).toEqual([
    [0.5, 0.04, 123.456],
    [0.25, 0.04, 123.456],
  ]);
});
it('schedules stem gains independently while keeping changed insert topology on the dispatcher', () => {
  const effect = newEffect('echo');
  const initial = { masterProcessing: { effects: [effect] } };
  const event = {
    type: 'setMasterProcessing',
    args: [{ effects: [{ ...effect, params: { ...effect.params, mix: 0.8 } }] }],
  };
  expect(replayScheduling({ initial, events: [event] }).scheduled.map((e) => e.type)).toEqual([
    'compiledMix',
    'setMasterProcessing',
  ]);
  const topology = { type: 'setMasterProcessing', args: [{ effects: [] }] };
  expect(
    replayScheduling({ initial, events: [event, topology] }).scheduled.map((e) => e.type)
  ).toEqual(['compiledMix', 'compiledMix']);
  expect(
    replayScheduling({ initial, events: [event, topology] }).dispatched.every((e) => e.mixScheduled)
  ).toBe(true);
  const stems = { type: 'setMasterStems', args: [{ vocals: { muted: true } }] };
  expect(
    replayScheduling({ initial, events: [event, stems] }).scheduled.map((e) => e.type)
  ).toEqual(['compiledMix', 'setMasterStems']);
});
it('does not overwrite queued master-stem ramps when dispatching an insert graph change', () => {
  const replay = new PerformancePlayer({});
  replay.engine = { setMasterProcessing: vi.fn() };
  const settings = { effects: [], stems: { vocals: { level: 40 } } };
  replay.dispatch({ type: 'setMasterProcessing', args: [settings], mixScheduled: true }, 4);
  expect(replay.engine.setMasterProcessing).toHaveBeenCalledWith(settings, { applyStems: false });
});
it('commits scheduled mixer metadata at audio time without issuing new gain ramps', () => {
  const replay = new PerformancePlayer({});
  const rampTo = vi.fn();
  const deck = { side: 'left', lanes: new Map([['vocals', { level: 100 }]]) };
  replay.engine = { decks: new Map([['A', deck]]), unseparated: { gain: { rampTo } } };
  replay.scheduleControl(
    {
      type: 'setMasterStems',
      args: [{ vocals: { level: 80 } }],
      mixRamps: [{ target: 'unseparated', value: 1 }],
    },
    10
  );
  replay.scheduleControl({ type: 'setDeckSide', args: ['A', 'right'], mixRamps: [] }, 10);
  replay.commitLoopStates(9);
  expect(replay.engine.masterStems).toBeUndefined();
  expect(deck.side).toBe('left');
  replay.commitLoopStates(10);
  expect(replay.engine.masterStems.vocals.level).toBe(80);
  expect(deck.side).toBe('right');
  expect(rampTo).toHaveBeenCalledExactlyOnceWith(1, 0.025, 10);
});
it('master automation uses the same values and smoothing as the live graph at a future audio time', () => {
  const param = () => ({ rampTo: vi.fn(), setValueAtTime: vi.fn(), linearRampTo: vi.fn() });
  const e = {
    masterInputTrim: { gain: param() },
    masterLimiterDrive: { gain: param() },
    masterEq: {
      low: param(),
      mid: param(),
      high: param(),
      lowFrequency: param(),
      highFrequency: param(),
    },
    masterLowCut: { frequency: param() },
    masterWidth: { width: param() },
    limiter: { threshold: param() },
    masterInserts: { schedule: vi.fn() },
    masterCompressor: { threshold: param(), ratio: param(), attack: param(), release: param() },
  };
  PerformancePlayer.prototype.scheduleControl.call(
    { engine: e },
    {
      type: 'setMasterProcessing',
      args: [
        {
          low: 6,
          width: 80,
          ceiling: -2,
          inputTrim: -6,
          limiterDrive: 3,
          lowFrequency: 400,
          highFrequency: 4000,
        },
      ],
    },
    42
  );
  expect(e.masterEq.low.rampTo).toHaveBeenCalledWith(6, 0.04, 42);
  expect(e.masterWidth.width.rampTo).toHaveBeenCalledWith(0.4, 0.04, 42);
  expect(e.limiter.threshold.rampTo).toHaveBeenCalledWith(-2, 0.04, 42);
  expect(e.masterInserts.schedule).toHaveBeenCalledWith([], 42);
  expect(e.masterInputTrim.gain.rampTo).toHaveBeenCalledWith(10 ** (-6 / 20), 0.04, 42);
  expect(e.masterLimiterDrive.gain.rampTo).toHaveBeenCalledWith(10 ** (3 / 20), 0.04, 42);
  expect(e.masterEq.lowFrequency.rampTo).toHaveBeenCalledWith(400, 0.04, 42);
  expect(e.masterEq.highFrequency.rampTo).toHaveBeenCalledWith(4000, 0.04, 42);
  PerformancePlayer.prototype.scheduleControl.call(
    { engine: e },
    { type: 'setMasterAssist', args: [false] },
    43
  );
  // The live compressor glides (k-rate threshold/ratio steps click); replay matches it.
  expect(e.masterCompressor.ratio.linearRampTo).toHaveBeenCalledWith(1, 0.04, 43);
  expect(e.masterCompressor.threshold.linearRampTo).toHaveBeenCalledWith(-1, 0.04, 43);
  for (const key of ['threshold', 'ratio', 'attack', 'release'])
    expect(e.masterCompressor[key].setValueAtTime).not.toHaveBeenCalled();
});

it('queues stable transport ahead but never applies future rate, pitch or source mutations early', () => {
  const transport = {
    time: 1,
    type: 'deckTransport',
    args: ['A', { action: 'play', playing: true, rate: 1 }],
  };
  const initial = { decks: [{ id: 'A', playbackRate: 1 }] };
  expect(replayScheduling({ initial, events: [transport] }).scheduled).toEqual([transport]);
  for (const change of [
    { type: 'setDeckPitch', args: ['A', 2] },
    { type: 'setLoopRegion', args: ['A', true, 0, 4] },
    { type: 'setLaneState', args: ['A', 'vocals', { assetId: 'replacement' }] },
    { type: 'deckTransport', args: ['A', { rate: 1.2, playing: true }] },
  ]) {
    expect(replayScheduling({ initial, events: [transport, change] }).dispatched).toContain(
      transport
    );
  }
});

it('preloads captured input before starting the recording clock and primes confirmed transport without adding lookahead twice', async () => {
  vi.useFakeTimers();
  try {
    const raw = { currentTime: 0 };
    const order = [];
    const player = new PerformancePlayer({});
    player.raw = raw;
    player.engine = {
      decks: new Map(),
      unlock: async () => {},
      startRecording: async () => {
        order.push('record');
      },
      getAudioContext: () => ({ lookAhead: 0.1 }),
    };
    player.plan = {
      initial: { decks: [] },
      events: [{ time: 0, type: 'deckTransport', args: ['A', { playing: true, rate: 1 }] }],
    };
    player.capture = { duration: 10 };
    player.queueInputs = vi.fn(async (_elapsed, preload) => {
      if (preload) {
        order.push('decode');
        raw.currentTime = 4;
      }
    });
    player.scheduleControl = vi.fn();
    await player.play({ record: true });
    expect(order).toEqual(['decode', 'record']);
    expect(player.base).toBe(4.5);
    expect(player.scheduleControl).toHaveBeenCalledWith(player.scheduled[0], 4.5);
    clearInterval(player.timer);
  } finally {
    vi.useRealTimers();
  }
});

it('schedules loops and seeks ahead only when the granular players support timestamped loop state', () => {
  const initial = { decks: [{ id: 'A', playbackRate: 1 }] };
  const loop = { type: 'setLoopRegion', time: 2, args: ['A', true, 50, 52] };
  const seek = {
    type: 'deckTransport',
    time: 3,
    args: ['A', { position: 80, rate: 1, playing: true }],
  };
  expect(replayScheduling({ initial, events: [loop, seek] }).dispatched).toEqual([loop, seek]);
  expect(
    replayScheduling({ initial, events: [loop, seek] }, { scheduledLoopDecks: new Set(['A']) })
      .scheduled
  ).toEqual([loop, seek]);
  const scheduleLoop = vi.fn();
  const deck = {
    looping: false,
    lanes: new Map([['vocals', { duration: 180, player: { scheduleLoop } }]]),
  };
  PerformancePlayer.prototype.scheduleControl.call(
    { engine: { decks: new Map([['A', deck]]) } },
    loop,
    123
  );
  expect(scheduleLoop).toHaveBeenCalledWith({ loop: true, loopStart: 50, loopEnd: 52 }, 123);
  expect(deck.looping).toBe(false); // Future scheduling does not flip present state.
});

it('does not retain decoded input or revive playback after disposal during async preparation', async () => {
  const player = new PerformancePlayer({});
  const decoding = deferred();
  const enteredDecode = deferred();
  player.raw = {
    decodeAudioData: vi.fn(() => {
      enteredDecode.resolve();
      return decoding.promise;
    }),
    createBufferSource: vi.fn(),
  };
  player.engine = { dispose: vi.fn() };
  player.capture = {};
  player.inputs = [{ clips: [{ id: 'input', assetId: 'asset', start: 0, duration: 2 }] }];
  vi.mocked(getAudioAsset).mockResolvedValue({
    blob: { size: 16, arrayBuffer: async () => new ArrayBuffer(16) },
  });
  const pending = player.queueInputs(0, true);
  await enteredDecode.promise;
  player.dispose();
  decoding.resolve({ length: 96000, numberOfChannels: 2 });
  await pending;
  expect(player.inputBuffers.size).toBe(0);
  expect(player.inputBytes).toBe(0);
  expect(player.raw.createBufferSource).not.toHaveBeenCalled();
  await player.play(); // A disposed, one-shot player must not unlock/restart.
  expect(player.stopped).toBe(true);
});

it('does not restart if stopped while waiting for audio unlock', async () => {
  const unlocking = deferred();
  const player = new PerformancePlayer({});
  player.engine = { unlock: () => unlocking.promise, dispose: vi.fn() };
  player.queueInputs = vi.fn();
  const pending = player.play();
  player.dispose();
  unlocking.resolve();
  await pending;
  expect(player.queueInputs).not.toHaveBeenCalled();
  expect(player.stopped).toBe(true);
});
