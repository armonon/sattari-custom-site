// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  analyzeStemAudio,
  musicalAnalysisWindows,
  safeAnalyzeStemAudio,
} from './stemMusicalAnalysis';

// The separator decodes both song and stem PCM at this working sample rate.
const rate = 44100;
function chord(root = 60, minor = false, seconds = 8) {
  return Float32Array.from({ length: seconds * rate }, (_, i) =>
    [0, minor ? 3 : 4, 7].reduce(
      (sum, interval) =>
        sum + 0.15 * Math.sin((2 * Math.PI * 440 * 2 ** ((root + interval - 69) / 12) * i) / rate),
      0
    )
  );
}
function clicks(bpm = 120, seconds = 10) {
  const samples = new Float32Array(seconds * rate);
  for (let t = 0.2; t < seconds; t += 60 / bpm) {
    for (let i = 0; i < 2000; i++) {
      const at = Math.floor(t * rate) + i;
      if (at < samples.length) samples[at] += 0.8 * Math.exp(-i / 240) * Math.sin(i * 0.225);
    }
  }
  return samples;
}

describe('bounded musical analysis', () => {
  it('never invents a default key or BPM for silence, quiet signals, or short audio', () => {
    for (const samples of [
      new Float32Array(rate * 4),
      chord().map((value) => value * 0.00001),
      chord(60, false, 1),
    ]) {
      const result = analyzeStemAudio(samples, samples, rate);
      expect(result.key).toBeNull();
      expect(result.bpm).toBeNull();
    }
    const silence = new Float32Array(rate * 4);
    expect(analyzeStemAudio(silence, silence, rate)).toMatchObject({ peakDb: null, rmsDb: null });
  });
  it.each([
    [60, false, 'C major'],
    [62, false, 'D major'],
  ])('identifies a sustained %s triad without inventing rhythm', (root, minor, key) => {
    const samples = chord(root, minor);
    const result = analyzeStemAudio(samples, samples, rate);
    expect(result.key).toBe(key);
    expect(result.keyEngine).toBe('sattari-autokey');
    expect(result.keyAnalyzedSeconds).toBe(8);
    expect(result.keyConfidence).toBeGreaterThanOrEqual(0.1);
    expect(result.keyAlternative).not.toBe(result.key);
    expect(result.prominentNotes).toHaveLength(3);
    expect(result.bpm).toBeNull();
  });
  it('preserves AutoKey ambiguity instead of substituting the old triad key formula', () => {
    const samples = chord(57, true);
    const result = analyzeStemAudio(samples, samples, rate);
    expect(result).toMatchObject({
      keyEngine: 'sattari-autokey',
      key: 'A major',
      keyAlternative: 'A minor',
      keyEvidence: 'tentative',
    });
    expect(result.keyConfidence).toBeLessThan(0.1);
    expect(result.prominentNotes).toEqual(expect.arrayContaining(['A', 'C', 'E']));
  });
  it.each([90, 120, 150])('detects a %s BPM pulse but does not assign a key to drums', (bpm) => {
    const samples = clicks(bpm);
    const result = analyzeStemAudio(samples, samples, rate, { stem: 'drums' });
    expect(result.bpm).toBeCloseTo(bpm, -1);
    expect(result.key).toBeNull();
    expect(result.keyReason).toBe('percussion');
    expect(result.prominentNotes).toEqual([]);
  });
  it('preserves antiphase tonal content and measures levels across both channels', () => {
    const samples = chord();
    const inverse = samples.map((value) => -value);
    const result = analyzeStemAudio(samples, inverse, rate);
    expect(result.key).toBe('C major');
    expect(result.rmsDb).toBeCloseTo(20 * Math.log10(Math.sqrt((3 * 0.15 ** 2) / 2)), 1);
    expect(result.peakDb).toBeLessThan(0);
  });
  it('keeps pitch classes without asserting a full key for a single note', () => {
    const samples = Float32Array.from(
      { length: rate * 8 },
      (_, i) => 0.5 * Math.sin((2 * Math.PI * 220 * i) / rate)
    );
    const result = analyzeStemAudio(samples, samples, rate, { stem: 'bass' });
    expect(result.key).toBeNull();
    expect(result.prominentNotes).toContain('A');
  });
  it('spreads bounded excerpts across long tracks and measures the entire signal', () => {
    expect(musicalAnalysisWindows(600)).toEqual([
      { start: 0, end: 20 },
      { start: 290, end: 310 },
      { start: 580, end: 600 },
    ]);
    const samples = new Float32Array(rate * 100);
    samples.fill(0.8, rate * 30, rate * 30 + 4);
    const result = analyzeStemAudio(samples, samples, rate);
    expect(result.analyzedSeconds).toBe(60);
    expect(result.peakDb).toBe(-1.9);
    expect(result.key).toBeNull();
    expect(result.bpm).toBeNull();
    expect(result.duration).toBe(100);
  });
  it('does not mutate PCM and tolerates analysis failures independently of separation', () => {
    const samples = clicks();
    const original = samples.slice();
    analyzeStemAudio(samples, samples, rate);
    expect(samples.every((sample, i) => sample === original[i])).toBe(true);
    expect(safeAnalyzeStemAudio(new Float32Array([NaN]), new Float32Array(1), rate)).toEqual({
      version: 1,
      status: 'unavailable',
    });
    expect(safeAnalyzeStemAudio([], [], rate).status).toBe('unavailable');
  });
  it('withholds a global BPM when sampled sections have conflicting pulses', () => {
    const samples = new Float32Array(rate * 70);
    samples.set(clicks(90, 20), 0);
    samples.set(clicks(120, 20), rate * 25);
    samples.set(clicks(150, 20), rate * 50);
    expect(analyzeStemAudio(samples, samples, rate, { stem: 'drums' })).toMatchObject({
      bpm: null,
      tempoReason: 'variable',
    });
  });
  it('does not report a key or beat for steady broadband noise', () => {
    let state = 42;
    const samples = Float32Array.from({ length: rate * 8 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) | 0;
      return (state / 2147483648) * 0.2;
    });
    expect(analyzeStemAudio(samples, samples, rate)).toMatchObject({ key: null, bpm: null });
  });
});
