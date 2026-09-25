import { expect, it } from 'vitest';
import {
  duplicateNotes,
  moveNotes,
  quantizeNotes,
  notesInBox,
  snapPitch,
  ghostNotes,
} from './arrangementNotes';
const notes = [
  { pitch: 'C4', time: 0, duration: 1, velocity: 0.7 },
  { pitch: 'E4', time: 0.5, duration: 1, velocity: 0.7 },
];
it('preserves spacing and intervals when a group hits time and pitch boundaries', () => {
  expect(moveNotes(notes, [0, 1], -2, -100, 2)).toEqual([
    { ...notes[0], pitch: 'C0' },
    { ...notes[1], pitch: 'E0' },
  ]);
  expect(moveNotes(notes, [0, 1], 20, 0, 2).map((note) => note.time)).toEqual([0.5, 1]);
  expect(notes[0].pitch).toBe('C4');
});
it('duplicates an entire phrase or refuses when the full phrase cannot fit', () => {
  expect(duplicateNotes(notes, [0, 1], 4, 0.25).notes.map((note) => note.time)).toEqual([
    0, 0.5, 1.5, 2,
  ]);
  expect(duplicateNotes(notes, [0, 1], 2, 0.25).notes).toBe(notes);
});
it('quantizes only selected notes with strength and swing without crossing the clip end', () => {
  const data = [{ ...notes[0], time: 0.3 }, notes[1]];
  expect(quantizeNotes(data, [0], 0.25, 2, 0.5, 0.5)[0].time).toBeCloseTo(0.3375);
  expect(quantizeNotes(data, [0], 0.25, 2)[1]).toBe(notes[1]);
});

it('marquee selects overlapping long notes but excludes other pitches', () => {
  expect(notesInBox(notes, 0.8, 1.2, 48, 48)).toEqual([0]);
  expect(notesInBox(notes, 0.8, 1.2, 48, 52)).toEqual([0, 1]);
});
it('snaps notes to the nearest scale pitch and uses directional keyboard movement', () => {
  expect(snapPitch('C#4', '0')).toBe('C4');
  expect(snapPitch('C#4', '0', 'major', 1)).toBe('D4');
  expect(snapPitch('B8', '0', 'minor')).toBe('A#8');
  expect(snapPitch('C#4', 'off')).toBe('C#4');
});
it('ghost notes align absolute times and clip their boundaries without modifying sources', () => {
  const selected = { id: 'selected', kind: 'midi', start: 4, duration: 2, notes: [] };
  const other = {
    id: 'other',
    kind: 'midi',
    start: 3,
    duration: 5,
    notes: [
      { ...notes[0], duration: 2 },
      { ...notes[1], time: 4 },
    ],
  };
  const ghosts = ghostNotes({ tracks: [{ clips: [selected, other] }] }, selected);
  expect(ghosts).toHaveLength(1);
  expect(ghosts[0]).toMatchObject({ time: 0, duration: 1 });
  expect(other.notes[0].duration).toBe(2);
});
