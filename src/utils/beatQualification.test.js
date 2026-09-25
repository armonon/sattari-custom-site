import { it, expect } from 'vitest';
import { qualifyBeatMap } from './beatQualification';
it('does not hide doubled beats, missing beats or shifted grids behind tempo accuracy', () => {
  const reference = [0, 0.5, 1, 1.5];
  expect(qualifyBeatMap([0.02, 0.52, 1.02, 1.52], reference).f1).toBe(1);
  expect(qualifyBeatMap([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5], reference).precision).toBeCloseTo(
    4 / 7
  );
  expect(qualifyBeatMap([0, 1], reference).recall).toBe(0.5);
  expect(qualifyBeatMap([0.25, 0.75, 1.25, 1.75], reference).f1).toBe(0);
  expect(() => qualifyBeatMap([1, 0], reference)).toThrow('strictly increasing');
});
