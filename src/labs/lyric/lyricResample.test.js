import { describe, expect, it } from 'vitest';
import { resampleLinear } from './lyricResample';

describe('resampleLinear', () => {
  it('returns the input unchanged when rates already match', () => {
    const samples = new Float32Array([0, 0.5, 1]);
    expect(resampleLinear(samples, 16000, 16000)).toBe(samples);
  });

  it('halves the length when downsampling by 2x', () => {
    const samples = new Float32Array(32000);
    const out = resampleLinear(samples, 32000, 16000);
    expect(out.length).toBe(16000);
  });

  it('linearly interpolates a ramp signal', () => {
    // A ramp from 0 to 1 over 100 samples at 100 Hz, resampled to 50 Hz
    // should still read as a ramp from 0 to ~1 at half the sample count.
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++) samples[i] = i / 99;
    const out = resampleLinear(samples, 100, 50);
    expect(out.length).toBe(50);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[out.length - 1]).toBeCloseTo(samples[samples.length - 1], 1);
    // Monotonically non-decreasing, since the source ramp is monotonic.
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
  });

  it('returns empty/short input unchanged without throwing', () => {
    expect(resampleLinear(new Float32Array(0), 16000, 8000).length).toBe(0);
    expect(() => resampleLinear(new Float32Array([1]), 16000, 8000)).not.toThrow();
  });
});
