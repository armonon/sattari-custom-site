import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MASTER_PROCESSING,
  normalizeMasterProcessing,
  masterGain,
  monitorGain,
  measureMasterChannels,
} from './masterOutput';

describe('master processing compatibility', () => {
  it('opens old projects and malformed settings with neutral defaults', () => {
    for (const value of [undefined, null, {}, 'bad']) {
      expect(normalizeMasterProcessing(value)).toEqual(DEFAULT_MASTER_PROCESSING);
    }
    expect(normalizeMasterProcessing({ low: Infinity, width: NaN })).toEqual(
      DEFAULT_MASTER_PROCESSING
    );
  });
  it('bounds imported processing values', () => {
    expect(
      normalizeMasterProcessing({
        low: 90,
        mid: -90,
        high: 3,
        lowCut: 900,
        width: -1,
        ceiling: 4,
        bypass: 'true',
      })
    ).toEqual({ low: 12, mid: -12, high: 3, lowCut: 200, width: 0, ceiling: -0.1, bypass: false });
  });
  it('preserves the settings through a project JSON roundtrip', () => {
    const settings = {
      low: 2,
      mid: -3,
      high: 1.5,
      lowCut: 42,
      width: 120,
      ceiling: -2,
      bypass: true,
    };
    expect(normalizeMasterProcessing(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });
  it('supports unity at 100 percent and gain above it without unbounded values', () => {
    expect(masterGain(100)).toBe(1);
    expect(masterGain(125)).toBeGreaterThan(1);
    expect(masterGain(900)).toBe(masterGain(125));
    expect(masterGain(-1)).toBe(0);
    expect(masterGain(NaN)).toBe(1);
  });
  it('mutes over dim and uses a genuine minus 12 dB monitor gain', () => {
    expect(monitorGain()).toBe(1);
    expect(monitorGain({ dimmed: true })).toBeCloseTo(0.2511886);
    expect(monitorGain({ dimmed: true, muted: true })).toBe(0);
  });
});

describe('measured master output', () => {
  it('shows silence without invented loudness or correlation', () => {
    expect(measureMasterChannels(new Float32Array(8))).toEqual({
      left: -96,
      right: -96,
      peak: -96,
      rms: -96,
      correlation: null,
      clipped: false,
    });
  });
  it('measures identical channels and opposite phase correctly', () => {
    const left = new Float32Array([0.5, -0.5]);
    expect(measureMasterChannels(left).peak).toBeCloseTo(-6.0206);
    expect(measureMasterChannels(left).rms).toBeCloseTo(-6.0206);
    expect(measureMasterChannels(left).correlation).toBe(1);
    expect(measureMasterChannels(left, new Float32Array([-0.5, 0.5])).correlation).toBe(-1);
  });
  it('detects sample clipping on either side, with stereo RMS', () => {
    const result = measureMasterChannels(new Float32Array([1, -1]), new Float32Array(2));
    expect(result.clipped).toBe(true);
    expect(result.peak).toBe(0);
    expect(result.rms).toBeCloseTo(-3.0103);
  });
  it('handles missing buffers and nonfinite samples', () => {
    expect(measureMasterChannels(undefined).rms).toBe(-96);
    expect(measureMasterChannels([NaN, Infinity]).peak).toBe(-96);
  });
});
