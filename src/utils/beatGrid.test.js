// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  barLoop,
  clicksBetween,
  computeBeatGrid,
  isDownbeat,
  nearestBeatIndex,
  rhythmSignal,
  snapToBeat,
} from './beatGrid';

const beats = Array.from({ length: 32 }, (_, i) => i * 0.5); // 120 BPM

describe('beat grid helpers', () => {
  it('snaps to the nearest beat', () => {
    expect(nearestBeatIndex(beats, 1.2)).toBe(2);
    expect(snapToBeat(beats, 1.3)).toBe(1.5);
    expect(snapToBeat([], 1.3)).toBe(1.3);
  });
  it('builds bar loops from the bar containing the playhead, honoring bar offset', () => {
    expect(barLoop(beats, 2.7, 1)).toEqual({ a: 2, b: 4 });
    expect(barLoop(beats, 2.7, 2, 1)).toEqual({ a: 2.5, b: 6.5 });
    expect(isDownbeat(5, 1)).toBe(true);
    // Past the last tracked beat the grid is extended at the recent tempo.
    expect(barLoop(beats, 15.2, 1)).toEqual({ a: 14, b: 16 });
  });
  it('lists clicks on the playback timeline, including loop repeats', () => {
    const plain = clicksBetween(beats, { offset: 1.25 }, -1, 1);
    expect(plain.map((c) => c.elapsed)).toEqual([0.25, 0.75]);
    const looped = clicksBetween(beats, { offset: 2, loopA: 2, loopB: 4 }, -1, 4.5);
    // First pass 2,2.5,3,3.5 then repeats every 2 s.
    expect(looped.map((c) => c.elapsed)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]);
    expect(looped.filter((c) => c.downbeat).map((c) => c.elapsed)).toEqual([0, 2, 4]);
  });
  it('finds a steady beat in a click track and none in silence', () => {
    const rate = 44100;
    const seconds = 12;
    const signal = new Float32Array(rate * seconds);
    for (let b = 0; b < seconds * 2; b++)
      for (let i = 0; i < 2000; i++)
        signal[Math.floor(b * 0.5 * rate) + i] = Math.sin(i * 0.3) * Math.exp(-i / 300);
    const { samples, rate: r } = rhythmSignal([[signal, signal]], rate);
    const grid = computeBeatGrid(samples, r);
    expect(grid.usable).toBe(true);
    expect(grid.bpm).toBeGreaterThan(116);
    expect(grid.bpm).toBeLessThan(124);
    const silent = computeBeatGrid(new Float32Array(r * 10), r);
    expect(silent.usable).toBe(false);
  });
});
