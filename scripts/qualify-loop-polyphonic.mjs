import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as ort from 'onnxruntime-web';
import { POLYPHONIC_MODEL, transcribePolyphonic } from '../src/loop/polyphonic.js';

function wave(path, seconds) {
  const b = readFileSync(path);
  let at = 12,
    rate,
    bits,
    channels,
    format,
    pcm;
  while (at + 8 <= b.length) {
    const name = b.toString('ascii', at, at + 4),
      length = b.readUInt32LE(at + 4),
      p = at + 8;
    if (name === 'fmt ') {
      format = b.readUInt16LE(p);
      channels = b.readUInt16LE(p + 2);
      rate = b.readUInt32LE(p + 4);
      bits = b.readUInt16LE(p + 14);
      if (format === 65534) format = b.readUInt16LE(p + 24);
    } else if (name === 'data') pcm = b.subarray(p, p + length);
    at = p + length + (length % 2);
  }
  assert.equal(format, 3, 'Use 32-bit floating-point WAV files');
  assert.equal(bits, 32);
  assert.equal(channels, 1);
  assert.equal(rate, 22050);
  const samples = Float32Array.from(
    { length: Math.min(pcm.length / 4, Math.floor(seconds * rate)) },
    (_, i) => pcm.readFloatLE(i * 4)
  );
  return { samples, rate };
}

// Maximum one-to-one matching, exact rounded MIDI and a fixed 50 ms onset tolerance.
// No offset criterion. An onset-only F1 must not be described as complete transcription accuracy.
function matchNotes(reference, detected) {
  const assigned = new Map();
  const find = (i, seen) => {
    for (let j = 0; j < detected.length; j++) {
      if (
        seen.has(j) ||
        reference[i].midi !== detected[j].midi ||
        Math.abs(reference[i].start - detected[j].start) > 0.05
      )
        continue;
      seen.add(j);
      if (!assigned.has(j) || find(assigned.get(j), seen)) {
        assigned.set(j, i);
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < reference.length; i++) find(i, new Set());
  const tp = assigned.size,
    precision = tp / Math.max(1, detected.length),
    recall = tp / Math.max(1, reference.length);
  return {
    truePositive: tp,
    falsePositive: detected.length - tp,
    falseNegative: reference.length - tp,
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
  };
}

const model = readFileSync('public/models/loop/basic-pitch.onnx');
assert.equal(createHash('sha256').update(model).digest('hex'), POLYPHONIC_MODEL.sha256);
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
const dir = '.local-data/loop-polyphonic';
mkdirSync(dir, { recursive: true });
const report = {
  date: new Date().toISOString(),
  model: POLYPHONIC_MODEL,
  scope:
    'Real recorded acoustic guitar, published GuitarSet note labels. Training overlap unknown. Not held-out or real-time microphone accuracy.',
  metric:
    'Exact rounded MIDI, one-to-one onset match within 50 ms. Note offsets not graded. First 12 s of six predetermined tracks; no tuning on these examples.',
  tracks: [],
};
try {
  const silent = await transcribePolyphonic(new Float32Array(22050), 22050, ort, session);
  assert.equal(silent.length, 0, 'Silence must not generate notes');
  const manifest = JSON.parse(readFileSync(`${dir}/guitarset/manifest.json`));
  for (const track of manifest.tracks) {
    const { samples, rate } = wave(track.audio, track.seconds);
    const labels = JSON.parse(readFileSync(track.labels));
    const reference = labels.annotations
      .filter((a) => a.namespace === 'note_midi')
      .flatMap((a) =>
        a.data.map((n) => ({ midi: Math.round(n.value), start: n.time, end: n.time + n.duration }))
      )
      .filter(
        (n) => n.start >= 0 && n.start < samples.length / rate && n.midi >= 40 && n.midi <= 84
      );
    const start = performance.now();
    const detected = await transcribePolyphonic(samples, rate, ort, session);
    const result = {
      id: track.id,
      elapsedMs: Math.round(performance.now() - start),
      ...matchNotes(reference, detected),
      reference,
      detected,
    };
    report.tracks.push(result);
    console.log(
      `${track.id}: precision ${(100 * result.precision).toFixed(1)}%, recall ${(100 * result.recall).toFixed(1)}%, onset F1 ${(100 * result.f1).toFixed(1)}%`
    );
  }
  const tp = report.tracks.reduce((sum, r) => sum + r.truePositive, 0);
  const fp = report.tracks.reduce((sum, r) => sum + r.falsePositive, 0);
  const fn = report.tracks.reduce((sum, r) => sum + r.falseNegative, 0);
  report.aggregate = {
    truePositive: tp,
    falsePositive: fp,
    falseNegative: fn,
    precision: tp / (tp + fp),
    recall: tp / (tp + fn),
    f1: (2 * tp) / (2 * tp + fp + fn),
  };
  console.log('Aggregate', report.aggregate);
} finally {
  await session.release();
}
writeFileSync(`${dir}/qualification.json`, JSON.stringify(report, null, 2) + '\n');
// Report all outcomes. There is deliberately no tuned pass threshold that hides weak examples.
