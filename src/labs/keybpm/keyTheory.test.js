// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CIRCLE,
  circlePosition,
  keyDisplay,
  relativeKey,
  scaleFrequencies,
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
});
