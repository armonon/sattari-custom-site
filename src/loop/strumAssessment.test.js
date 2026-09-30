import { describe, expect, it } from 'vitest';
import { assessStrum, captureQuality } from './strumAssessment';
const shape = [40, 47, 52, 55, 59, 64];
const quality = { rms: 0.1, noiseFloor: 0.002, clippedFraction: 0 };
const notes = (midis = shape, start = 0.2, end = 1) =>
  midis.map((midi) => ({ midi, start, end, confidence: 0.8 }));
describe('conservative whole-shape evidence', () => {
  it('requires all absolute pitches to ring together for at least 120 ms', () => {
    expect(assessStrum(notes(), shape, quality).status).toBe('matched');
    expect(assessStrum(notes(shape, 0.2, 0.3), shape, quality).status).toBe('not-confirmed');
    expect(
      assessStrum(
        notes().map((n, i) => ({ ...n, start: i, end: i + 0.5 })),
        shape,
        quality
      ).status
    ).toBe('not-confirmed');
  });
  it('abstains on a missing string, wrong octave, changed third and extra unrelated tone', () => {
    for (const pitches of [
      shape.slice(1),
      shape.map((m) => (m === 40 ? 76 : m)),
      shape.map((m) => (m === 55 ? 56 : m)),
      [...shape, 54],
    ]) {
      expect(assessStrum(notes(pitches), shape, quality).status).toBe('not-confirmed');
    }
    expect(assessStrum(notes(shape.slice(1)), shape, quality).missing).toEqual([40]);
  });
  it('ignores octave harmonics but does not use them to fill missing absolute pitches', () => {
    expect(assessStrum(notes([...shape, 76]), shape, quality).status).toBe('matched');
    expect(assessStrum(notes([47, 52, 55, 59, 64, 76]), shape, quality).status).toBe(
      'not-confirmed'
    );
  });
  it('does not accumulate isolated overlap intervals into a match', () => {
    const result = assessStrum(
      [...notes(shape, 0, 0.1), ...notes(shape, 0.2, 0.3)],
      shape,
      quality
    );
    expect(result.status).toBe('not-confirmed');
  });
  it('separates recording problems from musical feedback', () => {
    expect(assessStrum(notes(), shape, captureQuality(new Float32Array(22050), 22050)).status).toBe(
      'quiet'
    );
    expect(
      assessStrum(notes(), shape, captureQuality(new Float32Array(22050).fill(1), 22050)).status
    ).toBe('clipped');
    expect(assessStrum(notes(), shape, { ...quality, rms: NaN }).status).toBe('unavailable');
    expect(assessStrum(notes(), [], quality).status).toBe('unavailable');
  });
  it('does not award weak or fleeting model output', () => {
    expect(
      assessStrum(
        notes().map((n) => ({ ...n, confidence: 0.2 })),
        shape,
        quality
      ).status
    ).toBe('not-confirmed');
    expect(assessStrum(notes(shape, 0, 0.05), shape, quality).status).toBe('not-confirmed');
  });
});
