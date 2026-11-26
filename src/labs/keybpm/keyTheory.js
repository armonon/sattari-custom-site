// Music-theory helpers for the Key & BPM readout: names, the circle of fifths,
// and the pitches used by the by-ear checks (drone and scale).
import { keyParts } from './keyBpm';

// Conventional spellings: the key signature with the fewest accidentals
// (B♭ major, not A♯ major). The analyzer's own strings use sharps throughout
// and stay unchanged in storage, reports and CSV; these are display names.
const MAJOR_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12];

/** { tonic: 'F♯', mode: 'minor' } for display, or null. */
export function keyDisplay(key) {
  const parts = keyParts(key);
  if (!parts) return null;
  return parts.minor
    ? { tonic: MINOR_NAMES[parts.root], mode: 'minor' }
    : { tonic: MAJOR_NAMES[parts.root], mode: 'major' };
}

/** 'A# major' → 'B♭ major' for display; unknown strings pass through. */
export function keyLabel(key) {
  const shown = keyDisplay(key);
  return shown ? `${shown.tonic} ${shown.mode}` : key || '';
}

const NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** The relative major or minor, in the analyzer's spelling ('C major' ↔ 'A minor'). */
export function relativeKey(key) {
  const parts = keyParts(key);
  if (!parts) return '';
  return parts.minor
    ? `${NAME[(parts.root + 3) % 12]} major`
    : `${NAME[(parts.root + 9) % 12]} minor`;
}

/** Position on the circle of fifths: index 0 = C major / A minor at the top, clockwise. */
export function circlePosition(key) {
  const parts = keyParts(key);
  if (!parts) return null;
  const majorRoot = parts.minor ? (parts.root + 3) % 12 : parts.root;
  return { index: (majorRoot * 7) % 12, ring: parts.minor ? 'minor' : 'major' };
}

/** The 12 slots of the circle with their major and minor labels. */
export const CIRCLE = Array.from({ length: 12 }, (_, index) => {
  const majorRoot = (index * 7) % 12;
  return {
    index,
    major: MAJOR_NAMES[majorRoot],
    minor: `${MINOR_NAMES[(majorRoot + 9) % 12]}m`,
  };
});

const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Tonic pitch in Hz (octave 3 by default: A3 = 220 Hz). */
export function tonicFrequency(key, octave = 3) {
  const parts = keyParts(key);
  return parts ? frequency(12 * (octave + 1) + parts.root) : null;
}

/** One octave of the major or natural minor scale from the tonic, in Hz. */
export function scaleFrequencies(key, octave = 3) {
  const parts = keyParts(key);
  if (!parts) return [];
  const base = 12 * (octave + 1) + parts.root;
  return (parts.minor ? MINOR_STEPS : MAJOR_STEPS).map((step) => frequency(base + step));
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ACCIDENTAL = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

/** The seven scale notes, spelled one letter per degree (F major has B♭, not A♯). */
export function scaleNotes(key) {
  const shown = keyDisplay(key);
  const parts = keyParts(key);
  if (!shown || !parts) return [];
  const first = LETTERS.indexOf(shown.tonic[0]);
  return (parts.minor ? MINOR_STEPS : MAJOR_STEPS).slice(0, 7).map((step, degree) => {
    const letter = (first + degree) % 7;
    const offset = ((parts.root + step - NATURAL[letter] + 18) % 12) - 6;
    return `${LETTERS[letter]}${ACCIDENTAL[offset] ?? ''}`;
  });
}

const MAJOR_CHORDS = [
  ['I', ''],
  ['ii', 'm'],
  ['iii', 'm'],
  ['IV', ''],
  ['V', ''],
  ['vi', 'm'],
  ['vii°', 'dim'],
];
const MINOR_CHORDS = [
  ['i', 'm'],
  ['ii°', 'dim'],
  ['III', ''],
  ['iv', 'm'],
  ['v', 'm'],
  ['VI', ''],
  ['VII', ''],
];

/** The triads built on each scale degree: [{ numeral: 'ii', name: 'Dm' }, …]. */
export function diatonicChords(key) {
  const notes = scaleNotes(key);
  const parts = keyParts(key);
  if (!parts || !notes.length) return [];
  return (parts.minor ? MINOR_CHORDS : MAJOR_CHORDS).map(([numeral, quality], degree) => ({
    numeral,
    name: `${notes[degree]}${quality}`,
  }));
}

const ANALYZER_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Keys that mix cleanly with this one on the Camelot wheel: the relative key
 * and one step either way (a fifth down / up). In the analyzer's spelling.
 */
export function compatibleKeys(key) {
  const parts = keyParts(key);
  if (!parts) return [];
  const mode = parts.minor ? 'minor' : 'major';
  return [
    { key: relativeKey(key), relation: 'relative' },
    { key: `${ANALYZER_NAMES[(parts.root + 5) % 12]} ${mode}`, relation: 'fifth down' },
    { key: `${ANALYZER_NAMES[(parts.root + 7) % 12]} ${mode}`, relation: 'fifth up' },
  ];
}
