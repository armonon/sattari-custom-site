import { it, expect, vi } from 'vitest';
import { SyncClock, phaseError, sourceBeat, sourceTime } from './syncClock';
import { alignedBeatPosition } from './beatGrid';
import { StudioAudioEngine } from './studioAudioEngine';

it('integrates audio time continuously across tempo changes', () => {
  const clock = new SyncClock(120, 10);
  clock.setTempo(122, 610);
  expect(clock.beatAt(610)).toBe(1200);
  expect(clock.beatAt(670)).toBe(1322);
  clock.setTempo(90, 670);
  expect(clock.beatAt(671)).toBe(1323.5);
});
it('distinguishes beat alignment from bar downbeat alignment', () => {
  expect(alignedBeatPosition(1.5, 120, 0, 0, 120, 0, 1)).toBe(1.5);
  expect(alignedBeatPosition(1.5, 120, 0, 0, 120, 0, 4)).toBe(2);
  expect(phaseError(0.01, 0.99)).toBeCloseTo(0.02);
});
it('round-trips edited variable-tempo beat coordinates', () => {
  const grid = {
    bpm: 120,
    followTempoMap: true,
    analysis: { tempoMap: { beats: [0.2, 0.8, 1.35, 1.85].map((time) => ({ time })) } },
  };
  for (const time of [0, 0.2, 0.6, 1, 1.85, 2.2])
    expect(sourceTime(sourceBeat(time, grid), grid)).toBeCloseTo(time, 10);
});
it('slews follower phase without restarting it or moving its leader', () => {
  const deck = { playing: true, startedAt: -1, playbackRate: 1.2 };
  const engine = {
    syncClock: new SyncClock(120),
    decks: new Map([
      ['A', { playing: true, playbackRate: 1 }],
      ['B', deck],
    ]),
    syncFollowers: new Map([['B', { grid: { bpm: 100 }, reference: { id: 'A', bpm: 120 } }]]),
    getDeckPosition: (id) => (id === 'A' ? 1 : 1.188), // follower 0.02 beats late
    setPlaybackRate: vi.fn(),
  };
  StudioAudioEngine.prototype.updateBeatSync.call(engine);
  expect(engine.setPlaybackRate).toHaveBeenCalledWith('B', expect.any(Number));
  expect(engine.setPlaybackRate.mock.calls[0][1]).toBeGreaterThan(1.2);
  expect(engine.setPlaybackRate.mock.calls[0][1]).toBeLessThanOrEqual(1.224);
});
