import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as ort from 'onnxruntime-web';
import { transcribePolyphonic, POLYPHONIC_MODEL } from '../src/loop/polyphonic.js';
import { assessStrum, captureQuality } from '../src/loop/strumAssessment.js';
import { strumFixture, STRUM_CASES } from './loop-strum-fixtures.mjs';
const model = readFileSync('public/models/loop/basic-pitch.onnx');
assert.equal(createHash('sha256').update(model).digest('hex'), POLYPHONIC_MODEL.sha256);
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
const report = {
  date: new Date().toISOString(),
  scope:
    'Synthetic PCM regression using the real pinned model, not real guitar or microphone accuracy.',
  cases: [],
};
try {
  for (const fixture of STRUM_CASES) {
    const samples = strumFixture(fixture.played ?? fixture.expected, {
      ...fixture.options,
      rate: 22050,
    });
    const notes = await transcribePolyphonic(samples, 22050, ort, session);
    const result = assessStrum(notes, fixture.expected, captureQuality(samples, 22050));
    report.cases.push({ name: fixture.name, correct: !!fixture.correct, result, notes });
    console.log(
      `${fixture.name}: ${result.status} (${result.heard.length}/${result.expected.length})`
    );
  }
} finally {
  await session.release();
}
report.matchedCorrect = report.cases.filter(
  (c) => c.correct && c.result.status === 'matched'
).length;
report.correctCases = report.cases.filter((c) => c.correct).length;
report.falseCredits = report.cases.filter(
  (c) => !c.correct && c.result.status === 'matched'
).length;
mkdirSync('.local-data/loop-strum', { recursive: true });
writeFileSync('.local-data/loop-strum/qualification.json', JSON.stringify(report, null, 2));
assert.equal(report.falseCredits, 0, 'Do not ship false credit on these negative regressions');
assert.ok(
  report.matchedCorrect > 0,
  'At least one correct synthetic strum must traverse the model and scorer'
);
console.log(
  JSON.stringify({
    matchedCorrect: report.matchedCorrect,
    correctCases: report.correctCases,
    falseCredits: report.falseCredits,
  })
);
