import { it, expect } from 'vitest';
import { decodeTempoPath, tempoAt, trackTempo } from './tempoMap';
it('infers a continuous grid through an intro and breakdown without manufacturing one from silence', () => {
  const input = new Float32Array(1500);
  for (let at = 250; at < 1500; at += 25) if (at < 650 || at > 900) input[at] = 1;
  const map = decodeTempoPath(input);
  expect(map.beats[0].time).toBeLessThan(1);
  expect(map.beats.some((b) => b.inferred && b.time > 13 && b.time < 18)).toBe(true);
  expect(Math.max(...map.beats.slice(1).map((b, i) => b.time - map.beats[i].time))).toBeLessThan(
    0.65
  );
  expect(decodeTempoPath(new Float32Array(1500)).beats).toEqual([]);
});
it('tracks gradual acceleration rather than returning one global period', () => {
  const input = new Float32Array(1800);
  let at = 10;
  while (at < 1798) {
    input[Math.round(at)] = 1;
    at += 30 - (6 * at) / 1800;
  }
  const map = decodeTempoPath(input);
  expect(map.beats.length).toBeGreaterThan(50);
  expect(tempoAt(map.beats, 30) - tempoAt(map.beats, 3)).toBeGreaterThan(10);
  expect(map.beats.every((b, i) => !i || b.time > map.beats[i - 1].time)).toBe(true);
});
it('keeps long analysis windows bounded and beat times ordered across joins', () => {
  const rate = 1000,
    samples = new Float32Array(rate * 130);
  for (let at = 0; at < samples.length; at += 500) samples.fill(1, at, at + 20);
  const map = trackTempo(samples, rate);
  expect(map.beats.at(-1).time).toBeGreaterThan(125);
  expect(map.beats.every((b, i) => !i || b.time > map.beats[i - 1].time)).toBe(true);
  expect(tempoAt(map.beats, 122)).toBeCloseTo(120, 0);
});
