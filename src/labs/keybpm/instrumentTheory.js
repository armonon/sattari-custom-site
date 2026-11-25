export const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const INSTRUMENTS = {
  guitar: { name: 'Guitar · standard', notes: [40, 45, 50, 55, 59, 64] },
  'drop-d': { name: 'Guitar · drop D', notes: [38, 45, 50, 55, 59, 64] },
  bass: { name: 'Bass · four strings', notes: [28, 33, 38, 43] },
  'bass-five': { name: 'Bass · five strings', notes: [23, 28, 33, 38, 43] },
  violin: { name: 'Violin', notes: [55, 62, 69, 76] },
  viola: { name: 'Viola', notes: [48, 55, 62, 69] },
  cello: { name: 'Cello', notes: [36, 43, 50, 57] },
  ukulele: { name: 'Ukulele · high G', notes: [67, 60, 64, 69] },
  chromatic: { name: 'Chromatic · any single note', notes: [] },
};
export const SCALES = {
  major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11, 12] },
  minor: { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10, 12] },
  'major-pentatonic': { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9, 12] },
  'minor-pentatonic': { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10, 12] },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10, 12] },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10, 12] },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10, 12] },
};
export const noteLabel = (midi) =>
  `${PITCH_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
export const noteFrequency = (midi, reference = 440) => reference * 2 ** ((midi - 69) / 12);
export const centsFrom = (frequency, midi, reference = 440) =>
  1200 * Math.log2(frequency / noteFrequency(midi, reference));
export const scaleNotes = (root, scale, octave = 3) =>
  (SCALES[scale] || SCALES.major).steps.map((step) => 12 * (octave + 1) + Number(root) + step);
