// @vitest-environment node
import { expect, it } from 'vitest';
import { decodeSalience, notesFromPitchFrames } from './neuralPitch';
import { analysisMono } from './importAudio';

it('uses the native CREPE cents mapping and abstains below threshold', () => {
  const salience = new Float32Array(360);
  salience[228] = 0.9;
  const result = decodeSalience(salience);
  const hz = 10 * 2 ** ((1997.3794084376191 + 228 * 20) / 1200);
  expect(result.midi).toBe(Math.round(69 + 12 * Math.log2(hz / 440)));
  salience[228] = 0.3;
  expect(decodeSalience(salience)).toBeNull();
  expect(decodeSalience(new Float32Array(360).fill(NaN))).toBeNull();
});

it('separates repeated attacks and rests while rejecting one-frame octave errors', () => {
  const frames = Array.from({ length: 50 }, (_, i) => ({
    time: i * 0.02,
    midi: i < 15 ? 64 : i < 20 ? null : 67,
    confidence: 0.9,
    attack: i === 35,
  }));
  frames[8].midi = 76;
  const notes = notesFromPitchFrames(frames, 1);
  expect(notes.map((n) => n.midi)).toEqual([64, 67, 67]);
  expect(notes[1].start).toBeCloseTo(0.4);
  expect(notes[2].start).toBeCloseTo(0.7);
  expect(notes[0].end).toBeLessThan(notes[1].start);
});

it('does not convert out-of-guitar-range notes or short glitches into a lesson', () => {
  const frames = [30, 30, 30, 30, 100, 100, 100, 100, 64, 64, null].map((midi, i) => ({
    midi,
    time: i * 0.02,
    confidence: 0.99,
  }));
  expect(notesFromPitchFrames(frames, 0.22)).toEqual([]);
});

it('preserves opposite-polarity stereo and removes non-finite samples', () => {
  const a = Float32Array.from([0.2, -0.4, 0.3, NaN]);
  const b = Float32Array.from(a, (v) => -v);
  const mono = analysisMono({ numberOfChannels: 2, length: 4, getChannelData: (i) => [a, b][i] });
  expect([...mono]).toEqual([a[0], a[1], a[2], 0]);
});
