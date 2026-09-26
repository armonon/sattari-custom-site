import { deferred } from '../test/deferred';
/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';

const loading = vi.hoisted(() => ({ fail: false, wait: null }));

vi.mock('tone', () => {
  class AudioNode {
    constructor() {
      this.buffer = {
        duration: 8,
        load: vi.fn(async () => {
          if (loading.wait) await loading.wait;
          if (loading.fail) throw new Error('Invalid audio');
        }),
      };
      this.dispose = vi.fn();
      this.stop = vi.fn();
    }
    connect() {
      return this;
    }
    async load() {
      if (loading.fail) throw new Error('Invalid audio');
      return this;
    }
  }
  return {
    Gain: AudioNode,
    FeedbackDelay: AudioNode,
    Filter: AudioNode,
    GrainPlayer: AudioNode,
    Player: AudioNode,
  };
});

import { StudioAudioEngine } from './studioAudioEngine';

describe('restoring audio before playback permission', () => {
  it('does not resurrect a lane removed while its first load is pending', async () => {
    const ready = deferred();
    loading.wait = ready.promise;
    const deck = { lanes: new Map(), input: {}, playbackRate: 1, pitch: 0 };
    const engine = {
      decks: new Map([['A', deck]]),
      ensureDeck: () => deck,
      stopDeck: vi.fn(),
      applyPlaybackRates: vi.fn(),
      applyLaneMix: vi.fn(),
      applyLoop: vi.fn(),
    };
    try {
      const pending = StudioAudioEngine.prototype.loadLane.call(
        engine,
        'A',
        'left',
        'fullMix',
        'blob:test'
      );
      StudioAudioEngine.prototype.removeLane.call(engine, 'A', 'fullMix');
      ready.resolve();
      await expect(pending).rejects.toThrow('superseded');
      expect(deck.lanes.size).toBe(0);
      expect(engine.pendingLaneLoads.size).toBe(0);
      expect(engine.stopDeck).not.toHaveBeenCalled();
    } finally {
      loading.wait = null;
    }
  });
  it('loads a deck lane without requesting an audio-context resume', async () => {
    const deck = { lanes: new Map(), input: {}, playbackRate: 1, pitch: 0 };
    const engine = {
      unlock: vi.fn(() => {
        throw new Error('No user gesture');
      }),
      ensureDeck: vi.fn(() => deck),
      stopDeck: vi.fn(),
      applyPlaybackRates: vi.fn(),
      applyLaneMix: vi.fn(),
      applyLoop: vi.fn(),
    };
    expect(
      await StudioAudioEngine.prototype.loadLane.call(engine, 'A', 'left', 'fullMix', 'blob:test')
    ).toBe(8);
    expect(deck.lanes.get('fullMix').duration).toBe(8);
    expect(engine.unlock).not.toHaveBeenCalled();
  });

  it('loads a pad without requesting an audio-context resume', async () => {
    const engine = {
      master: {},
      padPlayers: new Map(),
      unlock: vi.fn(() => {
        throw new Error('No user gesture');
      }),
    };
    await StudioAudioEngine.prototype.loadPad.call(engine, 0, 'blob:test', 100);
    expect(engine.padPlayers.get(0).level).toBe(100);
    expect(engine.unlock).not.toHaveBeenCalled();
  });

  it('still requires playback permission when starting a deck', async () => {
    const engine = {
      unlock: vi.fn(async () => {
        throw new Error('Playback blocked');
      }),
    };
    await expect(StudioAudioEngine.prototype.playDeck.call(engine, 'A')).rejects.toThrow(
      'Playback blocked'
    );
    expect(engine.unlock).toHaveBeenCalledOnce();
  });

  it('preserves a playable lane and pad when replacement decoding fails', async () => {
    const oldPlayer = { stop: vi.fn(), dispose: vi.fn() };
    const oldLane = { player: oldPlayer };
    const deck = { lanes: new Map([['fullMix', oldLane]]), input: {} };
    const engine = {
      ensureDeck: () => deck,
      master: {},
      padPlayers: new Map([[0, oldLane]]),
      stopDeck: vi.fn(),
    };
    loading.fail = true;
    try {
      await expect(
        StudioAudioEngine.prototype.loadLane.call(engine, 'A', 'left', 'fullMix', 'blob:bad')
      ).rejects.toThrow('Invalid audio');
      await expect(StudioAudioEngine.prototype.loadPad.call(engine, 0, 'blob:bad')).rejects.toThrow(
        'Invalid audio'
      );
      expect(deck.lanes.get('fullMix')).toBe(oldLane);
      expect(engine.padPlayers.get(0)).toBe(oldLane);
      expect(oldPlayer.dispose).not.toHaveBeenCalled();
      expect(engine.stopDeck).not.toHaveBeenCalled();
    } finally {
      loading.fail = false;
    }
  });
});
