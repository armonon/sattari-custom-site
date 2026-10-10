import { describe, expect, it } from 'vitest';
import { audioEnergyAt, BACKGROUND_MODES, drawBackground } from './lyricBackgrounds';

describe('audioEnergyAt', () => {
  it('is 0 for silence', () => {
    const samples = new Float32Array(44100);
    expect(audioEnergyAt(samples, 44100, 0.5)).toBe(0);
  });

  it('reports higher RMS for a louder window', () => {
    const rate = 44100;
    const samples = new Float32Array(rate * 2);
    for (let i = 0; i < rate; i++) samples[i] = 0.1 * Math.sin(i * 0.1); // quiet half
    for (let i = rate; i < rate * 2; i++) samples[i] = 0.9 * Math.sin(i * 0.1); // loud half
    const quiet = audioEnergyAt(samples, rate, 0.5);
    const loud = audioEnergyAt(samples, rate, 1.5);
    expect(loud).toBeGreaterThan(quiet);
  });

  it('returns 0 for an empty or missing buffer', () => {
    expect(audioEnergyAt(null, 44100, 1)).toBe(0);
    expect(audioEnergyAt(new Float32Array(0), 44100, 1)).toBe(0);
  });
});

describe('drawBackground', () => {
  function fakeCtx() {
    const calls = [];
    return {
      calls,
      fillStyle: '',
      fillRect: (...args) => calls.push(['fillRect', ...args]),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      drawImage: () => {},
    };
  }

  it('registers exactly the three documented background modes', () => {
    expect(BACKGROUND_MODES.map((m) => m.id)).toEqual(['audio-reactive', 'gradient', 'media']);
  });

  it('dispatches to the gradient mode without throwing', () => {
    const ctx = fakeCtx();
    expect(() =>
      drawBackground(ctx, 'gradient', { type: 'solid', colors: ['#111'] }, 100, 100)
    ).not.toThrow();
    expect(ctx.calls.some((c) => c[0] === 'fillRect')).toBe(true);
  });

  it('falls back to the gradient mode for an unknown mode id', () => {
    const ctx = fakeCtx();
    expect(() =>
      drawBackground(ctx, 'nonexistent', { type: 'solid', colors: ['#111'] }, 100, 100)
    ).not.toThrow();
  });
});
