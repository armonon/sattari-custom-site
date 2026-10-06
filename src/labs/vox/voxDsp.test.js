import { describe, expect, it } from 'vitest';
import { detectFundamental } from '../../loop/pitch';
import {
  correctionCurve,
  detectVocalKey,
  diatonicAbove,
  hzToMidi,
  keyLabel,
  parseKey,
  psola,
  renderVox,
  snapToScale,
  trackPitch,
} from './voxDsp';

const RATE = 44100;

// A voice-like tone: fundamental plus decaying harmonics.
function tone(
  hz,
  seconds,
  rate = RATE,
  out = new Float32Array(Math.round(seconds * rate)),
  at = 0
) {
  let phase = 0;
  for (let i = 0; i < Math.round(seconds * rate); i++) {
    phase += (2 * Math.PI * hz) / rate;
    out[at + i] = 0.3 * Math.sin(phase) + 0.15 * Math.sin(2 * phase) + 0.07 * Math.sin(3 * phase);
  }
  return out;
}

function centsBetween(a, b) {
  return 1200 * Math.log2(a / b);
}

function measured(samples, from = 0.4, to = 0.6) {
  const slice = samples.subarray(
    Math.round(samples.length * from),
    Math.round(samples.length * to)
  );
  return detectFundamental(slice, RATE, 70, 1200, 0.001)?.frequency;
}

describe('scale helpers', () => {
  it('parses keys including flats and defaults to major', () => {
    expect(parseKey('A minor')).toEqual({ root: 9, mode: 'minor' });
    expect(parseKey('Bb')).toEqual({ root: 10, mode: 'major' });
    expect(parseKey('nope')).toBeNull();
    expect(keyLabel({ root: 1, mode: 'major' })).toBe('C# major');
  });

  it('snaps to the nearest scale note', () => {
    expect(snapToScale(61.3, 0, 'major')).toBe(62);
    expect(snapToScale(60.4, 0, 'major')).toBe(60);
    expect(snapToScale(61.3, 0, 'chromatic')).toBe(61);
    expect(snapToScale(63.2, 9, 'minor')).toBe(64);
  });

  it('builds diatonic thirds and fifths', () => {
    expect(diatonicAbove(60, 0, 'major', 2)).toBe(64);
    expect(diatonicAbove(62, 0, 'major', 2)).toBe(65);
    expect(diatonicAbove(60, 0, 'major', 4)).toBe(67);
    expect(diatonicAbove(69, 9, 'minor', 2)).toBe(72);
    expect(diatonicAbove(60, 0, 'chromatic', 2)).toBe(64);
  });
});

describe('pitch tracking and correction', () => {
  it('tracks a steady tone within a few cents', () => {
    const track = trackPitch(tone(220, 1), RATE);
    const voiced = Array.from(track.f0).filter(Boolean);
    expect(voiced.length).toBeGreaterThan(track.f0.length * 0.8);
    const sorted = voiced.sort((a, b) => a - b);
    expect(Math.abs(centsBetween(sorted[sorted.length >> 1], 220))).toBeLessThan(8);
  });

  it('treats silence as unvoiced', () => {
    const track = trackPitch(new Float32Array(RATE), RATE);
    expect(Array.from(track.f0).every((value) => value === 0)).toBe(true);
    expect(detectVocalKey(track)).toMatchObject({ valid: false });
  });

  it('shifts pitch with PSOLA while keeping duration', () => {
    const input = tone(220, 1);
    const track = trackPitch(input, RATE);
    const up = psola(input, RATE, track, new Float32Array(track.f0.length).fill(2));
    expect(up.length).toBe(input.length);
    expect(Math.abs(centsBetween(measured(up), 220 * 2 ** (2 / 12)))).toBeLessThan(15);
    const same = psola(input, RATE, track, new Float32Array(track.f0.length));
    expect(Math.abs(centsBetween(measured(same), 220))).toBeLessThan(8);
  });

  it('pulls an off-key note to the scale according to strength', () => {
    const sharp = 220 * 2 ** (40 / 1200); // A3 + 40 cents
    const input = tone(sharp, 1);
    const track = trackPitch(input, RATE);
    const full = renderVox(input, RATE, track, { root: 0, mode: 'major', strength: 1, speedMs: 0 });
    expect(Math.abs(centsBetween(measured(full.lead), 220))).toBeLessThan(10);
    const half = correctionCurve(track, { root: 0, mode: 'major', strength: 0.5, speedMs: 0 });
    const voiced = Array.from(half.lead).filter((value, i) => track.f0[i]);
    const middle = voiced[voiced.length >> 1];
    expect(middle).toBeCloseTo(-0.2, 1);
  });

  it('adds a diatonic harmony a third above', () => {
    const input = tone(261.63, 1); // C4
    const track = trackPitch(input, RATE);
    const result = renderVox(input, RATE, track, {
      root: 0,
      mode: 'major',
      strength: 1,
      speedMs: 0,
      harmony: 'third',
    });
    expect(Math.abs(centsBetween(measured(result.harmony), 329.63))).toBeLessThan(15);
    expect(Math.max(...result.mix.map(Math.abs))).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-6);
  });

  it('estimates the key of a sung C major phrase', () => {
    const notes = [60, 64, 67, 72, 67, 65, 64, 62, 60, 67, 64, 60, 59, 62, 67, 60];
    const input = new Float32Array(Math.round(notes.length * 0.4 * RATE));
    notes.forEach((midi, index) =>
      tone(440 * 2 ** ((midi - 69) / 12), 0.35, RATE, input, Math.round(index * 0.4 * RATE))
    );
    const key = detectVocalKey(trackPitch(input, RATE));
    expect(key).toMatchObject({ valid: true, root: 0, mode: 'major' });
    expect(hzToMidi(440)).toBe(69);
  });
});

describe('note changes', () => {
  it('follows a sharp step down from F to E without sticking to the old note', () => {
    const input = new Float32Array(RATE);
    tone(440 * 2 ** ((65.38 - 69) / 12), 0.5, RATE, input, 0);
    tone(440 * 2 ** ((64.38 - 69) / 12), 0.5, RATE, input, Math.round(0.5 * RATE));
    const track = trackPitch(input, RATE);
    const { lead } = correctionCurve(track, { root: 0, mode: 'major', strength: 1, speedMs: 0 });
    const late = Math.floor(track.f0.length * 0.85);
    expect(hzToMidi(track.f0[late]) + lead[late]).toBeCloseTo(64, 1);
  });
});
