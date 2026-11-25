// Music-theory helpers for the Key & BPM readout: names, the circle of fifths,
// and the pitches used by the by-ear checks (drone and scale).
import { keyParts } from './keyBpm';

import {
  MAJOR_TONICS,
  musicalAccidentals,
  parseTonic,
  spellInterval,
} from '../../utils/noteSpelling';
import { spelledScale, noteFrequency } from './instrumentTheory';

/** Keep the tonic spelling chosen by the musician or supplied by the recording. */
export function keyDisplay(key) {
  const parts = keyParts(key);
  return parts
    ? { tonic: musicalAccidentals(parts.tonic), mode: parts.minor ? 'minor' : 'major' }
    : null;
}

export function relativeKey(key) {
  const parts = keyParts(key);
  if (!parts) return '';
  const relative = parts.minor
    ? spellInterval(parseTonic(parts.tonic), 3, 3, 2)
    : spellInterval(parseTonic(parts.tonic), 3, 9, 5);
  return `${relative.name} ${parts.minor ? 'major' : 'minor'}`;
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
    major: musicalAccidentals(MAJOR_TONICS[majorRoot]),
    minor: musicalAccidentals(relativeKey(`${MAJOR_TONICS[majorRoot]} major`).split(' ')[0]) + 'm',
  };
});

/** Tonic pitch in Hz (octave 3 by default: A3 = 220 Hz). */
export function tonicFrequency(key, octave = 3) {
  const parts = keyParts(key);
  return parts ? noteFrequency(12 * (octave + 1) + parseTonic(parts.tonic).semitones) : null;
}

/** One octave of the major or natural minor scale from the tonic, in Hz. */
export function scaleFrequencies(key, octave = 3) {
  const parts = keyParts(key);
  if (!parts) return [];
  return spelledScale(parts.tonic, parts.minor ? 'minor' : 'major', octave).map((note) =>
    noteFrequency(note.midi)
  );
}
