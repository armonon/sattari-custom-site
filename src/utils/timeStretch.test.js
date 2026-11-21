// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pitchRatio, resample, stretchFactor, stretchStems } from './timeStretch';

const RATE = 44100;
const sine = (freq, seconds, amp = 0.5) =>
  Float32Array.from(
    { length: Math.round(RATE * seconds) },
    (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / RATE)
  );
// Frequency from positive zero crossings over the middle of the signal.
function frequency(signal) {
  const from = Math.floor(signal.length * 0.2);
  const to = Math.floor(signal.length * 0.8);
  let first = -1;
  let last = -1;
  let crossings = 0;
  for (let i = from + 1; i < to; i++)
    if (signal[i - 1] < 0 && signal[i] >= 0) {
      if (first < 0) first = i;
      last = i;
      crossings++;
    }
  return ((crossings - 1) * RATE) / (last - first);
}

describe('time stretch', () => {
  it.each([0.5, 0.75, 1.25])('changes length by 1/speed %s without changing pitch', (speed) => {
    const input = sine(440, 2);
    const alpha = stretchFactor(speed, 0);
    const { a } = stretchStems({ a: [input, input] }, alpha);
    expect(a[0].length).toBe(Math.round(input.length / speed));
    expect(frequency(a[0])).toBeGreaterThan(440 * 0.98);
    expect(frequency(a[0])).toBeLessThan(440 * 1.02);
  });

  it('transposes by stretching then resampling: same length, new pitch', () => {
    const input = sine(440, 2);
    const semitones = 3;
    const { a } = stretchStems({ a: [input, input] }, stretchFactor(1, semitones));
    const shifted = resample(a[0], pitchRatio(semitones));
    expect(Math.abs(shifted.length - input.length)).toBeLessThanOrEqual(2);
    const expected = 440 * pitchRatio(semitones);
    expect(frequency(shifted)).toBeGreaterThan(expected * 0.98);
    expect(frequency(shifted)).toBeLessThan(expected * 1.02);
  });

  it('stretches stems coherently: the sum of stretched stems equals the stretched sum', () => {
    const a = sine(220, 1.5, 0.3);
    const b = sine(331, 1.5, 0.2);
    const sum = a.map((value, i) => value + b[i]);
    const parts = stretchStems({ a: [a, a], b: [b, b], sum: [sum, sum] }, 1.3);
    let maxError = 0;
    for (let i = 0; i < parts.sum[0].length; i++)
      maxError = Math.max(maxError, Math.abs(parts.a[0][i] + parts.b[0][i] - parts.sum[0][i]));
    expect(maxError).toBeLessThan(1e-5);
  });

  it('resample is identity at rate 1 and halves length an octave up', () => {
    const input = sine(100, 0.5);
    expect(Array.from(resample(input, 1))).toEqual(Array.from(input));
    expect(resample(input, 2).length).toBe(Math.round(input.length / 2));
  });
});
