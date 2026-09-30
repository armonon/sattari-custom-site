import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as ort from 'onnxruntime-web';
import { analyzeAutoKey } from '../src/loop/autoKey.js';
import { CREPE_MODEL, transcribeNeural } from '../src/loop/neuralPitch.js';
import { keyProgression, melodyFixture, floatWave } from './loop-analysis-fixtures.mjs';

// Optional: LOOP_NATIVE_KEY_RENDER=/path/to/SongKeyRender node scripts/qualify-loop-analysis.mjs
// Writes numeric evidence locally. Never uploads audio or labels to a service.
const report = {
  date: new Date().toISOString(),
  scope: 'Synthetic signal qualification; not real-player or full-band transcription accuracy.',
  key: [],
  pitch: [],
};
const outputDir = '.local-data/loop-analysis';
mkdirSync(outputDir, { recursive: true });
const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (const rate of [44100, 48000]) {
  for (let root = 0; root < 12; root++)
    for (const minor of [false, true]) {
      const audio = keyProgression(root, minor, rate);
      const result = analyzeAutoKey(audio, rate);
      const row = {
        root,
        minor,
        rate,
        detectedRoot: result.root,
        detectedMinor: result.minor,
        margin: result.margin,
      };
      assert.equal(result.root, root);
      assert.equal(result.minor, minor);
      if (process.env.LOOP_NATIVE_KEY_RENDER) {
        const path = `${outputDir}/parity.wav`;
        writeFileSync(path, floatWave(audio, rate));
        const native = spawnSync(
          process.env.LOOP_NATIVE_KEY_RENDER,
          ['--analyse-file', `${process.cwd()}/${path}`],
          { encoding: 'utf8', timeout: 120000 }
        );
        assert.equal(native.status, 0, native.stderr);
        const match = native.stdout.match(
          /^(\S+) (major|minor) \| margin ([\d.]+) \| alternate (\S+) (major|minor)/m
        );
        assert.ok(match, native.stdout);
        assert.equal(keyNames.indexOf(match[1]), result.root);
        assert.equal(match[2] === 'minor', result.minor);
        assert.equal(keyNames.indexOf(match[4]), result.alternative.root);
        assert.equal(match[5] === 'minor', result.alternative.minor);
        assert.ok(Math.abs(Number(match[3]) - result.margin) < 0.0006, native.stdout);
        row.native = native.stdout.trim();
        rmSync(path);
      }
      report.key.push(row);
    }
}
console.log(
  `AutoKey: ${report.key.length} synthetic key/rate cases passed${process.env.LOOP_NATIVE_KEY_RENDER ? ' with native primary, alternative and margin parity' : ''}.`
);
const model = readFileSync('public/models/loop/crepe-tiny.onnx');
assert.equal(createHash('sha256').update(model).digest('hex'), CREPE_MODEL.sha256);
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
try {
  const cases = [
    ['open strings and fretted notes, strong second harmonic', {}],
    ['quiet plucks', { gain: 0.08 }],
    ['plucks with deterministic background noise', { noise: 0.015 }],
    [
      'fast eighth-note riff',
      { midis: [64, 67, 69, 67, 64, 62, 64, 64], spacing: 0.2, length: 0.15 },
    ],
    ['repeated ringing notes', { midis: [64, 64, 64, 64], spacing: 0.4, length: 0.65 }],
    ['silence', { midis: [64], gain: 0 }],
    ['unpitched noise', { midis: [64], gain: 0, noise: 0.08 }],
  ];
  for (const [name, options] of cases) {
    const { audio, rate, expected } = melodyFixture(options);
    const started = performance.now();
    const notes = await transcribeNeural(audio, rate, ort, session);
    const target = options.gain === 0 ? [] : expected;
    const pitchPass =
      JSON.stringify(notes.map((n) => n.midi)) === JSON.stringify(target.map((n) => n.midi));
    const maxOnsetError =
      pitchPass && notes.length
        ? Math.max(...notes.map((n, i) => Math.abs(n.start - target[i].start)))
        : null;
    report.pitch.push({
      name,
      duration: audio.length / rate,
      elapsedMs: Math.round(performance.now() - started),
      expected: target,
      detected: notes,
      pitchPass,
      maxOnsetError,
    });
    console.log(
      `${pitchPass ? 'PASS' : 'FAIL'}: ${name}; ${notes.length}/${target.length} notes, onset error ${maxOnsetError ?? 'n/a'}`
    );
  }
} finally {
  await session.release();
}
writeFileSync(`${outputDir}/qualification.json`, `${JSON.stringify(report, null, 2)}\n`);
assert.ok(
  report.pitch.every((r) => r.pitchPass && (r.maxOnsetError == null || r.maxOnsetError <= 0.08)),
  'Pitch qualification failed; see .local-data/loop-analysis/qualification.json'
);
console.log(
  'Loop analysis qualification passed. Evidence: .local-data/loop-analysis/qualification.json'
);
