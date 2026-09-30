import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as ort from 'onnxruntime-web';
import { POLYPHONIC_MODEL, transcribePolyphonic } from '../src/loop/polyphonic.js';
import { assessStrum, captureQuality } from '../src/loop/strumAssessment.js';
function readWave(path) {
  const file = readFileSync(path);
  let rate, format, bits, channels, pcm;
  for (let at = 12; at + 8 <= file.length; ) {
    const name = file.toString('ascii', at, at + 4),
      length = file.readUInt32LE(at + 4),
      start = at + 8;
    if (name === 'fmt ') {
      format = file.readUInt16LE(start);
      channels = file.readUInt16LE(start + 2);
      rate = file.readUInt32LE(start + 4);
      bits = file.readUInt16LE(start + 14);
      if (format === 65534) format = file.readUInt16LE(start + 24);
    } else if (name === 'data') pcm = file.subarray(start, start + length);
    at = start + length + (length % 2);
  }
  assert.equal(format, 3);
  assert.equal(bits, 32);
  assert.equal(channels, 1);
  assert.equal(rate, 22050);
  return {
    rate,
    samples: Float32Array.from({ length: pcm.length / 4 }, (_, i) => pcm.readFloatLE(i * 4)),
  };
}
const manifest = JSON.parse(readFileSync('.local-data/loop-polyphonic/guitarset/manifest.json'));
const model = readFileSync('public/models/loop/basic-pitch.onnx');
assert.equal(createHash('sha256').update(model).digest('hex'), POLYPHONIC_MODEL.sha256);
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
const report = {
  scope:
    'Three preselected GuitarSet accompaniment recordings. First labelled overlap of at least three distinct pitches lasting 150 ms. Reference voicings, not necessarily the app diagrams. Training overlap unknown; not held out, not live microphone accuracy. No threshold tuning.',
  cases: [],
};
try {
  for (const track of manifest.tracks.filter((t) => t.id.endsWith('_comp'))) {
    const reference = JSON.parse(readFileSync(track.labels))
      .annotations.filter((a) => a.namespace === 'note_midi')
      .flatMap((a) =>
        a.data.map((n) => ({
          midi: Math.round(n.value),
          start: n.time,
          end: n.time + n.duration,
          confidence: 1,
        }))
      )
      .filter((n) => n.start < 12 && n.midi >= 40 && n.midi <= 84);
    const times = [...new Set(reference.map((n) => n.start))].sort((a, b) => a - b);
    const onset = times.find(
      (t) =>
        new Set(reference.filter((n) => n.start <= t && n.end >= t + 0.15).map((n) => n.midi))
          .size >= 3
    );
    assert.ok(Number.isFinite(onset), 'Reference must contain an eligible sustained voicing');
    const expected = [
      ...new Set(
        reference.filter((n) => n.start <= onset && n.end >= onset + 0.15).map((n) => n.midi)
      ),
    ].sort((a, b) => a - b);
    const { rate, samples } = readWave(track.audio);
    const start = Math.max(0, onset - 0.25);
    const take = samples.slice(Math.floor(start * rate), Math.floor((start + 2.5) * rate));
    const quality = captureQuality(take, rate);
    const notes = await transcribePolyphonic(take, rate, ort, session);
    const result = assessStrum(notes, expected, quality);
    const wrong = expected.map((m) => m + 1);
    const localReference = reference
      .map((n) => ({ ...n, start: n.start - start, end: n.end - start }))
      .filter((n) => n.end > 0 && n.start < 2.5);
    assert.notEqual(
      assessStrum(localReference, wrong, quality).status,
      'matched',
      'Negative target must be absent in the reference'
    );
    const wrongResult = assessStrum(notes, wrong, quality);
    report.cases.push({ track: track.id, start, expected, result, wrongResult, notes });
    console.log(
      `${track.id}: ${result.status} (${result.heard.length}/${expected.length}); semitone-shifted target: ${wrongResult.status}`
    );
  }
} finally {
  await session.release();
}
writeFileSync(
  '.local-data/loop-strum/recorded-qualification.json',
  JSON.stringify(report, null, 2)
);
assert.ok(
  report.cases.every((c) => c.wrongResult.status !== 'matched'),
  'No false credit on these negative recorded-audio checks'
);
