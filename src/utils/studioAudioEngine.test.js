/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import {
  buildArrangementSchedule,
  crossfaderGains,
  masterAssistProfile,
  StudioAudioEngine,
} from './studioAudioEngine';

describe('master signal controls', () => {
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
      masterEq: { low: param(), mid: param(), high: param() },
      masterLowCut: { frequency: param() },
      masterWidth: { width: param() },
      limiter: { threshold: param() },
    };
    StudioAudioEngine.prototype.setMasterProcessing.call(engine, {
      low: 6,
      width: 150,
      ceiling: -3,
      bypass: true,
    });
    expect(engine.masterEq.low.rampTo).toHaveBeenCalledWith(0, 0.04);
    expect(engine.masterWidth.width.rampTo).toHaveBeenCalledWith(0.5, 0.04);
    expect(engine.limiter.threshold.rampTo).toHaveBeenCalledWith(-3, 0.04);
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
