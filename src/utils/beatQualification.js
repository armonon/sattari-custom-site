// Strict, one-to-one beat matching. Half/double-time or shifted grids do not get
// automatic credit. Confidence alone is not evidence of correct musical timing.
export function qualifyBeatMap(detected, reference, tolerance = 0.07) {
  const times = (value) => value.map((beat) => (typeof beat === 'number' ? beat : beat.time));
  const actual = times(detected),
    expected = times(reference);
  for (const list of [actual, expected])
    if (
      list.some((value, i) => !Number.isFinite(value) || value < 0 || (i && value <= list[i - 1]))
    )
      throw new Error('Beat annotations must be finite, nonnegative and strictly increasing.');
  if (!(tolerance > 0 && tolerance <= 0.2))
    throw new Error('Use a beat tolerance between 0 and 200 ms.');
  let i = 0,
    j = 0;
  const errors = [];
  while (i < actual.length && j < expected.length) {
    const delta = actual[i] - expected[j];
    if (delta < -tolerance) i++;
    else if (delta > tolerance) j++;
    else {
      errors.push(Math.abs(delta));
      i++;
      j++;
    }
  }
  const precision = actual.length ? errors.length / actual.length : 0;
  const recall = expected.length ? errors.length / expected.length : 0;
  return {
    detected: actual.length,
    expected: expected.length,
    matched: errors.length,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    meanErrorMs: errors.length ? (errors.reduce((a, b) => a + b, 0) * 1000) / errors.length : null,
    maxErrorMs: errors.length ? Math.max(...errors) * 1000 : null,
    toleranceMs: tolerance * 1000,
  };
}
