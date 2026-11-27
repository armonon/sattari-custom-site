// Scoring for scripts/benchmark-key-bpm.mjs (kept here so it is unit tested).
import { keyParts } from './keyBpm';

/** MIREX-style key score: exact 1, fifth 0.5, relative 0.3, parallel 0.2. */
export function keyScore(truth, estimate) {
  const t = keyParts(truth);
  const e = keyParts(estimate);
  if (!t || !e) return { score: 0, relation: estimate ? 'other' : 'none' };
  const diff = (e.root - t.root + 12) % 12;
  if (t.minor === e.minor && diff === 0) return { score: 1, relation: 'exact' };
  if (t.minor === e.minor && (diff === 7 || diff === 5)) return { score: 0.5, relation: 'fifth' };
  if (t.minor !== e.minor) {
    const relative = t.minor ? (t.root + 3) % 12 : (t.root + 9) % 12;
    if (e.root === relative) return { score: 0.3, relation: 'relative' };
    if (e.root === t.root) return { score: 0.2, relation: 'parallel' };
  }
  return { score: 0, relation: 'other' };
}

const within = (a, b, tolerance = 0.04) => Math.abs(a - b) <= b * tolerance;
/** Tempo Acc1 (±4%) and Acc2 (also ×2, ×½, ×3, ×⅓). */
export function tempoScore(truth, estimate) {
  if (!estimate) return { acc1: false, acc2: false, relation: 'none' };
  if (within(estimate, truth)) return { acc1: true, acc2: true, relation: 'exact' };
  for (const [factor, name] of [
    [2, 'double'],
    [0.5, 'half'],
    [3, 'triple'],
    [1 / 3, 'third'],
  ])
    if (within(estimate, truth * factor)) return { acc1: false, acc2: true, relation: name };
  return { acc1: false, acc2: false, relation: 'other' };
}
