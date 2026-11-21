import { it, expect } from 'vitest';
import { alignedBeatPosition } from './beatGrid';
it('aligns phase across different source tempos and corrected first beats', () => {
  const result = alignedBeatPosition(20.13, 100, 0.2, 13.25, 120, 0.1);
  const phase = (seconds, bpm, offset) => (((((seconds - offset) * bpm) / 60) % 1) + 1) % 1;
  expect(phase(result, 100, 0.2)).toBeCloseTo(phase(13.25, 120, 0.1), 10);
  expect(Math.abs(result - 20.13)).toBeLessThanOrEqual(0.3);
});
it('keeps the first seek nonnegative and rejects damaged grids', () => {
  expect(alignedBeatPosition(0, 120, 0.3, 0, 120)).toBeGreaterThanOrEqual(0);
  expect(() => alignedBeatPosition(1, 0, 0, 1, 120)).toThrow(/valid BPM/);
});
