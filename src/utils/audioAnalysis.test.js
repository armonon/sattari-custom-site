import { describe, expect, it } from 'vitest';
import {
  createWaveformPeaks,
  detectPitch,
  estimateKeyFromChroma,
  estimateTempo,
} from './audioAnalysis';

describe('audio analysis', () => {
  it('finds a steady 120 BPM pulse from local samples', () => {
    const sampleRate = 11025;
    const samples = new Float32Array(sampleRate * 12);

    for (let second = 0; second < 12; second += 0.5) {
      const start = Math.floor(second * sampleRate);
      for (let index = 0; index < 120; index += 1) {
        samples[start + index] = (1 - index / 120) * 0.9;
      }
    }

    const result = estimateTempo(samples, sampleRate);
    expect(result.bpm).toBeGreaterThanOrEqual(117);
    expect(result.bpm).toBeLessThanOrEqual(121);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('identifies an A minor tonal profile', () => {
    const chroma = Array.from({ length: 12 }, () => 0);
    chroma[9] = 1;
    chroma[0] = 0.8;
    chroma[4] = 0.7;

    expect(estimateKeyFromChroma(chroma)).toMatchObject({
      key: 'A minor',
      tonic: 'A',
      mode: 'minor',
    });
  });

  it('returns stable waveform bins and live pitch', () => {
    const sampleRate = 44100;
    const samples = Float32Array.from(
      { length: 4096 },
      (_, index) => Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.5
    );

    expect(createWaveformPeaks(samples, 32)).toHaveLength(32);
    const pitch = detectPitch(samples, sampleRate);
    expect(pitch.note).toBe('A4');
    expect(pitch.frequency).toBeGreaterThan(435);
    expect(pitch.frequency).toBeLessThan(445);
  });
});
