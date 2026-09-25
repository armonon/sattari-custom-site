/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import {
  buildArrangementSchedule,
  crossfaderGains,
  masterAssistProfile,
  StudioAudioEngine,
  recordingMimeType,
} from './studioAudioEngine';

describe('master signal controls', () => {
  it('aligns a playing follower to the master grid and records the confirmed seek', async () => {
    const player = { stop: vi.fn(), start: vi.fn() };
    const follower = {
      playing: true,
      playbackRate: 1,
      lanes: new Map([['fullMix', { player, duration: 200 }]]),
    };
    const engine = {
      unlock: vi.fn(async () => {}),
      decks: new Map([
        ['A', { playing: true, playbackRate: 1.2 }],
        ['B', follower],
      ]),
      getDeckPosition: (id) => (id === 'A' ? 10.25 : 20.1),
      setPlaybackRate: vi.fn((_, rate) => {
        follower.playbackRate = rate;
      }),
      performanceStartedAt: 0,
      performanceEvents: [],
      performanceJournal: { append: vi.fn() },
      getAudioContext: () => ({ rawContext: { sampleRate: 48000 } }),
    };
    expect(
      await StudioAudioEngine.prototype.alignDeck.call(
        engine,
        'B',
        { bpm: 100, beatOffset: 0.1 },
        { id: 'A', bpm: 120, beatOffset: 0.25 },
        144
      )
    ).toBe(true);
    expect(engine.setPlaybackRate).toHaveBeenCalledWith('B', 1.44);
    expect(player.start.mock.calls[0][0]).toBe(player.stop.mock.calls[0][0]);
    const phase = (follower.offset - 0.1) / 0.6;
    expect(phase - Math.floor(phase)).toBeCloseTo(0.144, 4);
    expect(engine.performanceEvents[0].args[1]).toEqual({
      position: follower.offset,
      playing: true,
      rate: 1.44,
      action: 'align',
    });
    expect(engine.performanceJournal.append).toHaveBeenCalledWith(engine.performanceEvents[0]);
    expect(engine.performanceEvents[0]).toMatchObject({
      clockVersion: 1,
      sampleRate: 48000,
      sequence: 0,
    });
    expect(engine.performanceEvents[0].frame).toBe(
      Math.round(engine.performanceEvents[0].time * 48000)
    );
  });
  it('warns when the audio clock falls behind wall time during a recording', () => {
    const target = {
      performanceStartedAt: 0,
      recordingClock: 0,
      recordingWallClock: performance.now() - 10000,
      getAudioContext: () => ({ rawContext: { currentTime: 6, sampleRate: 48000 } }),
    };
    const health = StudioAudioEngine.prototype.getRecordingHealth.call(target);
    expect(health.error).toMatch(/Audio clock is .*behind wall time/);
    expect(health.duration).toBe(6);
    expect(health.clockLag).toBeGreaterThan(3.9);
  });
  it('applies global stem controls without overwriting per-deck mix settings', () => {
    const lane = (level) => ({ level, gain: { gain: { rampTo: vi.fn() } } });
    const vocals = lane(100),
      drums = lane(100),
      music = lane(200),
      full = lane(100);
    const engine = {
      decks: new Map([
        [
          'A',
          {
            lanes: new Map([
              ['vocals', vocals],
              ['drums', drums],
            ]),
          },
        ],
        [
          'B',
          {
            lanes: new Map([
              ['music', music],
              ['fullMix', full],
            ]),
          },
        ],
      ]),
      unseparated: { gain: { rampTo: vi.fn() } },
      applyLaneMix: StudioAudioEngine.prototype.applyLaneMix,
    };
    StudioAudioEngine.prototype.setMasterStems.call(engine, { vocals: { level: 200, solo: true } });
    expect(vocals.gain.gain.rampTo).toHaveBeenLastCalledWith(2, 0.025);
    expect(drums.gain.gain.rampTo).toHaveBeenLastCalledWith(0, 0.025);
    expect(full.gain.gain.rampTo).toHaveBeenLastCalledWith(0, 0.025);
    expect(engine.unseparated.gain.rampTo).toHaveBeenLastCalledWith(0, 0.025);
    expect(vocals.level).toBe(100);
    StudioAudioEngine.prototype.setMasterStems.call(engine, { other: { level: 150 } });
    expect(music.gain.gain.rampTo).toHaveBeenLastCalledWith(3, 0.025);
    expect(drums.gain.gain.rampTo).toHaveBeenLastCalledWith(1, 0.025);
  });
  it('preserves the current audio position when stopping without a reset', () => {
    const deck = {
      playing: true,
      offset: 2,
      lanes: new Map([['fullMix', { player: { stop: vi.fn() } }]]),
    };
    const engine = {
      decks: new Map([['A', deck]]),
      getDeckPosition: vi.fn(() => (deck.playing ? 17 : deck.offset)),
    };
    StudioAudioEngine.prototype.stopDeck.call(engine, 'A', false);
    expect(deck.offset).toBe(17);
    expect(deck.playing).toBe(false);
  });
  it('reports only decks that actually started during Play All', async () => {
    const engine = {
      unlock: vi.fn(async () => {}),
      decks: new Map([
        ['A', {}],
        ['B', {}],
      ]),
      playDeck: vi.fn(async (id) => id === 'B'),
    };
    expect(await StudioAudioEngine.prototype.playAll.call(engine)).toEqual(['B']);
    expect(engine.playDeck.mock.calls[0][2]).toBe(engine.playDeck.mock.calls[1][2]);
  });
  it('selects a supported recording codec, preferring AAC with Opus fallback', () => {
    expect(recordingMimeType(() => true)).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(recordingMimeType((mime) => mime.startsWith('audio/webm'))).toBe(
      'audio/webm;codecs=opus'
    );
    expect(recordingMimeType(() => false)).toBeUndefined();
  });
  const param = () => ({ rampTo: vi.fn() });
  it('applies monitor audition only to the speaker branches', () => {
    const engine = {
      monitor: { gain: param() },
      monitorMonoGain: { gain: param() },
      monitorStereoGain: { gain: param() },
      master: { gain: param() },
      output: { gain: param() },
    };
    StudioAudioEngine.prototype.setMasterMonitor.call(engine, {
      mono: true,
      dimmed: true,
      muted: true,
    });
    expect(engine.monitor.gain.rampTo).toHaveBeenCalledWith(0, 0.04);
    expect(engine.monitorMonoGain.gain.rampTo).toHaveBeenCalledWith(1, 0.04);
    expect(engine.monitorStereoGain.gain.rampTo).toHaveBeenCalledWith(0, 0.04);
    expect(engine.master.gain.rampTo).not.toHaveBeenCalled();
    expect(engine.output.gain.rampTo).not.toHaveBeenCalled();
  });
  it('neutral audition preserves the limiter target and smoothly resets tone', () => {
    const engine = {
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
    };
    StudioAudioEngine.prototype.setMasterProcessing.call(engine, {
      low: 6,
      width: 150,
      ceiling: -3,
      bypass: true,
      inputTrim: -6,
      limiterDrive: 3,
      lowFrequency: 400,
      highFrequency: 4000,
    });
    expect(engine.masterEq.low.rampTo).toHaveBeenCalledWith(0, 0.04);
    expect(engine.masterWidth.width.rampTo).toHaveBeenCalledWith(0.5, 0.04);
    expect(engine.limiter.threshold.rampTo).toHaveBeenCalledWith(-3, 0.04);
    expect(engine.masterInputTrim.gain.rampTo).toHaveBeenCalledWith(10 ** (-6 / 20), 0.04);
    expect(engine.masterLimiterDrive.gain.rampTo).toHaveBeenCalledWith(10 ** (3 / 20), 0.04);
    expect(engine.masterEq.lowFrequency.rampTo).toHaveBeenCalledWith(400, 0.04);
    expect(engine.masterEq.highFrequency.rampTo).toHaveBeenCalledWith(4000, 0.04);
  });
});

