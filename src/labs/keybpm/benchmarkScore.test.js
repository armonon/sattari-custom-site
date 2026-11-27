// @vitest-environment node
import { expect, it } from 'vitest';
import { keyScore, tempoScore } from './benchmarkScore';

it.each([
  ['A minor', 'A minor', 'exact', 1],
  ['A minor', 'E minor', 'fifth', 0.5],
  ['A minor', 'D minor', 'fifth', 0.5],
  ['A minor', 'C major', 'relative', 0.3],
  ['C major', 'A minor', 'relative', 0.3],
  ['A minor', 'A major', 'parallel', 0.2],
  ['A minor', 'F# major', 'other', 0],
  ['A minor', '', 'none', 0],
])('key %s vs %s is %s', (truth, estimate, relation, score) => {
  expect(keyScore(truth, estimate)).toEqual({ relation, score });
});

it.each([
  [120, 123, 'exact', true, true],
  [120, 240, 'double', false, true],
  [88, 44, 'half', false, true],
  [76, 115, 'other', false, false],
  [90, null, 'none', false, false],
])('tempo %s vs %s is %s', (truth, estimate, relation, acc1, acc2) => {
  expect(tempoScore(truth, estimate)).toEqual({ relation, acc1, acc2 });
});
