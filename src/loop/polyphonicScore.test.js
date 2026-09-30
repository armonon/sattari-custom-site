import { expect, it } from 'vitest';
import { polyphonicScoreMeasures } from './score';
const n = (midi, start, end) => ({ midi, start, end });
it('does not resurrect an earlier same-pitch sustain after a new attack ends', () => {
  const events = polyphonicScoreMeasures([n(48, 0, 3), n(48, 1, 2), n(55, 0, 4)], 60)[0].events;
  expect(events.find((e) => e.beat === 1).pitches.find((p) => p.midi === 48).tieFromPrevious).toBe(
    false
  );
  expect(events.find((e) => e.beat === 2).pitches.map((p) => p.midi)).toEqual([55]);
});
it('preserves independent releases and ties sustained notes when another pitch enters', () => {
  const bars = polyphonicScoreMeasures([n(48, 0, 3), n(52, 1, 2), n(55, 1, 3)], 60);
  const events = bars[0].events;
  expect(events.map((e) => e.pitches.map((p) => p.midi))).toEqual([[48], [48, 52, 55], [48, 55]]);
  expect(events.map((e) => e.pitches.map((p) => p.tieFromPrevious))).toEqual([
    [false],
    [true, false, false],
    [true, true],
  ]);
  expect(events.map((e) => e.beats)).toEqual([1, 1, 1]);
});
it('splits barlines, emits rests and does not tie repeated attacks', () => {
  const bars = polyphonicScoreMeasures([n(48, 0, 5), n(55, 3, 4), n(48, 5, 6), n(52, 7, 8)], 60);
  expect(bars.map((b) => b.number)).toEqual([1, 2]);
  const next = bars[1].events;
  expect(next[0].pitches[0].tieFromPrevious).toBe(true);
  expect(next[1].pitches[0].tieFromPrevious).toBe(false);
  expect(next[2].rest).toBe(true);
  expect(next[3].pitches[0].tieFromPrevious).toBe(false);
});
it('writes sharp and natural cancellations at the correct pitch in a chord', () => {
  const bars = polyphonicScoreMeasures([n(54, 0, 1), n(60, 0, 1), n(53, 1, 2), n(54, 4, 5)], 60);
  expect(bars[0].events[0].pitches.map((p) => [p.key, p.accidental])).toEqual([
    ['f#/4', '#'],
    ['c/5', null],
  ]);
  expect(bars[0].events[1].pitches[0].accidental).toBe('n');
  expect(bars[1].events[0].pitches[0].accidental).toBe('#');
});
it('starts late phrases at their actual bar with leading rests and a minimum sixteenth', () => {
  const bars = polyphonicScoreMeasures([n(64, 9, 9.01)], 60);
  expect(bars[0].number).toBe(3);
  expect(bars[0].events[0]).toMatchObject({ rest: true, beat: 8, beats: 1 });
  expect(bars[0].events[1]).toMatchObject({ rest: false, beat: 9, beats: 0.25 });
});
