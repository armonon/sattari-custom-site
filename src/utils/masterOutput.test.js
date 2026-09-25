import { describe, expect, it } from 'vitest';
import { newEffect } from './arrangementEffects';
import {
  DEFAULT_MASTER_PROCESSING,
  normalizeMasterProcessing,
  masterGain,
  monitorGain,
  measureMasterChannels,
  normalizeMasterStems,
  masterStemGain,
  masterComparisonSnapshot,
  masterDeliveryReadings,
  trimGain,
} from './masterOutput';

describe('master processing compatibility', () => {
  it('persists master inserts and refuses malformed executable or unbounded devices', () => {
    const effects = [newEffect('echo'), newEffect('eq')];
    expect(normalizeMasterProcessing(JSON.parse(JSON.stringify({ effects }))).effects).toEqual(
      effects
    );
    expect(() =>
      normalizeMasterProcessing({ effects: [{ type: 'file:///native.vst3' }] })
    ).toThrow();
    expect(() => normalizeMasterProcessing({ effects: Array(9).fill(effects[0]) })).toThrow();
  });
  it('saves stem levels and treats old sessions as unity with safe bounds', () => {
    expect(masterStemGain(undefined, 'vocals')).toBe(1);
    const stems = normalizeMasterStems({
      vocals: { level: 900, solo: true },
      drums: { level: NaN },
    });
    expect(stems.vocals.level).toBe(300);
    expect(stems.drums.level).toBe(100);
    expect(masterStemGain(stems, 'vocals')).toBe(3);
    expect(masterStemGain(stems, 'drums')).toBe(0);
    expect(masterStemGain(stems, 'fullMix')).toBe(0);
    stems.vocals.muted = true;
    expect(masterStemGain(stems, 'vocals')).toBe(0);
    expect(normalizeMasterProcessing(JSON.parse(JSON.stringify({ stems }))).stems).toEqual(stems);
    expect(masterStemGain({ other: { level: 150 } }, 'music')).toBe(1.5);
  });
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
    ).toEqual({
      ...DEFAULT_MASTER_PROCESSING,
      low: 12,
      mid: -12,
      high: 3,
      lowCut: 200,
      width: 0,
      ceiling: -0.1,
      bypass: false,
    });
  });
  it('preserves the settings through a project JSON roundtrip', () => {
    const settings = {
      ...DEFAULT_MASTER_PROCESSING,
      inputTrim: -5,
      limiterDrive: 3,
      lowFrequency: 400,
      highFrequency: 5000,
      targetLufs: -16,
      targetPeak: -2,
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

describe('professional master controls', () => {
  it('bounds gain and crossover imports with nonoverlapping EQ bands', () => {
    expect(
      normalizeMasterProcessing({
        inputTrim: -100,
        limiterDrive: 100,
        lowFrequency: 99999,
        highFrequency: -20,
        targetLufs: 0,
        targetPeak: 2,
      })
    ).toMatchObject({
      inputTrim: -18,
      limiterDrive: 6,
      lowFrequency: 800,
      highFrequency: 1000,
      targetLufs: -8,
      targetPeak: -0.1,
    });
    expect(trimGain(0)).toBe(1);
    expect(trimGain(-6)).toBeCloseTo(0.501187);
    expect(trimGain(6)).toBeCloseTo(1.995262);
  });
  it('compares measurements only when available, without inventing a reading for silence', () => {
    expect(masterDeliveryReadings({ available: false, integrated: 0 }, {})).toEqual({
      loudnessDelta: null,
      peakMargin: null,
    });
    expect(
      masterDeliveryReadings({ available: true, integrated: -Infinity, truePeak: NaN }, {})
    ).toEqual({ loudnessDelta: null, peakMargin: null });
    expect(
      masterDeliveryReadings({ available: true, integrated: -16, truePeak: -0.5 }, {})
    ).toEqual({ loudnessDelta: 2, peakMargin: -0.5 });
  });
  it('A/B excludes routing, effects and delivery references', () => {
    const snapshot = masterComparisonSnapshot(
      {
        inputTrim: -4,
        targetLufs: -18,
        stems: { vocals: { muted: true } },
        effects: [newEffect('echo')],
      },
      80,
      false,
      true
    );
    expect(snapshot).toMatchObject({
      processing: { inputTrim: -4 },
      level: 80,
      limiter: false,
      compression: true,
    });
    for (const key of ['stems', 'effects', 'targetLufs', 'targetPeak'])
      expect(snapshot.processing).not.toHaveProperty(key);
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
