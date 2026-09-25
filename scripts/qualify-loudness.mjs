// Independently generated signals from the numerical descriptions in EBU Tech
// 3341/3342. No EBU audio files are downloaded, copied or distributed.
// This is a scoped conformance check, not certification or the official corpus.
import { ProgrammeMeter } from '../src/utils/loudnessDSP.js';
const results = [];
function check(id, rate, actual, expected, tolerance = 0.1) {
  const low = typeof tolerance === 'number' ? tolerance : tolerance[0];
  const high = typeof tolerance === 'number' ? tolerance : tolerance[1];
  results.push({
    id,
    sampleRate: rate,
    actual,
    expected,
    lowerTolerance: low,
    upperTolerance: high,
    pass: Number.isFinite(actual) && actual >= expected - low && actual <= expected + high,
  });
}
function feed(meter, seconds, db, { hz = 1000, phase = 0, taper = false } = {}) {
  const rate = meter.rate,
    frames = Math.round(seconds * rate),
    amplitude = 10 ** (db / 20);
  const block = new Float32Array(128);
  for (let at = 0; at < frames; at += block.length) {
    const count = Math.min(block.length, frames - at);
    for (let i = 0; i < count; i++) {
      const frame = at + i;
      const envelope = taper
        ? Math.min(1, frame / (rate * 0.01), (frames - frame - 1) / (rate * 0.01))
        : 1;
      block[i] = amplitude * envelope * Math.sin((2 * Math.PI * hz * frame) / rate + phase);
    }
    const chunk = count === 128 ? block : block.subarray(0, count);
    meter.process(chunk, chunk);
  }
  return meter.snapshot();
}
const rates = process.argv.slice(2).length
  ? process.argv.slice(2).map(Number)
  : [44100, 48000, 96000];
for (const rate of rates) {
  for (const [id, db] of [
    [1, -23],
    [2, -33],
  ]) {
    const meter = new ProgrammeMeter(rate);
    feed(meter, 20, db);
    for (const key of ['momentary', 'shortTerm', 'integrated'])
      check(`3341-${id}-${key}`, rate, meter.snapshot()[key], db);
  }
  const sequences = [
    [
      3,
      [
        [10, -36],
        [60, -23],
        [10, -36],
      ],
    ],
    [
      4,
      [
        [10, -72],
        [10, -36],
        [60, -23],
        [10, -36],
        [10, -72],
      ],
    ],
    [
      5,
      [
        [20, -26],
        [20.1, -20],
        [20, -26],
      ],
    ],
  ];
  for (const [id, segments] of sequences) {
    const meter = new ProgrammeMeter(rate);
    for (const [seconds, db] of segments) feed(meter, seconds, db);
    check(`3341-${id}-integrated`, rate, meter.snapshot().integrated, -23);
  }
  for (const [id, count, a, b, key] of [
    [9, 5, 1.34, 1.66, 'shortTerm'],
    [12, 25, 0.18, 0.22, 'momentary'],
  ]) {
    const meter = new ProgrammeMeter(rate);
    for (let i = 0; i < count; i++) {
      feed(meter, a, -20);
      feed(meter, b, -30);
    }
    check(`3341-${id}-${key}`, rate, meter.snapshot()[key], -23);
  }
  // Worst-case offsets for maximum hold: M must not miss a 400 ms window
  // positioned between the UI's 100 ms display updates.
  for (const [id, length, spacing, tail, key] of [
    [10, 3, 0.15, 1, 'maxShortTerm'],
    [13, 0.4, 0.02, 1, 'maxMomentary'],
  ]) {
    for (let i = 0; i < 20; i++) {
      const meter = new ProgrammeMeter(rate);
      feed(meter, i * spacing, -Infinity);
      feed(meter, length, -23);
      feed(meter, tail, -Infinity);
      check(`3341-${id}-offset-${i}`, rate, meter.snapshot()[key], -23);
    }
  }
  for (const [id, length, spacing, key] of [
    [11, 3, 0.15, 'maxShortTerm'],
    [14, 0.4, 0.02, 'maxMomentary'],
  ]) {
    const meter = new ProgrammeMeter(rate);
    for (let i = 0; i < 20; i++) {
      feed(meter, i * spacing, -Infinity);
      feed(meter, length, -38 + i);
      feed(meter, length - i * spacing, -Infinity);
      check(`3341-${id}-step-${i}`, rate, meter.snapshot()[key], -38 + i);
    }
  }
  for (const [id, divisor, phase, amplitude, expected] of [
    [15, 4, 0, 0.5, -6],
    [16, 4, 45, 0.5, -6],
    [17, 6, 60, 0.5, -6],
    [18, 8, 67.5, 0.5, -6],
    [19, 4, 45, 1.41, 3],
  ]) {
    const meter = new ProgrammeMeter(rate);
    feed(meter, 0.5, 20 * Math.log10(amplitude), {
      hz: rate / divisor,
      phase: (phase * Math.PI) / 180,
      taper: true,
    });
    feed(meter, 0.01, -Infinity);
    check(`3341-${id}-true-peak`, rate, meter.snapshot().truePeak, expected, [0.4, 0.2]);
  }
  for (const [id, levels, expected] of [
    [1, [-20, -30], 10],
    [2, [-20, -15], 5],
    [3, [-40, -20], 20],
    [4, [-50, -35, -20, -35, -50], 15],
  ]) {
    const meter = new ProgrammeMeter(rate);
    for (const db of levels) feed(meter, 20, db);
    feed(meter, 1.5, -Infinity);
    check(`3342-${id}-range`, rate, meter.snapshot().loudnessRange, expected, 1);
  }
}
const failed = results.filter((row) => !row.pass);
console.log(
  JSON.stringify(
    {
      scope: 'Independently synthesized stereo tests; not EBU certification',
      references: [
        'https://tech.ebu.ch/docs/tech/tech3341.pdf',
        'https://tech.ebu.ch/docs/tech/tech3342.pdf',
      ],
      passed: results.length - failed.length,
      failed: failed.length,
      excluded: [
        'Multichannel test 3341-6 (stereo engine)',
        'Authentic programme files 3341-7/8 and 3342-5/6 (licensed corpus required)',
        '3341-20/23 anti-aliased transient corpus',
        'Full ITU BS.2217 qualification',
        'Independent certification',
      ],
      results,
    },
    null,
    2
  )
);
process.exitCode = failed.length ? 1 : 0;
