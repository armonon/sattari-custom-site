import { positionForMidi } from './music';

export function phraseConcerns(phrase) {
  const reasons = [];
  if (phrase.notes.some((n) => Number.isFinite(n.confidence) && n.confidence < 0.75))
    reasons.push('Some notes have a weak detector signal.');
  if (phrase.notes.some((n) => n.end - n.start < 0.12))
    reasons.push('Very short notes may be extra attacks or missed detail.');
  if (phrase.notes.some((n, i, a) => i > 0 && Math.abs(n.midi - a[i - 1].midi) > 12))
    reasons.push('A large pitch jump could be an octave error.');
  if (phrase.notes.some((n, i, a) => i > 0 && n.start - a[i - 1].end > 2))
    reasons.push('A longer gap may be a rest or missing notes.');
  if (!phrase.notes.length) reasons.push('No melody notes were found here.');
  return reasons;
}
export function editDraftNote(lesson, index, midi) {
  if (!Number.isInteger(index) || !lesson.notes[index]) return lesson;
  let notes = lesson.notes.map((n) => ({ ...n }));
  if (midi === null) notes.splice(index, 1);
  else {
    if (!Number.isInteger(midi) || midi < 40 || midi > 84) return lesson;
    notes[index] = { ...notes[index], midi, ...positionForMidi(midi), edited: true };
  }
  const next = { ...lesson, notes };
  if (midi === null && lesson.phraseStarts) {
    next.phraseStarts = [
      ...new Set(
        lesson.phraseStarts.map((n) => (n > index ? n - 1 : n)).filter((n) => n < notes.length)
      ),
    ];
    if (!notes.length) delete next.phraseStarts;
  }
  return next;
}
