import { expect, it } from 'vitest';
import { performanceControlFields, setPerformanceControl } from './performanceControls';

it('edits nested effects and input controls without mutating the original event or target', () => {
  const event = {
    type: 'setLaneFx',
    args: [
      'A',
      'vocals',
      { send: 30, enabled: false, effects: [{ id: 'eq-1', params: { frequency: 500 } }] },
    ],
  };
  const fields = performanceControlFields(event);
  expect(fields.map((f) => f.name)).toContain('Effect · Effects · 0 · Params · Frequency');
  const result = setPerformanceControl(event, [2, 'effects', '0', 'params', 'frequency'], 900);
  expect(result[0]).toBe('A');
  expect(result[2].effects[0].params.frequency).toBe(900);
  expect(event.args[2].effects[0].params.frequency).toBe(500);
  expect(() => setPerformanceControl(event, [2, 'send'], Infinity)).toThrow();
  expect(() => setPerformanceControl(event, [0], 'B')).toThrow();
  expect(performanceControlFields({ type: 'initialState', args: [{}] })).toEqual([]);
});
