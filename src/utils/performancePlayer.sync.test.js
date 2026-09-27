import { afterEach, expect, it, vi } from 'vitest';

const clock = vi.hoisted(() => ({ now: 0 }));
vi.mock('tone', async (original) => ({ ...(await original()), now: () => clock.now }));
vi.mock('./audioProjectStore', () => ({ getAudioAsset: vi.fn() }));

import { PerformancePlayer, replayPlan, replayScheduling } from './performancePlayer';
import { StudioAudioEngine } from './studioAudioEngine';
import { SyncClock, phaseError, sourceBeat } from './syncClock';

afterEach(() => vi.restoreAllMocks());

const grid = (id, bpm) => ({ id, bpm, beatOffset: 0, syncQuantum: 1, followTempoMap: false });
// What the live engine journals for a synced take: intent, never corrections.
const syncedTake = () => ({
  duration: 60,
  events: [
    {
      time: 0.05,
      type: 'initialState',
      args: [
        {
          decks: [
            { id: 'A', playing: true, position: 0, playbackRate: 1 },
            { id: 'B', playing: true, position: 0.15, playbackRate: 1.2 },
          ],
        },
      ],
    },
    { time: 0.01, scheduledTime: 0, type: 'setProjectTempo', args: [120, 7.5] },
    {
      time: 0.01,
      scheduledTime: 0.11,
      type: 'setDeckSync',
      args: ['B', true, grid('B', 100), grid('A', 120)],
    },
    { time: 30, scheduledTime: 30.1, type: 'setProjectTempo', args: [126, 67.5] },
  ],
});

function replayEngine() {
  const lane = () => ({ duration: 300, pitch: 0, player: { start: vi.fn(), stop: vi.fn() } });
  const deck = (overrides) => ({
    offset: 0,
    playbackRate: 1,
    pitch: 0,
    keyLock: true,
    lanes: new Map([['fullMix', lane()]]),
    ...overrides,
  });
  const engine = Object.create(StudioAudioEngine.prototype);
  engine.decks = new Map([
    ['A', deck({ playing: true, startedAt: 100 })],
    ['B', deck({ playing: true, startedAt: 100, offset: 0.15, playbackRate: 1.2 })],
  ]);
  engine.getAudioContext = () => ({ rawContext: { currentTime: clock.now, sampleRate: 48000 } });
  engine.installPerformanceCapture();
  return engine;
}

it('routes sync intent to the replay controller and journaled clock anchors to audio time', () => {
  const plan = replayPlan(syncedTake()); // supported types: no "Unsupported replay events"
  expect(plan.warnings.join(' ')).not.toContain('damaged');
  const { scheduled, dispatched } = replayScheduling(plan);
  expect(scheduled.map((event) => event.type)).toEqual(['setProjectTempo', 'setProjectTempo']);
  expect(dispatched.map((event) => event.type)).toEqual(['setDeckSync']);
});

it('replays a synced take by re-deriving the follower corrections from intent', () => {
  const base = 100;
  clock.now = base;
  const engine = replayEngine();
  const replay = new PerformancePlayer({});
  replay.engine = engine;
  const plan = replayPlan(syncedTake());
  const { scheduled, dispatched } = replayScheduling(plan);
  const rates = vi.spyOn(engine, 'applyPlaybackRates');
  for (const event of scheduled) replay.scheduleControl(event, base + event.scheduledTime);
  for (const event of dispatched) replay.dispatch(event, base + event.time);
  expect(engine.syncFollowers.get('B').reference).toEqual(grid('A', 120));
  // The anchored clock continues the live phase exactly; the queued tempo change
  // does not alter beats before its audio time.
  expect(engine.syncClock.beatAt(base + 10)).toBeCloseTo(7.5 + 20, 9);
  expect(engine.syncClock.beatAt(base + 30.1)).toBeCloseTo(67.5, 9);
  expect(engine.syncClock.beatAt(base + 31.1)).toBeCloseTo(67.5 + 126 / 60, 9);
  const phase = () =>
    phaseError(
      sourceBeat(engine.getDeckPosition('A'), grid('A', 120)),
      sourceBeat(engine.getDeckPosition('B'), grid('B', 100))
    );
  expect(Math.abs(phase())).toBeCloseTo(0.25, 6);
  for (let step = 1; step <= 1000; step++) {
    clock.now = base + step * 0.025;
    engine.updateBeatSync();
  }
  expect(rates.mock.calls.length).toBeGreaterThan(50);
  expect(Math.abs(phase())).toBeLessThan(0.005);
  expect(engine.decks.get('B').playbackRate).toBeCloseTo(1.2, 3);
  // Unplugging the leader hands the follower to the replayed project clock.
  engine.decks.get('A').playing = false;
  for (let step = 1001; step <= 2000; step++) {
    clock.now = base + step * 0.025;
    engine.updateBeatSync();
  }
  expect(engine.decks.get('B').playbackRate).toBeCloseTo(126 / 100, 3);
  const clockPhase = phaseError(
    engine.syncClock.beatAt(clock.now),
    sourceBeat(engine.getDeckPosition('B'), grid('B', 100))
  );
  expect(Math.abs(clockPhase)).toBeLessThan(0.02);
});

