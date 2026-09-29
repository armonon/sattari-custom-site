import { describe, expect, it, vi } from 'vitest';
import { createRenderLowCut } from './renderLowCut';

describe('fixed export low-cut', () => {
  it.each([44100, 48000, 96000])('uses stable high-pass coefficients at %i Hz', (sampleRate) => {
    for (const cutoff of [20, 80, 200]) {
      const node = { disconnect: vi.fn() };
      const context = { sampleRate, createIIRFilter: vi.fn(() => node) };
      expect(createRenderLowCut(context, cutoff)).toBe(node);
      const [feedforward, feedback] = context.createIIRFilter.mock.calls[0];
      expect(feedforward.every(Number.isFinite)).toBe(true);
      expect(feedback.every(Number.isFinite)).toBe(true);
      expect(feedforward.reduce((sum, value) => sum + value, 0)).toBe(0);
      expect(feedforward[0]).toBe(feedforward[2]);
      expect(feedback[0]).toBe(1);
      // A conjugate pole pair stays inside the unit circle.
      expect(Math.sqrt(feedback[2] / feedback[0])).toBeLessThan(1);
      const nyquistGain =
        (feedforward[0] - feedforward[1] + feedforward[2]) /
        (feedback[0] - feedback[1] + feedback[2]);
      expect(nyquistGain).toBeCloseTo(1, 12);
    }
  });

  it.each([NaN, Infinity, -20, 0, 24000, 48000])('rejects invalid cutoff %s', (frequency) => {
    const context = { sampleRate: 48000, createIIRFilter: vi.fn() };
    expect(() => createRenderLowCut(context, frequency)).toThrow(RangeError);
    expect(context.createIIRFilter).not.toHaveBeenCalled();
  });
});
