import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { trackTempo } from '../src/utils/tempoMap.js';
import { qualifyBeatMap } from '../src/utils/beatQualification.js';
const rate = 8000;
function musicalFixture({
  bpm = 120,
  acceleration = 0,
  intro = 0,
  breakdown = false,
  syncopated = false,
}) {
  const seconds = 44,
    samples = new Float32Array(rate * seconds),
    beats = [];
  let seed = 717;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  const hit = (time, kind, level = 1) => {
    const length = Math.round(rate * (kind === 'hat' ? 0.03 : 0.15));
    for (let i = 0; i < length; i++) {
      const at = Math.round(time * rate) + i;
      if (at >= samples.length) break;
      const t = i / rate,
        decay = Math.exp(-t * (kind === 'hat' ? 110 : 28));
      samples[at] +=
        level *
        decay *
        (kind === 'kick'
          ? Math.sin(2 * Math.PI * (55 * t + 0.3 * (1 - Math.exp(-40 * t))))
          : noise());
    }
  };
  let index = 0;
  for (let time = 0.2; time < seconds - 0.3; time += 60 / (bpm + acceleration * time)) {
    beats.push(time);
    const period = 60 / (bpm + acceleration * time);
    if (time >= intro && !(breakdown && time > 16 && time < 22)) {
      hit(time, 'kick', syncopated && index % 4 === 2 ? 0.25 : 0.7);
      if (index % 2) hit(time, 'snare', 0.3);
      hit(time + period / 2, 'hat', 0.06);
      if (syncopated && index % 4 === 3) hit(time + period * 0.75, 'kick', 0.3);
    }
    index++;
  }
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    samples[i] +=
      0.018 *
      Math.min(1, t / 4) *
      (Math.sin(2 * Math.PI * 130.81 * t) + 0.5 * Math.sin(2 * Math.PI * 196 * t));
  }
  return { samples, beats };
}
const fixtures = [
  ['steady-90', { bpm: 90 }],
  ['steady-120', { bpm: 120 }],
  ['steady-150', { bpm: 150 }],
  ['accelerando', { bpm: 100, acceleration: 0.6 }],
  ['ambient-intro', { bpm: 120, intro: 6 }],
  ['breakdown', { bpm: 120, breakdown: true }],
  ['syncopated', { bpm: 110, syncopated: true }],
];
const results = [];
for (const [name, options] of fixtures) {
  const fixture = musicalFixture(options),
    map = trackTempo(fixture.samples, rate);
  const metrics = qualifyBeatMap(map.beats, fixture.beats);
  results.push({
    name,
    kind: 'generated-musical-fixture',
    ...metrics,
    confidence: map.confidence,
    pass: metrics.f1 >= 0.85,
  });
}
// Optional private corpus: no upload or copying into the repository. Manifest is
// { tracks:[{name, file:"/absolute/audio.wav", beats:[seconds...], minF1:0.85}] }.
// Authoritative beat annotations must come from listening/manual review.
if (process.argv[2]) {
  const corpus = JSON.parse(await readFile(process.argv[2], 'utf8'));
  for (const track of corpus.tracks || []) {
    if (!track.file?.startsWith('/')) throw Error('Corpus audio paths must be absolute.');
    const decoded = spawnSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        track.file,
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(rate),
        '-f',
        'f32le',
        'pipe:1',
      ],
      { maxBuffer: 128 * 1048576 }
    );
    if (decoded.status !== 0)
      throw Error(`Cannot decode ${track.name}: ${decoded.stderr?.toString()}`);
    const bytes = Buffer.from(decoded.stdout);
    const samples = new Float32Array(bytes.length / 4);
    for (let i = 0; i < samples.length; i++) samples[i] = bytes.readFloatLE(i * 4);
    const map = trackTempo(samples, rate),
      metrics = qualifyBeatMap(map.beats, track.beats);
    results.push({
      name: track.name,
      kind: 'locally-annotated-recording',
      ...metrics,
      confidence: map.confidence,
      pass: metrics.f1 >= (track.minF1 ?? 0.85),
    });
  }
}
console.log(
  JSON.stringify(
    {
      scope:
        'Strict beat timing at 70 ms tolerance; generated fixtures are not real-music qualification',
      passed: results.filter((r) => r.pass).length,
      failed: results.filter((r) => !r.pass).length,
      results,
    },
    null,
    2
  )
);
process.exitCode = results.some((r) => !r.pass) ? 1 : 0;
