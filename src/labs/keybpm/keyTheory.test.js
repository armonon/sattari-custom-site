// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CIRCLE,
  circlePosition,
  keyDisplay,
  compatibleKeys,
  conventionalKeyLabel,
  diatonicChords,
  keyLabel,
  relativeKey,
  scaleFrequencies,
  scaleNotes,
  tonicFrequency,
} from './keyTheory';
import { camelot } from './keyBpm';

describe('key theory', () => {
  it('names keys and their relatives', () => {
    expect(keyDisplay('F# minor')).toEqual({ tonic: 'F♯', mode: 'minor' });
    expect(keyDisplay('nonsense')).toBeNull();
    expect(relativeKey('A minor')).toBe('C major');
    expect(relativeKey('C major')).toBe('A minor');
    expect(relativeKey('Eb major')).toBe('C minor');
    expect(relativeKey('D# major')).toBe('B# minor');
    expect(relativeKey('Bb minor')).toBe('Db major');
    expect(relativeKey('Cb major')).toBe('Ab minor');
    expect(keyDisplay('B♭ major')).toEqual({ tonic: 'B♭', mode: 'major' });
  });

  it('places relative keys in the same slot and fifths one slot apart', () => {
    expect(circlePosition('C major')).toEqual({ index: 0, ring: 'major' });
    expect(circlePosition('A minor')).toEqual({ index: 0, ring: 'minor' });
    expect(circlePosition('G major').index).toBe(1);
    expect(circlePosition('F major').index).toBe(11);
    expect(CIRCLE[10]).toMatchObject({ major: 'B♭', minor: 'Gm' });
    expect(CIRCLE[1]).toMatchObject({ major: 'G', minor: 'Em' });
    // The circle order matches the Camelot wheel: one slot = one Camelot step.
    for (const slot of CIRCLE) {
      const code = camelot(`${slot.major.replace('♯', '#')} major`);
      expect(parseInt(code, 10)).toBe(((slot.index + 7) % 12) + 1);
    }
  });

  it('gives the tonic and scale pitches', () => {
    expect(tonicFrequency('A minor')).toBeCloseTo(220, 6);
    expect(tonicFrequency('B# major', 3)).toBeCloseTo(tonicFrequency('C major', 4), 6);
    expect(tonicFrequency('Cb major', 4)).toBeCloseTo(tonicFrequency('B major', 3), 6);
    expect(tonicFrequency('C major', 4)).toBeCloseTo(261.626, 2);
    const minor = scaleFrequencies('A minor');
    expect(minor).toHaveLength(8);
    expect(minor[2]).toBeCloseTo(220 * 2 ** (3 / 12), 6);
    expect(minor[7]).toBeCloseTo(440, 6);
    expect(scaleFrequencies('C major')[2]).toBeCloseTo(130.813 * 2 ** (4 / 12), 2);
  });

  it('spells keys the conventional way without changing the analyzer strings', () => {
    expect(conventionalKeyLabel('A# major')).toBe('B♭ major');
    expect(conventionalKeyLabel('D# major')).toBe('E♭ major');
    expect(conventionalKeyLabel('G# minor')).toBe('G♯ minor');
    expect(conventionalKeyLabel('A# minor')).toBe('B♭ minor');
    expect(keyLabel('')).toBe('');
    expect(keyLabel('A# major')).toBe('A♯ major');
    expect(CIRCLE.map((slot) => slot.major).join(' ')).toBe('C G D A E B F♯ D♭ A♭ E♭ B♭ F');
  });

  it('spells scales one letter per degree and builds the diatonic triads', () => {
    expect(scaleNotes('F major')).toEqual(['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
    expect(scaleNotes('F# major')).toEqual(['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
    expect(scaleNotes('D# minor')).toEqual(['E♭', 'F', 'G♭', 'A♭', 'B♭', 'C♭', 'D♭']);
    expect(scaleNotes('nonsense')).toEqual([]);
    for (const tonic of ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])
      for (const mode of ['major', 'minor']) {
        const notes = scaleNotes(`${tonic} ${mode}`);
        expect(new Set(notes.map((note) => note[0])).size).toBe(7);
        expect(notes.join('')).not.toMatch(/𝄫|𝄪/u);
      }
    expect(diatonicChords('C major').map((chord) => chord.name)).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'Bdim',
    ]);
    expect(diatonicChords('A minor').map((chord) => `${chord.numeral} ${chord.name}`)).toEqual([
      'i Am',
      'ii° Bdim',
      'III C',
      'iv Dm',
      'v Em',
      'VI F',
      'VII G',
    ]);
  });

  it('lists the Camelot neighbours', () => {
    const mixes = compatibleKeys('C major');
    expect(mixes.map((mix) => mix.key)).toEqual(['A minor', 'F major', 'G major']);
    expect(mixes.map((mix) => camelot(mix.key))).toEqual(['8A', '7B', '9B']);
    expect(compatibleKeys('A minor').map((mix) => camelot(mix.key))).toEqual(['8B', '7A', '9A']);
    expect(compatibleKeys('x')).toEqual([]);
  });
});
