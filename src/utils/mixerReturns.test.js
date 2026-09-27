import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETURNS,
  MAX_RETURN_DELAY,
  normalizeReturnBus,
  normalizeReturns,
  percentGain,
  returnDelaySeconds,
  returnTail,
  returnToneFrequencies,
  reverbImpulse,
  sendGain,
} from './mixerReturns';

describe('return settings', () => {
  it('fills defaults and merges partial edits over the current values', () => {
    expect(normalizeReturns()).toEqual(DEFAULT_RETURNS);
    const edited = normalizeReturnBus('a', { size: 80 }, { ...DEFAULT_RETURNS.a, decay: 5 });
    expect(edited).toEqual({ ...DEFAULT_RETURNS.a, size: 80, decay: 5 });
  });

  it('clamps ranges and ignores damaged values instead of storing them', () => {
    const reverb = normalizeReturnBus('a', {
      size: 500,
      decay: -3,
      preDelay: '40',
      tone: NaN,
      level: null,
      muted: 'yes',
    });
    expect(reverb).toEqual({ ...DEFAULT_RETURNS.a, size: 100, decay: 0.3, preDelay: 40 });
    const delay = normalizeReturnBus('b', { division: '3/7', feedback: 99, pingPong: true });
    expect(delay).toEqual({ ...DEFAULT_RETURNS.b, feedback: 90, pingPong: true });
  });
});

describe('send and return levels', () => {
  it('uses the fader taper: silent at 0, unity at 100, never above', () => {
    expect(sendGain).toBe(percentGain);
    expect(percentGain(0)).toBe(0);
    expect(percentGain(100)).toBe(1);
    expect(percentGain(250)).toBe(1);
    expect(percentGain(NaN)).toBe(0);
    expect(percentGain(50)).toBeCloseTo(Math.pow(0.5, 1.35), 12);
  });

  it('maps tone 0-100 from dark through flat to thin', () => {
    expect(returnToneFrequencies(50)).toEqual({ lowpass: 20000, highpass: 20 });
    expect(returnToneFrequencies(0).lowpass).toBeCloseTo(1200, 6);
    expect(returnToneFrequencies(100).highpass).toBeCloseTo(800, 6);
  });
});

describe('tempo-synced delay', () => {
  it('follows the session tempo and stays inside the delay line', () => {
    expect(returnDelaySeconds('1/4', 120)).toBe(0.5);
    expect(returnDelaySeconds('1/8d', 100)).toBeCloseTo(0.45, 12);
    expect(returnDelaySeconds('1/4', 0)).toBe(0.5); // invalid tempo falls back to 120
    expect(returnDelaySeconds('1/2', 1)).toBe(MAX_RETURN_DELAY);
  });

  it('reports tails long enough for exports to keep every repeat', () => {
    const reverb = returnTail('a', { ...DEFAULT_RETURNS.a, preDelay: 20, decay: 2 });
    expect(reverb).toBeCloseTo(0.02 + 2 * 1.2 + 0.03, 12);
    const delay = returnTail('b', { ...DEFAULT_RETURNS.b, division: '1/4', feedback: 50 }, 120);
    // 0.5^n falls below -100 dB after 17 repeats.
    expect(delay).toBeCloseTo(0.5 * 18, 12);
    expect(returnTail('b', { ...DEFAULT_RETURNS.b, feedback: 0 }, 120)).toBeGreaterThan(0);
  });
});

describe('reverb impulse', () => {
  it('is deterministic, cached and equal-energy for every room', () => {
    const first = reverbImpulse(8000, 40, 1);
    expect(reverbImpulse(8000, 40, 1)).toBe(first);
    const energy = (impulse) => impulse.channels[0].reduce((sum, value) => sum + value * value, 0);
    expect(energy(first)).toBeCloseTo(0.35, 6);
    expect(energy(reverbImpulse(8000, 90, 3))).toBeCloseTo(0.35, 6);
    expect(first.length).toBe(Math.ceil(8000 * (1 * 1.2 + 0.03)));
    // Decorrelated channels (fixed per-channel seeds), not a mono copy.
    expect(first.channels[0]).not.toEqual(first.channels[1]);
  });

  it('produces identical PCM after the cache is cycled', () => {
    const before = Float32Array.from(reverbImpulse(8000, 10, 0.5).channels[1]);
    for (let size = 11; size < 20; size++) reverbImpulse(8000, size, 0.5);
    expect(reverbImpulse(8000, 10, 0.5).channels[1]).toEqual(before);
  });
});
