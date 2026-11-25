// Twelve-tone equal temperament. Keep the written letter and octave alongside
// its sounding pitch: B♯3 and C4 are the same pitch but different spellings.
const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

export const MAJOR_TONICS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_TONICS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
export const SCALE_TONICS = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B',
];

export const musicalAccidentals = (name) => name.replaceAll('#', '♯').replaceAll('b', '♭');

export function parseTonic(name) {
  const match = /^([A-Ga-g])([#♯b♭]?)$/.exec(name);
  if (!match) return null;
  const letter = LETTERS.indexOf(match[1].toUpperCase());
  const accidental = match[2].replace('♯', '#').replace('♭', 'b');
  const semitones = NATURAL[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  return {
    name: LETTERS[letter] + accidental,
    letter,
    semitones,
    pitchClass: (semitones + 12) % 12,
  };
}

// "degree" counts letter steps up from the tonic (0 = unison, 7 = octave).
export function spellInterval(tonic, startingOctave, semitones, degree) {
  const position = tonic.letter + degree;
  const letter = position % 7;
  const octave = startingOctave + Math.floor(position / 7);
  const midi = (startingOctave + 1) * 12 + tonic.semitones + semitones;
  const alteration = midi - ((octave + 1) * 12 + NATURAL[letter]);
  const accidental = alteration < 0 ? 'b'.repeat(-alteration) : '#'.repeat(alteration);
  return { name: LETTERS[letter] + accidental, octave, midi };
}
