// Music-theory helpers for the Key & BPM readout: names, the circle of fifths,
// and the pitches used by the by-ear checks (drone and scale).
import { keyParts } from './keyBpm';

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12];

/** { tonic: 'F♯', mode: 'minor' } for display, or null. */
export function keyDisplay(key) {
  const parts = keyParts(key);
  return parts ? { tonic: SHARP_NAMES[parts.root], mode: parts.minor ? 'minor' : 'major' } : null;
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
    major: SHARP_NAMES[majorRoot],
    minor: `${SHARP_NAMES[(majorRoot + 9) % 12]}m`,
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
