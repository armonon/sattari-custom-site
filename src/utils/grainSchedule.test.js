import { expect, it, vi } from 'vitest';
import { GrainSchedule } from './grainSchedule';

function fixture() {
  const rawContext = { currentTime: 2 };
  const player = {
    context: { rawContext },
    _activeSources: [],
    _tick: vi.fn(),
    _clock: { _tickSource: { forEachTickBetween: vi.fn() } },
  };
  const queue = new GrainSchedule(player);
  return { player, queue, rawContext, ticks: player._clock._tickSource.forEachTickBetween };
}

it('queues a bounded native horizon without rescheduling the same interval', () => {
  const { queue, ticks, rawContext } = fixture();
  queue.pump();
  expect(ticks).toHaveBeenLastCalledWith(2, 3, expect.any(Function));
  queue.pump();
  expect(ticks).toHaveBeenCalledTimes(1);
  rawContext.currentTime = 2.7; // A 700ms UI stall is inside the queued horizon.
  queue.pump();
  expect(ticks).toHaveBeenLastCalledWith(3, 3.7, expect.any(Function));
});

it('cancels unplayed grains and rebuilds after a musical control without delaying it', () => {
  const { player, queue, ticks } = fixture();
  player._activeSources = [2.05, 2.1, 2.8].map((startTime) => ({ startTime, cancel: vi.fn() }));
  queue.pump();
  queue.invalidate(2.1);
  expect(player._activeSources.map((grain) => grain.cancel.mock.calls.length)).toEqual([0, 1, 1]);
  queue.pump();
  expect(ticks).toHaveBeenLastCalledWith(2.1, 3, expect.any(Function));
});

it('does not hide exhausted horizons or burst missed ticks outside the player deadline guard', () => {
  const { player, queue, rawContext, ticks } = fixture();
  ticks.mockImplementation((start, end, callback) => callback(start));
  queue.pump();
  rawContext.currentTime = 5;
  queue.pump();
  expect(player._tick).toHaveBeenLastCalledWith(3);
  player.failure = Error('Deadline missed');
  queue.pump();
  expect(ticks).toHaveBeenCalledTimes(2);
});

it('does not recursively pump when a natural end stops the source', () => {
  const { queue, ticks } = fixture();
  ticks.mockImplementation(() => {
    queue.invalidate(2.5);
    queue.pump();
  });
  queue.pump();
  expect(ticks).toHaveBeenCalledTimes(1);
  expect(queue.cursor).toBe(2.5);
});

it('retries a pending future page at the same grain without skipping audio', () => {
  const { player, queue, ticks } = fixture();
  ticks.mockImplementation((start, end, callback) => {
    for (let t = start; t < end; t += 0.1) callback(t);
  });
  player._tick.mockReturnValueOnce(false);
  queue.pump();
  expect(player._tick).toHaveBeenCalledTimes(1);
  expect(queue.cursor).toBe(2);
  queue.pump();
  expect(player._tick.mock.calls[1][0]).toBe(2);
  expect(queue.cursor).toBe(3);
});

it('does not double a tick delivered at adjacent floating-point boundaries', () => {
  const { player, queue, rawContext, ticks } = fixture();
  ticks.mockImplementation((start, end, callback) => callback(2.9));
  queue.pump();
  rawContext.currentTime = 2.1;
  ticks.mockImplementation((start, end, callback) => callback(2.900000000000003));
  queue.pump();
  expect(player._tick).toHaveBeenCalledTimes(1);
  queue.invalidate(2.9);
  queue.pump();
  expect(player._tick).toHaveBeenCalledTimes(2);
});
