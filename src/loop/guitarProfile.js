import { chordShape, NOTE_NAMES, TUNING } from './music';

export const TUNINGS = {
  standard: { name: 'Standard', notes: TUNING },
  dropD: { name: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
  dadgad: { name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
};
export const DEFAULT_PROFILE = { handedness: 'right', tuning: 'standard', capo: 0 };
export function validProfile(value = {}) {
  return {
    handedness: value?.handedness === 'left' ? 'left' : 'right',
    tuning: TUNINGS[value?.tuning] ? value.tuning : 'standard',
    capo: Number.isInteger(value?.capo) ? Math.min(7, Math.max(0, value.capo)) : 0,
  };
}
export function openStrings(profile = DEFAULT_PROFILE) {
  const p = validProfile(profile);
  return TUNINGS[p.tuning].notes.map((midi) => midi + p.capo);
}
export function profileLabel(profile = DEFAULT_PROFILE) {
  const p = validProfile(profile);
  return `${TUNINGS[p.tuning].name} tuning${p.capo ? ` · capo ${p.capo}` : ''}`;
}
export function positionForProfile(note, profile = DEFAULT_PROFILE, previous = null) {
  const playable = { ...note };
  delete playable.unplayable;
  const tuning = openStrings(profile);
  if (
    Number.isInteger(note.string) &&
    Number.isInteger(note.fret) &&
    note.fret >= 0 &&
    note.fret <= 20 &&
    tuning[note.string] + note.fret === note.midi
  )
    return playable;
  const options = tuning.flatMap((midi, string) => {
    const fret = note.midi - midi;
    return fret >= 0 && fret <= 20 ? [{ string, fret }] : [];
  });
  const cost = (p) =>
    p.fret * 0.3 +
    (previous ? Math.abs(p.fret - previous.fret) * 0.6 + Math.abs(p.string - previous.string) : 0);
  options.sort((a, b) => cost(a) - cost(b));
  return options.length ? { ...playable, ...options[0] } : null;
}

export function profileChordMidis(name, profile) {
  const shape = profileChord(name, profile);
  const tuning = openStrings(profile);
  return shape?.frets.flatMap((fret, string) => (fret < 0 ? [] : [tuning[string] + fret])) || [];
}
export function profileNotes(notes, profile) {
  let previous = null;
  return notes.map((note) => {
    const next = positionForProfile(note, profile, previous);
    if (next) previous = next;
    return next || { ...note, string: -1, fret: -1, unplayable: true };
  });
}
export function profileChord(name, profile = DEFAULT_PROFILE) {
  const p = validProfile(profile);
  const original = chordShape(name);
  if (!original) return null;
  const root = name.match(/^([A-G]#?)(.*)$/);
  const shapeName = NOTE_NAMES[(NOTE_NAMES.indexOf(root[1]) - p.capo + 12) % 12] + root[2];
  const shape = chordShape(shapeName);
  if (p.tuning === 'standard') return { ...shape, name, fullName: original.fullName, shapeName };
  const frets = shape.frets.map((f, s) =>
    f < 0 ? -1 : TUNING[s] + f - TUNINGS[p.tuning].notes[s]
  );
  const held = frets.filter((f) => f > 0);
  if (
    frets.some((f) => f > 20 || f < -1) ||
    (held.length && Math.max(...held) - Math.min(...held) > 4)
  )
    return null;
  const start = held.length ? Math.min(...held) : 1;
  return {
    name,
    fullName: original.fullName,
    shapeName,
    frets,
    startFret: start,
    fingers: frets.map((f) => (f <= 0 ? 0 : Math.min(4, f - start + 1))),
    suggested: true,
  };
}
