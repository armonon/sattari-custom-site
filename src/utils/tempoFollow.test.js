import { it, expect, vi } from 'vitest';
import { StudioAudioEngine } from './studioAudioEngine';
it('follows local tempo only while playing and removes its timer when disabled', () => {
  vi.useFakeTimers();
  const deck = { playing: false, playbackRate: 1 };
  const engine = {
    decks: new Map([['A', deck]]),
    getDeckPosition: () => 1,
    setPlaybackRate: vi.fn((_id, rate) => {
      deck.playbackRate = rate;
    }),
  };
  try {
    const beats = Array.from({ length: 20 }, (_, i) => ({ time: i * 0.6 }));
    StudioAudioEngine.prototype.setTempoFollow.call(engine, 'A', beats, 120);
    vi.advanceTimersByTime(200);
    expect(engine.setPlaybackRate).not.toHaveBeenCalled();
    deck.playing = true;
    vi.advanceTimersByTime(100);
    expect(engine.setPlaybackRate.mock.calls[0][0]).toBe('A');
    expect(engine.setPlaybackRate.mock.calls[0][1]).toBeCloseTo(1.2, 10);
    vi.advanceTimersByTime(1000);
    expect(engine.setPlaybackRate).toHaveBeenCalledTimes(1);
    StudioAudioEngine.prototype.setTempoFollow.call(engine, 'A', null, 120);
    expect(engine.tempoTimer).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    clearInterval(engine.tempoTimer);
    vi.useRealTimers();
  }
});