it('skips damaged journal rows instead of dispatching them or failing the replay', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const capture = syncedTake();
  capture.events.push(
    { time: 1.5, type: 'setDeckEq', args: ['A', { low: NaN }] },
    { time: 2.5, type: 'deckTransport', args: ['A', { position: NaN, rate: 1, playing: true }] },
    { time: 3, type: 'setPlaybackRate', args: ['B', Infinity] },
    { time: NaN, type: 'setDeckGain', args: ['A', 50] },
    { time: 4, type: 'setProjectTempo', args: [-120, 0] }
  );
  const plan = replayPlan(capture);
  expect(plan.events.map((event) => event.type)).toEqual([
    'setProjectTempo',
    'setDeckSync',
    'setProjectTempo',
  ]);
  expect(plan.warnings.join(' ')).toContain('5 damaged event(s)');
  expect(warn).toHaveBeenCalled();
  // Defense in depth: a damaged row reaching the dispatcher is skipped (undefined),
  // not reported as a failed transport change (false), which stops the replay.
  const replay = new PerformancePlayer({});
  replay.engine = { setPlaybackRate: vi.fn(), decks: new Map() };
  expect(replay.dispatch({ type: 'setPlaybackRate', args: ['A', NaN] }, 1)).toBeUndefined();
  const roundTripped = JSON.parse(JSON.stringify({ type: 'setPlaybackRate', args: ['A', NaN] }));
  expect(replay.dispatch(roundTripped, 1)).toBeUndefined();
  expect(replay.engine.setPlaybackRate).not.toHaveBeenCalled();
});

it('anchors queued tempo changes without moving earlier beats', () => {
  const syncClock = new SyncClock(120, 10, 4);
  syncClock.anchor(90, 12, 8);
  syncClock.anchor(140, 13, 9.5);
  expect(syncClock.beatAt(11)).toBeCloseTo(6, 9);
  expect(syncClock.bpmAt(11.9)).toBe(120);
  expect(syncClock.beatAt(12.5)).toBeCloseTo(8.75, 9);
  expect(syncClock.beatAt(14)).toBeCloseTo(9.5 + 140 / 60, 9);
  syncClock.anchor(100, 20, 30); // history older than 5 s folds into the base
  expect(syncClock.anchors).toHaveLength(1);
  expect(syncClock.beatAt(19)).toBeCloseTo(9.5 + (6 * 140) / 60, 9);
  syncClock.setTempo(110, 21); // a live edit supersedes queued anchors
  expect(syncClock.anchors).toBeUndefined();
  expect(syncClock.beatAt(22)).toBeCloseTo(30 + 100 / 60 + 110 / 60, 9);
});

