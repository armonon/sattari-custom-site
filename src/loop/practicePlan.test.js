import { beforeEach, expect, it } from 'vitest';
import { DEMO, phrasesFor } from './music';
import {
  buildPracticePlan,
  adaptiveSuggestion,
  dailySession,
  logPractice,
  readHistory,
} from './practicePlan';
import { lessonFingerprint, saveCheckpoint, readCheckpoint } from './progress';
import { openStrings, profileNotes, profileChord, validProfile } from './guitarProfile';
import { downloadPracticeGuide } from './exportGuide';
import { voiceGuitar } from './harmony';

beforeEach(() => localStorage.clear());

it('isolates a phrase without shifting source times or awarding full-song progress', () => {
  const original = structuredClone(DEMO);
  const plan = buildPracticePlan(DEMO, { first: 1, last: 1, level: 'essentials' });
  const source = phrasesFor(DEMO)[1];
  expect(plan.notes.length).toBeLessThan(source.notes.length);
  expect(plan.notes.map((n) => [n.midi, n.start, n.end])).toEqual(
    source.notes
      .filter((_, i) => i % 2 === 0 || i === source.notes.length - 1)
      .map((n) => [n.midi, n.start, n.end])
  );
  expect(phrasesFor(plan)[0].start).toBe(source.start);
  expect(plan.duration).toBe(source.end);
  expect(plan.chords.every((c) => c.start >= source.start && c.end <= source.end)).toBe(true);
  expect(plan.rootFingerprint).toBe(lessonFingerprint(DEMO));
  saveCheckpoint(plan, { stage: 'complete', phraseIndex: 0, position: 0, matched: [] });
  expect(readCheckpoint(DEMO)).toBeNull();
  expect(DEMO).toEqual(original);
});

it('uses a short transition, rebuilds after a clean attempt, and abstains on unclear input', () => {
  const phrase = phrasesFor(DEMO)[0];
  const miss = { onTime: 6, total: 8, extras: 0, review: [phrase.notes[4].index] };
  const drill = adaptiveSuggestion(phrase, miss, 0.75);
  expect(drill.notes).toEqual(phrase.notes.slice(3, 6));
  expect(drill.speed).toBe(0.5);
  expect(adaptiveSuggestion(phrase, { ...miss, reliable: false })).toBeNull();
  expect(adaptiveSuggestion(phrase, { onTime: 8, total: 8, extras: 0 }, 0.75)).toMatchObject({
    kind: 'build',
    speed: 1,
    notes: phrase.notes,
  });
});

it('builds a daily session from matching lesson history, ignoring stale and unreliable attempts', () => {
  const records = [{ lesson: DEMO }];
  logPractice(DEMO, { kind: 'rhythm', phrase: 2, result: { onTime: 3, total: 8, reliable: true } });
  logPractice(DEMO, {
    kind: 'rhythm',
    phrase: 3,
    result: { onTime: 0, total: 8, reliable: false },
  });
  const plan = dailySession(records);
  expect(plan.basedOnHistory).toBe(true);
  expect(plan.steps.map((s) => s.first)).toEqual([2, 2, 0]);
  expect(dailySession([{ lesson: { ...DEMO, bpm: 90 } }], readHistory()).basedOnHistory).toBe(
    false
  );
});

it('preserves sounding pitches for every supported setup and flags unreachable notes', () => {
  for (const tuning of ['standard', 'dropD', 'dadgad']) {
    for (const capo of [0, 2, 7]) {
      const profile = { tuning, capo, handedness: 'left' };
      const notes = profileNotes(DEMO.notes, profile);
      for (const note of notes) {
        if (!note.unplayable) expect(openStrings(profile)[note.string] + note.fret).toBe(note.midi);
      }
      for (const name of ['C', 'Em', 'D7', 'Asus2']) {
        const chord = profileChord(name, profile);
        if (!chord) continue;
        const expected = profileChord(name).frets.flatMap((f, i) =>
          f < 0 ? [] : [(openStrings()[i] + f) % 12]
        );
        expect(
          [
            ...new Set(
              chord.frets.flatMap((f, i) => (f < 0 ? [] : [(openStrings(profile)[i] + f) % 12]))
            ),
          ].sort()
        ).toEqual([...new Set(expected)].sort());
      }
    }
  }
  expect(profileNotes([{ midi: 40 }], { capo: 2 })[0].unplayable).toBe(true);
  expect(validProfile({ capo: 999, tuning: 'unknown' })).toMatchObject({
    capo: 7,
    tuning: 'standard',
  });
});

it('exports the saved setup and assigns simultaneous notes to distinct strings', () => {
  const profile = { tuning: 'dropD', capo: 2 };
  const text = downloadPracticeGuide(DEMO, profile);
  expect(text).toContain('Drop D tuning · capo 2');
  expect(text).not.toContain('Standard tuning');
  const notes = [{ midi: 40 }, { midi: 47 }, { midi: 54 }];
  const shape = voiceGuitar(notes, openStrings(profile));
  expect(new Set(shape.map((n) => n.string)).size).toBe(notes.length);
  shape.forEach((n) => expect(openStrings(profile)[n.string] + n.fret).toBe(n.midi));
});