describe('crossfaderGains', () => {
  it('fully isolates each side at the endpoints', () => {
    expect(crossfaderGains(0, 'Smooth')).toEqual({ left: 1, right: 0 });
    expect(crossfaderGains(100, 'Linear').left).toBe(0);
    expect(crossfaderGains(100, 'Linear').right).toBe(1);
  });

  it('uses equal-power gain at the smooth midpoint', () => {
    const midpoint = crossfaderGains(50, 'Smooth');
    expect(midpoint.left).toBeCloseTo(Math.SQRT1_2, 5);
    expect(midpoint.right).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('keeps both decks louder through the sharp transition', () => {
    const smooth = crossfaderGains(50, 'Smooth');
    const sharp = crossfaderGains(50, 'Sharp');
    expect(sharp.left).toBeGreaterThan(smooth.left);
    expect(sharp.right).toBeGreaterThan(smooth.right);
  });
});

describe('masterAssistProfile', () => {
  it('keeps the bypass threshold inside the compressor decibel range', () => {
    const bypass = masterAssistProfile(false);
    expect(bypass.threshold).toBeLessThan(0);
    expect(bypass.ratio).toBe(1);
  });

  it('selects the requested mastering target', () => {
    expect(masterAssistProfile(true, 'Club -9')).toMatchObject({ threshold: -12, ratio: 3.4 });
  });
});

describe('buildArrangementSchedule', () => {
  it('honours clip placement and source trims', () => {
    const clips = [
      { deckId: 'A', enabled: true, start: 8, trimStart: 12, trimEnd: 32 },
      { deckId: 'B', enabled: false, start: 0, trimStart: 0, trimEnd: 20 },
    ];
    expect(buildArrangementSchedule(clips, 3)).toEqual([
      { deckId: 'A', delay: 5, sourceOffset: 12 },
    ]);
    expect(buildArrangementSchedule(clips, 13)).toEqual([
      { deckId: 'A', delay: 0, sourceOffset: 17 },
    ]);
    expect(buildArrangementSchedule(clips, 29)).toEqual([]);
  });
});
