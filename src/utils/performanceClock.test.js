import { expect, it, vi } from 'vitest';
import { parameterRamp, performanceAudioTime, retimePerformanceEvent } from './performanceClock';

it('uses the recorded audio timestamp irrespective of the current replay lookahead', () => {
  const event = { time: 1, scheduledTime: 1.123456, sampleRate: 48000 };
  expect(performanceAudioTime(event, 48000, 0.5)).toBe(53926 / 48000);
  expect(performanceAudioTime(event, 48000, 0.001)).toBe(performanceAudioTime(event, 48000, 0.5));
  const next = retimePerformanceEvent(event, 3);
  expect(next.scheduledTime).toBeCloseTo(3.123456, 8);
  expect(next.frame).toBe(144000);
  expect(next.scheduledFrame).toBe(149926);
});
it('retains legacy timing and confirmed transport compatibility', () => {
  expect(performanceAudioTime({ type: 'setMasterLevel', time: 1 }, 48000, 0.1)).toBe(1.1);
  expect(performanceAudioTime({ type: 'deckTransport', time: 1 }, 48000, 0.1)).toBe(1);
  expect(performanceAudioTime({ type: 'inputState', time: 1 }, 48000, 0.1)).toBe(1);
});
it('writes the exact shared timestamp to actual parameter ramps', () => {
  const param = { rampTo: vi.fn() };
  parameterRamp({ performanceParameterTime: 123.25 }, param, 0.5, 0.025);
  expect(param.rampTo).toHaveBeenCalledWith(0.5, 0.025, 123.25);
});
