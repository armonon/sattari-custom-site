import { describe, expect, it } from 'vitest';
import {
  chordFromNotes,
  CHORD_TYPES,
  voiceGuitar,
  groupAttacks,
  chordsFromPolyphonic,
  coveredDuration,
} from './harmony';
import { CHORD_NAMES, chordShape, TUNING, NOTE_NAMES } from './music';
import { decodePolyphonic, transcribePolyphonic } from './polyphonic';

describe('playable, named guitar shapes', () => {
  it.each(CHORD_NAMES)(
    '%s contains exactly the named chord tones within the drawn frets',
    (name) => {
      const shape = chordShape(name);
      const [, root, suffix] = name.match(/^([A-G]#?)(.*)$/);
      const expected = CHORD_TYPES.find((t) => t.suffix === suffix)
        .intervals.map((n) => (n + NOTE_NAMES.indexOf(root)) % 12)
        .sort();
      const actual = [
        ...new Set(shape.frets.flatMap((f, s) => (f < 0 ? [] : [(TUNING[s] + f) % 12]))),
      ].sort();
      expect(actual).toEqual(expected);
      expect(
        shape.frets.every((f) => f <= 0 || (f >= shape.startFret && f < shape.startFret + 4))
      ).toBe(true);
    }
  );
  it('assigns concurrent pitches to distinct strings and rejects impossible shapes', () => {
    const result = voiceGuitar([40, 47, 52, 55, 59, 64].map((midi) => ({ midi })));
    expect(result.map((n) => n.fret)).toEqual([0, 2, 2, 0, 0, 0]);
    expect(new Set(result.map((n) => n.string)).size).toBe(6);
    expect(voiceGuitar([40, 41].map((midi) => ({ midi })))).toBeNull();
    expect(voiceGuitar([40, 45, 50, 55, 59, 64, 67].map((midi) => ({ midi })))).toBeNull();
  });
});

it('names extensions and inversions, abstains on incomplete or unexplained harmony', () => {
  const chord = (midis) => chordFromNotes(midis.map((midi) => ({ midi })));
  expect(chord([48, 52, 55, 59]).name).toBe('Cmaj7');
  expect(chord([52, 55, 60])).toMatchObject({ name: 'C', bassName: 'E', inversion: true });
  expect(chord([45, 52])).toMatchObject({ name: 'A5' });
  expect(chord([48, 52])).toBeNull();
  expect(chord([48, 49, 52, 55])).toBeNull();
  expect(chord([48])).toBeNull();
});

it('finds chord changes on beats, and does not merge across silence', () => {
  const events = (midis, start, end) =>
    midis.map((midi) => ({ midi, start, end, confidence: 0.8 }));
  const notes = [
    ...events([48, 52, 55], 0, 1),
    ...events([50, 53, 57], 1, 1.5),
    ...events([50, 53, 57], 2, 2.5),
  ];
  expect(
    chordsFromPolyphonic(notes, 2.5, 120).map(({ name, start, end }) => [name, start, end])
  ).toEqual([
    ['C', 0, 1],
    ['Dm', 1, 1.5],
    ['Dm', 2, 2.5],
  ]);
  expect(coveredDuration(notes)).toBe(2);
});

it('groups strums against the first attack without chaining separate notes', () => {
  const groups = groupAttacks(
    [0, 0.07, 0.14].map((start) => ({ start, end: start + 1, midi: 60 }))
  );
  expect(groups.map((g) => g.notes.length)).toEqual([2, 1]);
});

it('preserves simultaneous pitches and repeated attacks while rejecting unpitched activation', () => {
  const frames = Array.from({ length: 80 }, () => new Float32Array(88));
  const onsets = frames.map(() => new Float32Array(88));
  for (const midi of [48, 52, 55]) for (let f = 5; f < 60; f++) frames[f][midi - 21] = 0.8;
  for (const midi of [48, 52, 55]) for (const f of [5, 30]) onsets[f][midi - 21] = 0.9;
  frames.forEach((f) => {
    f[60 - 21] = 0.2;
  });
  const result = decodePolyphonic(
    frames,
    onsets,
    frames.map((_, i) => (i * 256) / 22050),
    1
  );
  expect(result.map((n) => n.midi)).toEqual([48, 52, 55, 48, 52, 55]);
  expect(result[0].end).toBeLessThanOrEqual(result[3].start);
});

it('keeps window timestamps monotonic, disposes outputs, and joins a held note across windows', async () => {
  const disposed = [];
  const session = {
    run: async () => {
      const data = new Float32Array(172 * 88);
      for (let i = 0; i < 172; i++) data[i * 88 + 39] = 0.8;
      const onset = new Float32Array(172 * 88);
      onset[20 * 88 + 39] = 0.9;
      return {
        'StatefulPartitionedCall:1': { data, dims: [1, 172, 88], dispose: () => disposed.push(1) },
        'StatefulPartitionedCall:2': {
          data: onset,
          dims: [1, 172, 88],
          dispose: () => disposed.push(2),
        },
      };
    },
  };
  const runtime = {
    Tensor: class {
      dispose() {
        disposed.push(0);
      }
    },
  };
  const notes = await transcribePolyphonic(new Float32Array(22050 * 4), 22050, runtime, session);
  expect(notes.length).toBe(3);
  expect(
    notes.every((n, i) => n.start < n.end && n.end <= 4 && (!i || n.start >= notes[i - 1].end))
  ).toBe(true);
  expect(disposed.length).toBe(9);
});
