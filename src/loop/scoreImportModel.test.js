// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { importer, exporter, Settings } from '@coderline/alphatab';
import { scoreTracks, alignScore } from './scoreImportModel';

const xml = readFileSync(new URL('./fixtures/learning.musicxml', import.meta.url));
const load = (bytes = xml) => importer.ScoreLoader.loadScoreFromBytes(bytes, new Settings());

it('imports real MusicXML, extends ties, and keeps simultaneous chord tones', () => {
  const [track] = scoreTracks(load());
  expect(track.bpm).toBe(120);
  expect(track.notes.map((n) => n.midi)).toEqual([64, 67, 69, 67]);
  expect(track.notes[2]).toMatchObject({ start: 1, end: 2.5 });
  expect(track.polyphonicNotes).toHaveLength(6);
  expect(track.chords).toContainEqual(expect.objectContaining({ name: 'C', start: 2.5, end: 3 }));
  expect(track.notes[0]).toMatchObject({ string: 5, fret: 0 });
});

it('reads an actual Guitar Pro archive exported from the same score', () => {
  const bytes = new exporter.Gp7Exporter().export(load());
  expect(bytes[0]).toBe(80); // ZIP container
  const [track] = scoreTracks(load(bytes));
  expect(track.notes.map((n) => n.midi)).toEqual([64, 67, 69, 67]);
  expect(track.chords[0].name).toBe('C');
});

it('applies recording offset and tempo consistently to melody, chords, and polyphony', () => {
  const [track] = scoreTracks(load());
  const aligned = alignScore(track, 2, 60);
  expect(aligned.notes[2]).toMatchObject({ start: 4, end: 7 });
  expect(aligned.chords[0]).toMatchObject({ start: 7, end: 8 });
  expect(aligned.practiceStart).toBe(2);
  expect(aligned.duration).toBe(8);
  expect(aligned.polyphonicNotes.at(-1).end).toBe(8);
  expect(track.notes[0].start).toBe(0);
  expect(() => alignScore(track, -1)).toThrow('offset');
});

it('rejects unsupported meter and changing tempo instead of inventing a beat grid', () => {
  const meter = load();
  meter.masterBars[0].timeSignatureNumerator = 3;
  expect(() => scoreTracks(meter)).toThrow('4/4');
  const tempo = load();
  tempo.masterBars[1].tempoAutomations.push({ value: 90 });
  expect(() => scoreTracks(tempo)).toThrow('steady tempo');
});

it('retains written pitch when MusicXML fret hints omit the staff tuning', () => {
  const withoutTuning = new TextEncoder().encode(
    new TextDecoder().decode(xml).replace(/<staff-details>[\s\S]*?<\/staff-details>/, '')
  );
  expect(scoreTracks(load(withoutTuning))[0].notes[0].midi).toBe(64);
});
