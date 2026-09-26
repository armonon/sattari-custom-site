import { expect, it } from 'vitest';
import { pitchAutomation } from './replayPitch';
import { replayScheduling } from './performancePlayer';

const initial = {
  decks: [
    {
      id: 'A',
      playbackRate: 1,
      pitch: 2,
      keyLock: true,
      lanes: { vocals: { pitch: -1 }, drums: { pitch: 0 } },
    },
  ],
};
it('compiles ordered rate, key-lock and stem pitch without reading or mutating live state', () => {
  const next = pitchAutomation(initial);
  const opening = next({ type: 'deckTransport', args: ['A', { rate: 2 }] });
  expect(opening.detunes).toEqual({ vocals: 100, drums: 200 });
  const unlocked = next({ type: 'setDeckKeyLock', args: ['A', false] });
  expect(unlocked.detunes).toEqual({ vocals: 1300, drums: 1400 });
  const stem = next({ type: 'setStemPitch', args: ['A', 'vocals', -3] });
  expect(stem.detunes.vocals).toBe(1100);
  expect(next({ type: 'setDeckPitch', args: ['A', 5] }).detunes.drums).toBe(1700);
  expect(opening.stems.vocals).toBe(-1);
  expect(opening.keyLock).toBe(true);
  expect(initial.decks[0].lanes.vocals.pitch).toBe(-1);
});

it('uses live pitch limits and defaults and ignores absent stems', () => {
  const next = pitchAutomation(initial);
  expect(next({ type: 'setDeckPitch', args: ['A', 99] }).pitch).toBe(12);
  expect(next({ type: 'setStemPitch', args: ['A', 'missing', 12] }).stems).not.toHaveProperty(
    'missing'
  );
  expect(next({ type: 'deckTransport', args: ['A', { rate: 0 }] }).rate).toBe(0.5);
  expect(next({ type: 'setDeckPitch', args: ['missing', 2] })).toBeNull();
});

it('queues fixed-source musical mutations together but falls back for a source replacement', () => {
  const events = [
    { type: 'deckTransport', time: 1, args: ['A', { rate: 1, playing: true, position: 0 }] },
    { type: 'setDeckPitch', time: 2, args: ['A', 3] },
    { type: 'setDeckKeyLock', time: 3, args: ['A', false] },
    { type: 'setStemPitch', time: 4, args: ['A', 'vocals', -2] },
    {
      type: 'deckTransport',
      time: 5,
      args: ['A', { rate: 2, playing: true, position: 4, action: 'rate' }],
    },
  ];
  const options = { scheduledPitchDecks: new Set(['A']), scheduledLoopDecks: new Set(['A']) };
  const plan = replayScheduling({ initial, events }, options);
  expect(plan.dispatched).toEqual([]);
  expect(plan.scheduled).toHaveLength(5);
  expect(plan.scheduled.at(-1).grainState.detunes.vocals).toBe(1300);
  const unsafe = [
    ...events,
    { type: 'setLaneState', time: 2.5, args: ['A', 'vocals', { assetId: 'replacement' }] },
  ];
  expect(replayScheduling({ initial, events: unsafe }, options).scheduled).toEqual([]);
  expect(replayScheduling({ initial, events }, {}).dispatched).toHaveLength(5);
});
