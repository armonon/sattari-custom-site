import { it, expect } from 'vitest';
import { canScheduleMix, mixAutomation } from './replayMix';
it('compiles ordered fader/crossfader and stem solo edits from independent future state', () => {
  const initial = {
    crossfader: 0,
    decks: [
      { id: 'A', gain: 100, fader: 100, lanes: { vocals: { level: 100 }, drums: { level: 100 } } },
    ],
  };
  const next = mixAutomation(initial);
  expect(next({ type: 'setDeckFader', args: ['A', 200] })).toEqual([
    { target: 'deck', deckId: 'A', value: 2 },
  ]);
  expect(next({ type: 'setCrossfader', args: [100] })[0].value).toBeCloseTo(0, 12);
  const stems = next({ type: 'setMasterStems', args: [{ vocals: { solo: true, level: 150 } }] });
  expect(stems[0].value).toBe(1.5);
  expect(stems[1].value).toBe(0);
  expect(stems[2]).toEqual({ target: 'unseparated', value: 0 });
  expect(
    next({ type: 'setLaneState', args: ['A', 'vocals', { muted: true }] }).every(
      (s) => s.value === 0
    )
  ).toBe(true);
  expect(initial.decks[0].lanes.vocals).toEqual({ level: 100 });
});
it('does not schedule gain automation across source or topology mutations', () => {
  expect(canScheduleMix([{ type: 'setLaneState', args: ['A', 'vocals', { level: 120 }] }])).toBe(
    true
  );
  expect(
    canScheduleMix([{ type: 'setLaneState', args: ['A', 'vocals', { assetId: 'new' }] }])
  ).toBe(false);
  expect(canScheduleMix([{ type: 'setMasterProcessing', args: [{}] }])).toBe(false);
  expect(canScheduleMix([{ type: 'removeLane', args: ['A', 'vocals'] }])).toBe(false);
});
