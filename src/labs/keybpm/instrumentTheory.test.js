import { describe, expect, it } from 'vitest';
import {
  INSTRUMENTS,
  detectTunerPitch,
  SCALES,
  noteLabel,
  noteFrequency,
  centsFrom,
  scaleNotes,
  spelledScale,
} from './instrumentTheory';
import { reduceSampleRate } from '../../loop/pitch';
import { SCALE_TONICS, parseTonic } from '../../utils/noteSpelling';

describe('instrument references and pitch detection', () => {
  it('uses the sounding open pitches for violin, bass and high-G ukulele', () => {
    expect(INSTRUMENTS.violin.notes.map(noteLabel)).toEqual(['G3', 'D4', 'A4', 'E5']);
    expect(INSTRUMENTS['bass-five'].notes.map(noteLabel)).toEqual(['B0', 'E1', 'A1', 'D2', 'G2']);
    expect(INSTRUMENTS.ukulele.notes.map(noteLabel)).toEqual(['G4', 'C4', 'E4', 'A4']);
  });
  it('measures cents against the chosen concert reference', () => {
    expect(centsFrom(442, 69, 442)).toBeCloseTo(0);
    expect(centsFrom(440 * 2 ** (25 / 1200), 69)).toBeCloseTo(25);
    expect(noteFrequency(69, 432)).toBe(432);
  });
  for (const rate of [44100, 48000]) {
    for (const midi of [...new Set(Object.values(INSTRUMENTS).flatMap((p) => p.notes))]) {
      it(`detects synthetic ${noteLabel(midi)} with harmonics at ${rate} Hz`, () => {
        const hz = noteFrequency(midi);
        const samples = Float32Array.from(
          { length: 8192 },
          (_, i) =>
            0.18 * Math.sin((2 * Math.PI * hz * i) / rate) +
            0.09 * Math.sin((4 * Math.PI * hz * i) / rate)
        );
        const input = reduceSampleRate(samples, rate, 12000);
        const result = detectTunerPitch(input.samples, input.rate);
        expect(result).not.toBeNull();
        expect(Math.abs(centsFrom(result.frequency, midi))).toBeLessThan(6);
      });
    }
  }
  it('does not invent pitch from silence', () => {
    expect(detectTunerPitch(new Float32Array(1365), 8000)).toBeNull();
  });
});
it('builds each scale as a rising octave and gives expected major/minor pitches', () => {
  expect(scaleNotes(0, 'major').map(noteLabel)).toEqual([
    'C3',
    'D3',
    'E3',
    'F3',
    'G3',
    'A3',
    'B3',
    'C4',
  ]);
  expect(scaleNotes(9, 'minor').map(noteLabel)).toEqual([
    'A3',
    'B3',
    'C4',
    'D4',
    'E4',
    'F4',
    'G4',
    'A4',
  ]);
  for (const type of Object.keys(SCALES)) {
    const pitches = scaleNotes(6, type, 2);
    expect(pitches.at(-1) - pitches[0]).toBe(12);
    expect(pitches.every((n, i) => !i || n > pitches[i - 1])).toBe(true);
  }
});

it.each([
  ['F', 'major', 'F3 G3 A3 B♭3 C4 D4 E4 F4'],
  ['F#', 'major', 'F♯3 G♯3 A♯3 B3 C♯4 D♯4 E♯4 F♯4'],
  ['Gb', 'major', 'G♭3 A♭3 B♭3 C♭4 D♭4 E♭4 F4 G♭4'],
  ['C#', 'major', 'C♯3 D♯3 E♯3 F♯3 G♯3 A♯3 B♯3 C♯4'],
  ['Eb', 'minor', 'E♭3 F3 G♭3 A♭3 B♭3 C♭4 D♭4 E♭4'],
  ['Db', 'major-pentatonic', 'D♭3 E♭3 F3 A♭3 B♭3 D♭4'],
  ['Bb', 'minor-pentatonic', 'B♭3 D♭4 E♭4 F4 A♭4 B♭4'],
  ['C', 'blues', 'C3 E♭3 F3 F♯3 G3 B♭3 C4'],
  ['G', 'dorian', 'G3 A3 B♭3 C4 D4 E4 F4 G4'],
  ['F', 'mixolydian', 'F3 G3 A3 B♭3 C4 D4 E♭4 F4'],
])('spells %s %s by scale degree and written octave', (root, pattern, labels) => {
  expect(spelledScale(root, pattern, 3).map((note) => note.label)).toEqual(labels.split(' '));
});

it('matches the written pitch to the sounding MIDI number for every selectable scale', () => {
  const naturals = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  for (const root of SCALE_TONICS) {
    for (const scale of Object.keys(SCALES)) {
      const notes = spelledScale(root, scale, 3);
      expect(notes.map((n) => n.midi)).toEqual(scaleNotes(parseTonic(root).pitchClass, scale, 3));
      for (const { label, midi } of notes) {
        const [, letter, accidental, octave] = /^([A-G])([♯♭]*)(-?\d+)$/.exec(label);
        const alteration = accidental.startsWith('♭') ? -accidental.length : accidental.length;
        expect((Number(octave) + 1) * 12 + naturals[letter] + alteration).toBe(midi);
      }
    }
  }
});

describe('microphone pitch under harmonic ambiguity', () => {
  function measure(midi, harmonics, cents = 0, rate = 48000) {
    const frequency = 440 * 2 ** ((midi - 69 + cents / 100) / 12);
    const samples = Float32Array.from({ length: 8192 }, (_, i) => {
      const phase = (i * frequency * 2 * Math.PI) / rate;
      return harmonics.reduce(
        (sum, amplitude, h) => sum + 0.13 * amplitude * Math.sin((h + 1) * phase + h * 0.51),
        0
      );
    });
    const reduced = reduceSampleRate(samples, rate, 12000);
    const pitch = detectTunerPitch(reduced.samples, reduced.rate);
    expect(pitch).not.toBeNull();
    expect(pitch.midi).toBe(midi);
    expect(Math.abs(1200 * Math.log2(pitch.frequency / frequency))).toBeLessThan(3);
    expect(Math.abs(pitch.cents - cents)).toBeLessThanOrEqual(3);
  }

  it('measures real low and high E strings without folding them toward a target', () => {
    for (const midi of [28, 40, 52, 64, 76]) {
      measure(midi, [0.15, 1, 0.15, 0.3, 0.12, 0.2], -23);
      measure(midi, [1], 17);
    }
  });

  it('recognizes the period from the second and third harmonics when the first is absent', () => {
    for (const midi of [23, 40, 64, 76, 86]) measure(midi, [0, 1, 0.55, 0.3, 0.25, 0.12]);
  });

  it('keeps sustained high violin and chromatic pitches within the in-tune band', () => {
    for (const midi of [76, 86, 93, 95]) {
      for (const rate of [44100, 48000]) {
        measure(midi, [1], 0, rate);
        measure(midi, [0.15, 1, 0.15, 0.3, 0.12, 0.2], 0, rate);
        measure(midi, [1, 0.6, 0.4, 0.5, 0.3, 0.24, 0.2, 0.21, 0.15, 0.1], 0, rate);
      }
    }
  });

  it('rejects unpitched noise and very quiet inputs', () => {
    let seed = 73;
    const noise = Float32Array.from({ length: 2048 }, () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return 0.2 * (seed / 2 ** 32 - 0.5);
    });
    expect(detectTunerPitch(noise, 12000)).toBeNull();
    expect(
      detectTunerPitch(
        Float32Array.from(noise, (v) => v * 0.001),
        12000
      )
    ).toBeNull();
  });
});
