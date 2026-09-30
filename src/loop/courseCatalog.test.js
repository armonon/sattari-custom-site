// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FOUNDATION_LESSONS } from './courseCatalog';
import { TUNING, phrasesFor } from './music';
import { phraseConcerns, editDraftNote } from './draftReview';
import { practiceReport } from './practiceReport';
import { detectFundamental } from './pitch';

it.each(FOUNDATION_LESSONS)(
  '$title has playable targets, complete phrase coverage and matching real WAV length',
  (lesson) => {
    expect(new Set(FOUNDATION_LESSONS.map((s) => s.id)).size).toBe(12);
    expect(phrasesFor(lesson).flatMap((p) => p.notes).length).toBe(lesson.notes.length);
    for (const note of lesson.notes) {
      expect(TUNING[note.string] + note.fret).toBe(note.midi);
      expect(note.fret).toBeLessThanOrEqual(3);
      expect(note.end).toBeGreaterThan(note.start);
    }
    const file = readFileSync(new URL(`../../public${lesson.audioUrl}`, import.meta.url));
    expect(file.toString('ascii', 0, 4)).toBe('RIFF');
    expect((file.length - 44) / 2 / file.readUInt32LE(24)).toBeCloseTo(lesson.duration, 3);
    expect(lesson.teaching.tip.length).toBeGreaterThan(30);
    const rate = file.readUInt32LE(24);
    for (const note of lesson.notes) {
      const start = Math.round((note.start + 0.03) * rate);
      const samples = Float32Array.from(
        { length: 2048 },
        (_, i) => file.readInt16LE(44 + (start + i) * 2) / 32768
      );
      const detected = detectFundamental(samples, rate, 70, 1320, 0.001);
      expect(detected?.midi, `${lesson.title}: ${note.midi} at ${note.start}`).toBe(note.midi);
      expect(Math.abs(detected.cents)).toBeLessThan(35);
    }
  }
);
it('finishes with a complete 16-bar original and keeps silence in the rest exercise', () => {
  const song = FOUNDATION_LESSONS.at(-1);
  expect(song.completeSong).toBe(true);
  expect((song.duration * song.bpm) / 60).toBeCloseTo(64);
  expect(song.phraseStarts).toHaveLength(8);
  const rests = FOUNDATION_LESSONS[6];
  expect(rests.notes[1].beatStart - rests.notes[0].beatStart).toBe(2);
});
it('flags specific uncertain patterns without calling detector values accuracy', () => {
  expect(
    phraseConcerns({
      notes: [
        { midi: 40, start: 0, end: 0.08, confidence: 0.6 },
        { midi: 64, start: 3, end: 4 },
      ],
    })
  ).toHaveLength(4);
  expect(phraseConcerns({ notes: FOUNDATION_LESSONS[0].notes })).toEqual([]);
});
it('corrects or omits a melody note while preserving audio and shifting phrase boundaries', () => {
  const lesson = FOUNDATION_LESSONS.at(-1),
    before = structuredClone(lesson);
  const edited = editDraftNote(lesson, 0, 65);
  expect(edited.notes[0].midi).toBe(65);
  expect(TUNING[edited.notes[0].string] + edited.notes[0].fret).toBe(65);
  const removed = editDraftNote(lesson, 0, null);
  expect(removed.notes).toHaveLength(lesson.notes.length - 1);
  expect(removed.phraseStarts[0]).toBe(0);
  expect(removed.phraseStarts[1]).toBe(lesson.phraseStarts[1] - 1);
  expect(removed.audioUrl).toBe(lesson.audioUrl);
  expect(lesson).toEqual(before);
});
it('exports observations without audio or full note fingerprints', () => {
  const report = practiceReport({
    history: [
      {
        lessonId: 'private-song',
        at: 1,
        kind: 'rhythm',
        phrase: 0,
        fingerprint: 'private note data',
        result: { reliable: false, total: 8, onTime: 0, speed: 0.5 },
      },
    ],
    feedback: [],
    device: 'test',
  });
  expect(report.attempts[0].confirmed).toBe(false);
  expect(JSON.stringify(report)).not.toContain('private note data');
});
