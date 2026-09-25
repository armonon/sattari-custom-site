import { expect, it } from 'vitest';
import { audioLatency, callbackDelay, telemetryLabel } from './sessionTelemetry';
it('reports only finite browser estimates without inventing missing latency', () => {
  expect(audioLatency({ baseLatency: 0.012, outputLatency: 0.025 })).toEqual({
    processingMs: 12,
    outputMs: 25,
  });
  expect(audioLatency({ baseLatency: NaN, outputLatency: -1 })).toEqual({
    processingMs: null,
    outputMs: null,
  });
  expect(audioLatency()).toEqual({ processingMs: null, outputMs: null });
  expect(audioLatency({ baseLatency: 0 }).processingMs).toBe(0);
});
it('measures excess callback delay and distinguishes a reset from zero delay', () => {
  expect(callbackDelay(1000, null)).toBeNull();
  expect(callbackDelay(1000, 500)).toBe(100);
  expect(callbackDelay(899, 500)).toBe(0);
  expect(telemetryLabel(null, null)).toContain('unavailable');
  expect(telemetryLabel({}, 3)).toContain('Not a CPU or round-trip measurement');
});