it('queues a synced deck’s pitch without its stale journal-time rate and keeps it through corrections', async () => {
  vi.useFakeTimers();
  try {
    const lanePlayer = () => ({
      schedulePlaybackRate: vi.fn(),
      schedulePitch: vi.fn(),
      scheduleLoop: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      set detune(value) {
        this.detunes = [...(this.detunes || []), value];
      },
    });
    const engine = replayEngine();
    for (const deck of engine.decks.values()) {
      deck.keyLock = false;
      deck.lanes.get('fullMix').player = lanePlayer();
    }
    engine.unlock = async () => {};
    const replay = new PerformancePlayer({});
    Object.assign(replay, {
      engine,
      raw: { currentTime: 100 },
      capture: { duration: 60 },
      queueInputs: vi.fn(async () => {}),
      queueSources: vi.fn(async () => {}),
      scheduleControl: vi.fn(),
    });
    const capture = syncedTake();
    capture.events[0].args[0].decks.forEach((deck) => (deck.keyLock = false));
    capture.events.push({ time: 5, type: 'setDeckPitch', args: ['B', 2] });
    replay.plan = replayPlan(capture);
    await replay.play();
    clearInterval(replay.timer);
    expect([...replay.pitchFollowDecks]).toEqual(['B']);
    expect(engine.decks.get('B').pitchScheduled).toBe(true);
    const pitch = replay.scheduled.find((event) => event.type === 'setDeckPitch');
    const player = engine.decks.get('B').lanes.get('fullMix').player;
    PerformancePlayer.prototype.scheduleControl.call(replay, pitch, 105);
    expect(player.schedulePitch).toHaveBeenCalledWith(105, 200, { followRate: true });
    expect(player.schedulePlaybackRate).not.toHaveBeenCalledWith(1.2, 105, expect.anything());
    // Opening transport: journaled rate plus rate-following musical pitch.
    expect(player.schedulePlaybackRate).toHaveBeenCalledWith(1.2, 100.55, expect.any(Number));
    expect(player.schedulePitch).toHaveBeenCalledWith(100.55, 0, { followRate: true });
    // The re-derived controller corrects the rate but never rewrites queued pitch.
    replay.dispatch(
      replay.plan.events.find((event) => event.type === 'setDeckSync'),
      100
    );
    engine.syncClock = new SyncClock(120, 100, 0);
    clock.now = 100.6;
    engine.updateBeatSync();
    expect(player.playbackRate).not.toBe(1.2);
    expect(player.detunes).toBeUndefined();
    // Live (unsynced, unscheduled) rate changes still set detune as before.
    engine.decks.get('A').lanes.get('fullMix').player = lanePlayer();
    engine.setPlaybackRate('A', 1.1);
    expect(engine.decks.get('A').lanes.get('fullMix').player.detunes).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

it('replays a loop exit in place, matching the live position', () => {
  // Live: A plays from 58 s at 100 s, loop 60-62 from 100 s, exit at 118.56 s.
  clock.now = 100;
  const live = replayEngine();
  Object.assign(live.decks.get('A'), { offset: 58, startedAt: 100 });
  live.decks.get('A').lanes.get('fullMix').player.scheduleLoop = vi.fn();
  live.setLoopRegion('A', true, 60, 62);
  clock.now = 118.56;
  live.setLoopRegion('A', false, 60, 62);
  // Replay: the same loop events queued ahead through scheduleControl.
  clock.now = 100;
  const engine = replayEngine();
  Object.assign(engine.decks.get('A'), { offset: 58, startedAt: 100 });
  const player = engine.decks.get('A').lanes.get('fullMix').player;
  player.scheduleLoop = vi.fn();
  const replay = new PerformancePlayer({});
  replay.engine = engine;
  replay.scheduleControl({ type: 'setLoopRegion', args: ['A', true, 60, 62] }, 100);
  replay.scheduleControl({ type: 'setLoopRegion', args: ['A', false, 60, 62] }, 118.56);
  expect(player.scheduleLoop.mock.calls).toEqual(
    live.decks.get('A').lanes.get('fullMix').player.scheduleLoop.mock.calls
  );
  replay.commitLoopStates(118.56);
  for (const time of [118.56, 119.56, 125]) {
    clock.now = time;
    expect(engine.getDeckPosition('A')).toBeCloseTo(live.getDeckPosition('A'), 9);
  }
  expect(engine.getDeckPosition('A')).toBeCloseTo(60.56 + 6.44, 9);
});
