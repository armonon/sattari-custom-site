// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeAutoKey, keyResample } from './autoKey';
import { keyProgression, melodyFixture } from '../../scripts/loop-analysis-fixtures.mjs';

const cases = [44100, 48000].flatMap((rate) =>
  Array.from({ length: 12 }, (_, root) =>
    [false, true].map((minor) => ({ rate, root, minor }))
  ).flat()
);
it.each(cases)(
  'recognizes root $root / minor $minor at $rate Hz',
  ({ rate, root, minor }) => {
    const result = analyzeAutoKey(keyProgression(root, minor, rate), rate);
    expect([result.root, result.minor]).toEqual([root, minor]);
    expect(result.alternative.key).not.toBe(result.key);
    expect(result.margin).toBeGreaterThan(0);
  },
  60000
);

it('does not present silence, one pitch or non-finite input as a supported key', () => {
  expect(analyzeAutoKey(new Float32Array(32000), 16000).valid).toBe(false);
  expect(analyzeAutoKey(new Float32Array(16000).fill(NaN), 16000).evidence).toBe('insufficient');
  const { audio, rate } = melodyFixture({ midis: [64, 64, 64], harmonics: false });
  expect(analyzeAutoKey(audio, rate).evidence).not.toBe('supported');
});

it('retains alternative section evidence for a changing song', () => {
  const chunks = [
    keyProgression(0, false, 16000),
    keyProgression(0, false, 16000),
    keyProgression(6, true, 16000),
    keyProgression(6, true, 16000),
    keyProgression(2, false, 16000),
    keyProgression(2, false, 16000),
  ];
  const audio = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }
  const result = analyzeAutoKey(audio, 16000);
  expect(result.sections.length).toBe(4);
  expect(new Set(result.sections.map((s) => s.key)).size).toBeGreaterThan(1);
  expect(result.possibleModulation).toBe(true);
});

it('preserves native rounded resampling boundaries and validates the rate', () => {
  expect([...keyResample(Float32Array.from([1, 2, 3, 4, 5]), 40000)]).toEqual([2, 4.5]);
  expect([...keyResample(Float32Array.from([1, 2]), 8000)]).toEqual([1, 1, 2, 2]);
  expect(() => keyResample(new Float32Array(2), 0)).toThrow(/sample rate/);
});
