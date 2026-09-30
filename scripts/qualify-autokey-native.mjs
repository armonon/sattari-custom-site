import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { analyzeAutoKey } from '../src/utils/sattariAutoKey.js';
import { wavBytes } from '../src/utils/arrangementExport.js';

const native = process.env.AUTO_KEY_NATIVE_RENDER;
if (!native) throw new Error('Set AUTO_KEY_NATIVE_RENDER to the suite SongKeyRender executable.');
const scratch = await mkdtemp(join(tmpdir(), 'sattari-autokey-parity-'));
const rate = 44100;
function run(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 16 * 1024 * 1024, timeout: 120000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
function compare(name, file, left, right = left) {
  const web = analyzeAutoKey(left, right, rate);
  const output = run(native, ['--analyse-file', file]).toString();
  const match = output.match(/^(.*?) \| margin ([\d.]+) \| alternate (.*?) \|/m);
  assert(match, output);
  assert.equal(web.key, match[1], name);
  assert.equal(web.alternative.key, match[3], name);
  // The native command reports margins rounded to three decimal places.
  assert(
    Math.abs(web.confidence - Number(match[2])) < 0.0006,
    `${name}: ${web.confidence} vs ${match[2]}`
  );
  console.log(
    `PASS ${name}: ${web.key}, alternative ${web.alternative.key}, margin ${web.confidence.toFixed(3)}`
  );
}
try {
  for (const [root, minor] of [
    [60, false],
    [57, true],
    [62, false],
  ]) {
    const audio = Float32Array.from({ length: rate * 8 }, (_, i) =>
      [0, minor ? 3 : 4, 7].reduce(
        (sum, interval) =>
          sum +
          0.15 * Math.sin((2 * Math.PI * 440 * 2 ** ((root + interval - 69) / 12) * i) / rate),
        0
      )
    );
    const file = join(scratch, `triad-${root}-${minor}.wav`);
    await writeFile(
      file,
      wavBytes(
        {
          numberOfChannels: 1,
          length: audio.length,
          sampleRate: rate,
          getChannelData: () => audio,
        },
        true
      )
    );
    compare(`triad ${root} ${minor ? 'minor' : 'major'}`, file, audio);
  }
  const demo = resolve('public/audio/sattari-practice-demo.wav');
  const bytes = run('ffmpeg', [
    '-v',
    'error',
    '-i',
    demo,
    '-ar',
    String(rate),
    '-ac',
    '2',
    '-f',
    'f32le',
    'pipe:1',
  ]);
  const left = new Float32Array(bytes.length / 8),
    right = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    left[i] = bytes.readFloatLE(i * 8);
    right[i] = bytes.readFloatLE(i * 8 + 4);
  }
  compare('bundled practice demo', demo, left, right);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
