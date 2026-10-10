import { describe, expect, it } from 'vitest';
import { analyseSamples, demoView, featuresAt, loopView, mixToMono } from './canvasFeatures';
import { chladniPoints, hexToRgb, rgba, seeded } from './canvasScenes';

const RATE = 22050;

/** A 120 BPM four-on-the-floor: 55 Hz kick bursts every 0.5 s over quiet hiss. */
function kickTrack(seconds = 4) {
  const samples = new Float32Array(seconds * RATE);
  const random = seeded(7);
  for (let i = 0; i < samples.length; i++) samples[i] = (random() * 2 - 1) * 0.01;
  for (let beat = 0; beat < seconds * 2; beat++) {
    const start = Math.round(beat * 0.5 * RATE);
    for (let i = 0; i < RATE * 0.25 && start + i < samples.length; i++) {
      const t = i / RATE;
      samples[start + i] += Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t / 0.06) * 0.9;
    }
  }
  return samples;
}

describe('analyseSamples', () => {
  it('finds each kick of a 120 BPM pattern within a frame or two', () => {
    const analysis = analyseSamples(kickTrack(4), RATE);
    expect(analysis.onsets.length).toBeGreaterThanOrEqual(7);
    expect(analysis.onsets.length).toBeLessThanOrEqual(8);
    for (const onset of analysis.onsets) {
      const nearest = Math.round(onset / 0.5) * 0.5;
      expect(Math.abs(onset - nearest)).toBeLessThan(0.04);
    }
  });

  it('normalises envelopes into 0..1', () => {
    const analysis = analyseSamples(kickTrack(2), RATE);
    for (const key of ['energy', 'low', 'high']) {
      const values = Array.from(analysis[key]);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...values)).toBeLessThanOrEqual(1);
    }
  });

  it('reports no kicks in silence without dividing by zero', () => {
    const analysis = analyseSamples(new Float32Array(RATE), RATE);
    expect(analysis.onsets).toEqual([]);
    expect(Array.from(analysis.energy).every(Number.isFinite)).toBe(true);
  });
});

describe('loopView', () => {
  it('slices the loop and wraps the kick envelope across the seam', () => {
    const analysis = analyseSamples(kickTrack(6), RATE);
    const view = loopView(analysis, 1, 2);
    expect(view.frames).toBe(120);
    expect(view.onsets.length).toBeGreaterThanOrEqual(3);
    // The loop starts on a kick, so the first frames carry its envelope...
    expect(featuresAt(view, 0.02).kick).toBeGreaterThan(0.3);
    // ...and the envelope just before the seam continues from the last kick.
    expect(featuresAt(view, 1.99).kick).toBeLessThan(featuresAt(view, 0.02).kick);
  });

  it('reads features with loop-time wrapping', () => {
    const view = demoView(4);
    expect(featuresAt(view, 0.25)).toEqual(featuresAt(view, 4.25));
    expect(featuresAt(view, -0.5)).toEqual(featuresAt(view, 3.5));
  });
});

describe('helpers', () => {
  it('mixes channels to mono', () => {
    const buffer = {
      numberOfChannels: 2,
      length: 2,
      getChannelData: (c) => (c ? new Float32Array([1, 0]) : new Float32Array([0, 1])),
    };
    expect(Array.from(mixToMono(buffer))).toEqual([0.5, 0.5]);
  });

  it('parses colours and builds deterministic plate points', () => {
    expect(hexToRgb('#d6b36d')).toEqual([214, 179, 109]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(rgba('#000000', 2)).toBe('rgba(0, 0, 0, 1)');
    const points = chladniPoints();
    expect(points).toHaveLength(4);
    expect(points[0][0]).toBe(chladniPoints()[0][0]);
    expect(Array.from(points[1]).every((value) => value >= -1 && value <= 1)).toBe(true);
  });
});
