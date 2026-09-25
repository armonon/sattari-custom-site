import { it, expect, vi } from 'vitest';
vi.mock('tone', async (original) => ({ ...(await original()), now: () => 12 }));
import { StudioAudioEngine } from './studioAudioEngine';
function engineFixture() {
  const engine = Object.create(StudioAudioEngine.prototype);
  const player = { stop: vi.fn(), start: vi.fn() };
  const deck = {
    playing: true,
    offset: 2,
    startedAt: 10,
    playbackRate: 1,
    pitch: 0,
    keyLock: true,
    lanes: new Map([['vocals', { player, duration: 100, pitch: 0 }]]),
  };
  engine.decks = new Map([['A', deck]]);
  engine.getAudioContext = () => ({ rawContext: { currentTime: 10 } });
  engine.performanceStartedAt = 10;
  engine.performanceJournal = { append: vi.fn() };
  engine.installPerformanceCapture();
  return { engine, deck, player };
}
it('journals one atomic seek with the actual future audio time', () => {
  const { engine, player } = engineFixture();
  engine.seekDeck('A', 40);
  expect(player.stop).toHaveBeenCalledWith(12.035);
  expect(player.start).toHaveBeenCalledWith(12.035, 40);
  expect(engine.performanceEvents.map((e) => e.type)).toEqual(['seekDeck', 'deckTransport']);
  const confirmed = engine.performanceEvents[1];
  expect(confirmed.time).toBeCloseTo(2.035, 10);
  expect(confirmed.args[1]).toEqual({ action: 'seek', position: 40, playing: true, rate: 1 });
});
it('pause confirmation uses the scheduled stop time instead of the earlier callback clock', () => {
  const { engine, player } = engineFixture();
  engine.pauseDeck('A');
  expect(player.stop).toHaveBeenCalledWith(12);
  expect(engine.performanceEvents[1]).toMatchObject({
    time: 2,
    args: ['A', { action: 'pause', position: 4, playing: false }],
  });
});
it('rate changes preserve source continuity and identify the operation explicitly', () => {
  const { engine, player } = engineFixture();
  engine.setPlaybackRate('A', 1.25);
  expect(player.stop).not.toHaveBeenCalled();
  expect(player.start).not.toHaveBeenCalled();
  expect(engine.performanceEvents[1]).toMatchObject({
    time: 2,
    args: ['A', { action: 'rate', position: 4, playing: true, rate: 1.25 }],
  });
});
it('captures the same scheduled time passed to live parameter ramps', () => {
  const { engine } = engineFixture();
  engine.master = { gain: { rampTo: vi.fn() } };
  engine.setMasterLevel(75);
  expect(engine.master.gain.rampTo).toHaveBeenCalledWith(expect.any(Number), 0.04, 12);
  expect(engine.performanceEvents[0]).toMatchObject({
    type: 'setMasterLevel',
    scheduledTime: 2,
    scheduledFrame: 96000,
  });
  expect(engine.performanceParameterTime).toBeUndefined();
});
it('does not journal a rejected parameter mutation', () => {
  const { engine } = engineFixture();
  engine.master = {
    gain: {
      rampTo: () => {
        throw new Error('invalid parameter');
      },
    },
  };
  expect(() => engine.setMasterLevel(75)).toThrow('invalid parameter');
  expect(engine.performanceEvents).toHaveLength(0);
  expect(engine.performanceParameterTime).toBeUndefined();
});
