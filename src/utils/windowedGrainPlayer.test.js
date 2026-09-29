import { deferred } from '../test/deferred';
import { expect, it, vi } from 'vitest';
import { WindowedGrainPlayer } from './windowedGrainPlayer';

it('schedules transport rate and detune at the same boundary and invalidates only future grains', () => {
  const player = Object.create(WindowedGrainPlayer.prototype);
  player.pitchCents = 100;
  player._grainSize = 0.1;
  player._clock = { frequency: { setValueAtTime: vi.fn() } };
  player.grainSchedule = { invalidate: vi.fn(), pump: vi.fn() };
  player.schedulePlaybackRate(2, 10, 1300);
  expect(player._clock.frequency.setValueAtTime).toHaveBeenCalledWith(20, 10);
  expect(player.pitchSchedule).toEqual([
    { time: -Infinity, value: 100 },
    { time: 10, value: 1300 },
  ]);
  expect(player.grainSchedule.invalidate).toHaveBeenCalledWith(10);
  expect(player.grainSchedule.pump).toHaveBeenCalledOnce();
  expect(() => player.schedulePlaybackRate(NaN, 10)).toThrow('Invalid playback rate');
});

it('retains the prepared seek offset across a sub-sample stop/start clock boundary', () => {
  const player = Object.create(WindowedGrainPlayer.prototype);
  player._grainSize = 0.085;
  player.sourceStarts = [
    { time: 2, ticks: 15 / 0.085 },
    { time: 12.356, ticks: 40 / 0.085 },
  ];
  player._clock = {
    getTicksAtTime: vi.fn(() => 0),
    frequency: { getTicksAtTime: (time) => time / 0.085 },
  };
  expect(player.sourceOffsetAt(12.355999999999998)).toBeCloseTo(40, 10);
  expect(player.sourceOffsetAt(12.356)).toBeCloseTo(40, 10);
  expect(player.sourceOffsetAt(12.356 + 0.085)).toBeCloseTo(40.085, 10);
  expect(player.sourceOffsetAt(12.355)).toBeCloseTo(25.355, 10);
  expect(player._clock.getTicksAtTime).not.toHaveBeenCalled();
});

it('drops canceled future seek anchors when stopped before their scheduled time', () => {
  const player = Object.create(WindowedGrainPlayer.prototype);
  player._grainSize = 0.085;
  player.sourceStarts = [
    { time: 2, ticks: 15 / 0.085 },
    { time: 10, ticks: 150 / 0.085 },
  ];
  player._clock = {
    stop: vi.fn(),
    frequency: { getTicksAtTime: (time) => time / 0.085 },
  };
  player._stop(5);
  expect(player._clock.stop).toHaveBeenCalledWith(5);
  expect(player.sourceStarts).toHaveLength(1);
  player.sourceStarts.push({ time: 6, ticks: 40 / 0.085 });
  expect(player.sourceOffsetAt(10)).toBeCloseTo(44, 10);
  player._stop(6);
  expect(player.sourceStarts).toHaveLength(1);
});

it.each([false, true])(
  'handles background-read failure after superseded=%s',
  async (superseded) => {
    const pending = deferred();
    const player = Object.create(WindowedGrainPlayer.prototype);
    Object.defineProperty(player, 'context', { value: { now: () => 5 } });
    player.pool = {
      prepare: vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined),
    };
    player.stop = vi.fn();
    const job = player.prefetchWindow(0, { loop: false });
    if (superseded) await player.prepareWindow(50, { loop: false });
    pending.reject(new Error('Old read failed'));
    await job;
    expect(player.stop).toHaveBeenCalledTimes(superseded ? 0 : 1);
    expect(player.failure?.message).toBe(superseded ? undefined : 'Old read failed');
    expect(player.preparing).toBeNull();
  }
);

it('selects loop state by grain audio time without applying future changes early', () => {
  const player = Object.create(WindowedGrainPlayer.prototype);
  player.source = { duration: 180 };
  player.loop = false;
  player._loopStart = 0;
  player._loopEnd = 180;
  player.scheduleLoop({ loop: true, loopStart: 75, loopEnd: 77 }, 10);
  player.scheduleLoop({ loop: false, loopStart: 75, loopEnd: 77 }, 12);
  expect(player.loopStateAt(9.999).loop).toBe(false);
  expect(player.loopStateAt(10)).toMatchObject({ loop: true, loopStart: 75, loopEnd: 77 });
  expect(player.loopStateAt(12).loop).toBe(false);
  expect(player.loopStateAt(10.5).loop).toBe(true); // A future prefetch is a read, not a mutation.
});

it('starts destination read-ahead without waiting for an obsolete pre-seek read', async () => {
  const old = deferred();
  const fresh = deferred();
  const player = Object.create(WindowedGrainPlayer.prototype);
  player.pool = {
    prepare: vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(fresh.promise),
  };
  const oldJob = player.prefetchWindow(1, { loop: false });
  const isOldCurrent = player.pool.prepare.mock.calls[0][3];
  expect(isOldCurrent()).toBe(true);
  await player.prepareWindow(150, { loop: false });
  expect(isOldCurrent()).toBe(false);
  const freshJob = player.prefetchWindow(151, { loop: false });
  expect(player.pool.prepare).toHaveBeenCalledTimes(3);
  old.resolve();
  await oldJob;
  expect(player.preparing).toBe(freshJob);
  fresh.resolve();
  await freshJob;
  expect(player.preparing).toBeNull();
});

it('warms a future replay destination without canceling currently audible read-ahead', async () => {
  const pending = deferred();
  const player = Object.create(WindowedGrainPlayer.prototype);
  player.pool = {
    prepare: vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(undefined),
  };
  const background = player.prefetchWindow(1, { loop: false });
  const isCurrent = player.pool.prepare.mock.calls[0][3];
  await player.warmWindow(150, { loop: false, prepareSeconds: 1 });
  expect(isCurrent()).toBe(true);
  expect(player.preparing).toBe(background);
  pending.resolve();
  await background;
});

it('preserves prototype-backed loop controls when prioritizing audible reads', async () => {
  const player = Object.create(WindowedGrainPlayer.prototype);
  player.pool = { prepare: vi.fn().mockResolvedValue(undefined) };
  const region = Object.create({ loop: true, loopStart: 75, loopEnd: 77 });
  await player.prefetchWindow(150, region);
  expect(player.pool.prepare).toHaveBeenCalledWith(
    undefined,
    150,
    { loop: true, loopStart: 75, loopEnd: 77, prepareSeconds: undefined, priority: 1 },
    expect.any(Function)
  );
});

it('contains a missed real-time deadline without decoding or bursting obsolete grains', () => {
  const player = Object.create(WindowedGrainPlayer.prototype);
  Object.defineProperty(player, 'context', {
    value: { isOffline: false, rawContext: { currentTime: 5 }, now: () => 5.1 },
  });
  player.stop = vi.fn();
  player.pool = { acquire: vi.fn() };
  player._tick(4.9);
  expect(player.deadlineMisses).toBe(1);
  expect(player.failure.message).toContain('scheduling fell behind');
  expect(player.lastUnderrun).toMatchObject({ kind: 'scheduler-deadline', time: 4.9 });
  expect(player.stop).toHaveBeenCalledWith(5.1);
  expect(player.pool.acquire).not.toHaveBeenCalled();
  player._tick(4.95);
  expect(player.deadlineMisses).toBe(1);
  expect(player.stop).toHaveBeenCalledTimes(1);
});
