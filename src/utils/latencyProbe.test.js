import { expect, it } from 'vitest';
import { measureLoopback, probeSignal } from './latencyProbe';
it('measures captured sample delay independently of driver estimates', () => {
  const signal = probeSignal(128),
    starts = [200, 1200, 2200],
    capture = new Float32Array(4000);
  for (const start of starts)
    capture.set(
      signal.map((v) => -v * 0.5),
      start + 137
    );
  const result = measureLoopback(capture, signal, starts, 8000, 0.08);
  expect(result.medianMs).toBe(17.125);
  expect(result.trials.every((r) => r.correlation > 0.99)).toBe(true);
});
it('refuses silence rather than inventing a round-trip measurement', () => {
  expect(() =>
    measureLoopback(new Float32Array(2000), probeSignal(128), [200], 8000, 0.08)
  ).toThrow('No reliable loopback');
});
