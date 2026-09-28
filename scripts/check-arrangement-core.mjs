// Fast, single-process checks for environments too loaded to start test workers.
// These complement Vitest and native-audio QA; they do not certify browser audio.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SourceTextModule, createContext, runInContext } from 'node:vm';
const root = new URL('../src/utils/', import.meta.url);
const scope = createContext({
  TextDecoder,
  TextEncoder,
  Uint8Array,
  DataView,
  Float32Array,
  Math,
  crypto: globalThis.crypto,
  structuredClone,
});
const effects = new SourceTextModule(
  await readFile(new URL('arrangementEffects.js', root), 'utf8'),
  { context: scope }
);
await effects.link(() => {
  throw new Error('Unexpected effects dependency');
});
await effects.evaluate();
const model = new SourceTextModule(await readFile(new URL('arrangementModel.js', root), 'utf8'), {
  context: scope,
});
await model.link((name) => {
  assert.equal(name, './arrangementEffects');
  return effects;
});
await model.evaluate();
const midi = new SourceTextModule(await readFile(new URL('arrangementMidi.js', root), 'utf8'), {
  context: scope,
});
await midi.link((name) => {
  assert.equal(name, './arrangementModel');
  return model;
});
await midi.evaluate();
const { audioTrack, audioClip, emptyArrangement, compRegion, validateArrangement } =
  model.namespace;
const a = audioTrack('A'),
  b = audioTrack('B');
a.clips.push(audioClip('a', 'A', 10));
b.clips.push(audioClip('b', 'B', 10));
const project = { ...emptyArrangement(), tracks: [a, b] };
const comp = compRegion(compRegion(project, a.id, 0, 10), b.id, 3, 5);
validateArrangement(comp);
assert.equal(
  JSON.stringify(
    comp.tracks
      .find((row) => row.compLane)
      .clips.map((clip) => [clip.assetId, clip.start, clip.duration, clip.offset])
  ),
  JSON.stringify([
    ['a', 0, 3, 0],
    ['b', 3, 2, 3],
    ['a', 5, 5, 5],
  ])
);
const capture = new midi.namespace.MidiNoteCapture();
capture.message([144, 60, 127], 0);
capture.message([176, 64, 127], 0.1);
capture.message([128, 60, 0], 0.2);
capture.message([176, 64, 0], 0.8);
assert.equal(capture.stop(1)[0].duration, 0.8);
const events = [0, 144, 60, 100, 0, 64, 80, 131, 96, 128, 60, 0, 0, 64, 0, 0, 255, 47, 0];
const bytes = new Uint8Array([
  ...new TextEncoder().encode('MThd'),
  0,
  0,
  0,
  6,
  0,
  0,
  0,
  1,
  1,
  224,
  ...new TextEncoder().encode('MTrk'),
  0,
  0,
  0,
  events.length,
  ...events,
]);
const imported = midi.namespace.importMidi(bytes, { bpm: 120 });
assert.equal(imported.tracks[0].clips[0].notes.length, 2);
assert.equal(imported.tracks[0].clips[0].notes[1].duration, 0.5);
assert.throws(() => midi.namespace.importMidi(bytes.slice(0, 20)), /Truncated/);

const messages = [];
let Processor;
const audio = createContext({
  Float32Array,
  Array,
  Math,
  sampleRate: 128,
  currentFrame: 0,
  AudioWorkletProcessor: class {
    constructor() {
      this.port = { postMessage: (message) => messages.push(message) };
    }
  },
  registerProcessor: (_, Class) => {
    Processor = Class;
  },
});
runInContext(await readFile(new URL('sourceCapture.worklet.js', root), 'utf8'), audio);
const processor = new Processor({ processorOptions: { count: 2, startFrame: 128 } });
const input = [
  [new Float32Array(128).fill(0.5)],
  [new Float32Array(128).fill(0.25), new Float32Array(128).fill(-0.25)],
];
for (let frame = 0; frame < 7; frame++) {
  audio.currentFrame = frame * 128;
  processor.process(input, [[new Float32Array(128)]]);
}
processor.port.onmessage({ data: 'stop' });
const chunks = messages.filter((message) => message.channels);
assert.equal(chunks.length, 2);
assert.equal(chunks[0].length, 640);
assert.equal(chunks[1].start, 640);
assert.equal(chunks[1].length, 128);
assert.equal(chunks[0].channels[0][1][0], 0.5);
assert.equal(chunks[1].channels[1][1][127], -0.25);
assert.equal(messages.find((message) => message.done).frames, 768);
assert.equal(messages.find((message) => message.startedAt != null).startedAt, 1);
messages.length = 0;
const stalled = new Processor({ processorOptions: { count: 2, startFrame: 0 } });
for (let frame = 0; frame < 20; frame++) {
  audio.currentFrame = frame * 128;
  if (!stalled.process(input, [[new Float32Array(128)]])) break;
}
assert.equal(messages.filter((message) => message.channels).length, 2);
assert.ok(messages.some((message) => message.error));
console.log(
  'PASS: comp region preservation, MIDI file timing, sustain capture, malformed-file rejection, shared source clock, chunk rollover, stereo/mono capture.'
);
