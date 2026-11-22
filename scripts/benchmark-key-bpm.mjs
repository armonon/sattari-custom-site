// Key & BPM accuracy benchmark.
//
//   node scripts/benchmark-key-bpm.mjs                     # built-in sets
//   KEYBPM_BENCH_MANIFEST=path/to/manifest.json node scripts/benchmark-key-bpm.mjs
//
// Runs the exact analysis the Key & BPM worker runs (safeAnalyzeStemAudio +
// roughTempo + resultRow) on labelled audio and scores it:
//   key: exact, and the MIREX weighted score (fifth 0.5, relative 0.3,
//        parallel 0.2), split by the evidence label the UI shows;
//   tempo: Acc1 (within 4%) and Acc2 (also allowing x2, x1/2, x3, x1/3).
//
// Built-in sets: "synthetic" (generated here, labels known by construction)
// and "sattari-lessons" (the site's own original lesson recordings with their
// authored key/BPM, plus the practice demo). Neither is a real-world genre
// benchmark. A manifest adds your own licensed, labelled songs:
//   { "name": "...", "license": "...", "tracks": [
//       { "file": "song.mp3", "key": "A minor", "bpm": 92, "genre": "rock" } ] }
// Files are decoded with FFmpeg. Results: docs/qualification/key-bpm-benchmark-*.{json,md}.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 44100;
const server = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
const load = (path) => server.ssrLoadModule(path);
const { safeAnalyzeStemAudio } = await load('/src/utils/stemMusicalAnalysis.js');
const { roughTempo, resultRow, keyParts } = await load('/src/labs/keybpm/keyBpm.js');
const { keyScore, tempoScore } = await load('/src/labs/keybpm/benchmarkScore.js');
const { CLASSICS } = await load('/src/loop/catalog.js');
const { FOUNDATION_LESSONS } = await load('/src/loop/courseCatalog.js');
const { DEMO } = await load('/src/loop/music.js');

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function decode(path) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-'],
    { maxBuffer: 1024 ** 3 }
  );
  const all = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const frames = all.length / 2;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = all[i * 2];
    right[i] = all[i * 2 + 1];
  }
  return { left, right };
}

// ---- synthetic songs: chords, bass and drums with known key and tempo ----
function synth(keyName, bpm, seconds = 20, seed = 1) {
  const { root, minor } = keyParts(keyName);
  const frames = seconds * RATE;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let random = seed;
  const noise = () => ((random = (random * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const beat = 60 / bpm;
  // I–vi–IV–V (major) or i–VI–iv–V (minor, harmonic V), one chord per bar.
  const scale = minor ? [0, 2, 3, 5, 7, 8, 11] : [0, 2, 4, 5, 7, 9, 11];
  const degrees = minor ? [0, 5, 3, 4] : [0, 5, 3, 4];
  const chordTones = (degree) =>
    [0, 2, 4].map((step) => {
      const index = degree + step;
      return scale[index % 7] + 12 * Math.floor(index / 7);
    });
  const add = (start, length, fn, pan = 0) => {
    const from = Math.floor(start * RATE);
    const to = Math.min(frames, Math.floor((start + length) * RATE));
    for (let i = from; i < to; i++) {
      const value = fn((i - from) / RATE);
      left[i] += value * (1 - pan);
      right[i] += value * (1 + pan);
    }
  };
  const tone =
    (midi, amp, harmonics = 4) =>
    (t) => {
      const f = 440 * 2 ** ((midi - 69) / 12);
      let v = 0;
      for (let h = 1; h <= harmonics; h++) v += Math.sin(2 * Math.PI * f * h * t) / h;
      return v * amp;
    };
  const bars = Math.floor(seconds / (beat * 4));
  for (let bar = 0; bar < bars; bar++) {
    const degree = degrees[bar % 4];
    const tones = chordTones(degree);
    const start = bar * beat * 4;
    for (const interval of tones) {
      const pad = tone(60 + root + interval, 0.05);
      add(start, beat * 4, (t) => pad(t) * Math.min(1, t * 20) * Math.exp(-t * 0.3), 0.2);
    }
    for (let b = 0; b < 4; b++) {
      const at = start + b * beat;
      const bass = tone(36 + root + tones[0], 0.18, 3);
      add(at, beat * 0.9, (t) => bass(t) * Math.exp(-t * 3), -0.1);
      if (b % 2 === 0)
        add(
          at,
          0.25,
          (t) => Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-t * 30)) * t) * 0.5 * Math.exp(-t * 14)
        );
      else add(at, 0.2, (t) => noise() * 0.25 * Math.exp(-t * 18), 0);
      for (let e = 0; e < 2; e++)
        add(at + (e * beat) / 2, 0.05, (t) => noise() * 0.06 * Math.exp(-t * 60), 0.3);
    }
  }
  return { left, right };
}

function syntheticSet() {
  const tempos = [72, 90, 100, 120, 128, 140, 160, 174];
  const keys = [...NOTES.map((n) => `${n} major`), ...NOTES.map((n) => `${n} minor`)];
  return keys.map((key, i) => ({
    id: `synthetic-${key.replace(/[ #]/g, (c) => (c === '#' ? 's' : '-'))}-${tempos[i % tempos.length]}`,
    key,
    bpm: tempos[i % tempos.length],
    audio: () => synth(key, tempos[i % tempos.length], 20, i + 1),
  }));
}

function lessonSet() {
  const lessons = [...CLASSICS, ...FOUNDATION_LESSONS, DEMO].filter((lesson) => lesson.audioUrl);
  const tracks = lessons.map((lesson) => ({
    id: lesson.id,
    key: lesson.key,
    bpm: lesson.bpm,
    audio: () => decode(resolve(root, 'public', lesson.audioUrl.slice(1))),
  }));
  tracks.push({
    id: 'sattari-practice-demo',
    key: 'A minor',
    bpm: 120,
    audio: () => decode(resolve(root, 'public/audio/sattari-practice-demo.wav')),
  });
  return tracks;
}

async function manifestSet(path) {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const base = dirname(resolve(path));
  return {
    name: manifest.name || 'manifest',
    license: manifest.license || 'not stated',
    tracks: manifest.tracks.map((track, i) => ({
      id: track.id || `${i + 1}`,
      key: track.key ?? null,
      bpm: track.bpm ?? null,
      genre: track.genre || null,
      audio: () => decode(resolve(base, track.file)),
    })),
  };
}

async function run(set) {
  const rows = [];
  for (const track of set.tracks) {
    const { left, right } = track.audio();
    const analysis = safeAnalyzeStemAudio(left, right, RATE, { channels: 2 });
    const rough =
      analysis.status === 'ready' &&
      analysis.bpm === null &&
      ['variable', 'no-pulse'].includes(analysis.tempoReason)
        ? roughTempo(left, right, RATE)
        : null;
    const result = resultRow(track.id, analysis, rough);
    const key = track.key ? keyScore(track.key, result.key || '') : null;
    const tempo = track.bpm ? tempoScore(track.bpm, result.bpm) : null;
    rows.push({
      id: track.id,
      genre: track.genre || null,
      truth: { key: track.key, bpm: track.bpm },
      estimate: {
        key: result.key || null,
        keyEvidence: result.keyEvidence || null,
        keyMargin: result.keyConfidence ?? null,
        alternative: result.alternative || null,
        bpm: result.bpm ?? null,
        tempoEvidence: result.tempoEvidence || null,
      },
      key,
      tempo,
    });
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return rows;
}

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');
function summarize(name, rows) {
  const keyed = rows.filter((row) => row.key);
  const timed = rows.filter((row) => row.tempo);
  const byEvidence = {};
  for (const row of keyed) {
    const label = row.estimate.keyEvidence || 'none';
    byEvidence[label] ||= { n: 0, exact: 0, weighted: 0 };
    byEvidence[label].n++;
    byEvidence[label].exact += row.key.relation === 'exact' ? 1 : 0;
    byEvidence[label].weighted += row.key.score;
  }
  const relations = (list, field) =>
    list.reduce(
      (acc, row) => ({ ...acc, [row[field].relation]: (acc[row[field].relation] || 0) + 1 }),
      {}
    );
  return {
    name,
    tracks: rows.length,
    key: {
      n: keyed.length,
      exact: keyed.filter((row) => row.key.relation === 'exact').length,
      weighted: keyed.reduce((sum, row) => sum + row.key.score, 0),
      relations: relations(keyed, 'key'),
      byEvidence,
    },
    tempo: {
      n: timed.length,
      acc1: timed.filter((row) => row.tempo.acc1).length,
      acc2: timed.filter((row) => row.tempo.acc2).length,
      relations: relations(timed, 'tempo'),
    },
  };
}

function markdown(results, meta) {
  const lines = [
    `# Key & BPM benchmark (${meta.date})`,
    '',
    `Commit \`${meta.commit}\`. Engine: the Key & BPM worker path (Sattari AutoKey + site tempo tracker, rough fallback). Node ${process.version}, FFmpeg decode at 44.1 kHz.`,
    '',
    '**Scope:** these sets have labels known by construction or authored with the audio. They are small and not representative of commercial music across genres, so they do not establish real-world accuracy. Add a licensed labelled set with `KEYBPM_BENCH_MANIFEST`.',
    '',
    '| Set | Tracks | Key exact | Key weighted (MIREX) | Tempo Acc1 (±4%) | Tempo Acc2 (incl. ×2, ×½, ×3, ×⅓) |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const { summary } of results)
    lines.push(
      `| ${summary.name} | ${summary.tracks} | ${pct(summary.key.exact, summary.key.n)} | ${pct(summary.key.weighted, summary.key.n)} | ${pct(summary.tempo.acc1, summary.tempo.n)} | ${pct(summary.tempo.acc2, summary.tempo.n)} |`
    );
  lines.push('', '## Does the "tentative" label mean anything?', '');
  lines.push(
    '| Set | Evidence label | Tracks | Exact | Weighted |',
    '| --- | --- | --- | --- | --- |'
  );
  for (const { summary } of results)
    for (const [label, value] of Object.entries(summary.key.byEvidence))
      lines.push(
        `| ${summary.name} | ${label} | ${value.n} | ${pct(value.exact, value.n)} | ${pct(value.weighted, value.n)} |`
      );
  lines.push('', '## Error types', '');
  for (const { summary } of results)
    lines.push(
      `- **${summary.name}**: key ${JSON.stringify(summary.key.relations)}; tempo ${JSON.stringify(summary.tempo.relations)}`
    );
  lines.push('', '## Misses', '');
  for (const { summary, rows } of results)
    for (const row of rows.filter(
      (r) => (r.key && r.key.relation !== 'exact') || (r.tempo && !r.tempo.acc1)
    ))
      lines.push(
        `- ${summary.name} / ${row.id}: key ${row.truth.key} → ${row.estimate.key || 'none'} (${row.estimate.keyEvidence}, margin ${row.estimate.keyMargin ?? '—'}); BPM ${row.truth.bpm} → ${row.estimate.bpm ?? 'none'} (${row.estimate.tempoEvidence})`
      );
  return `${lines.join('\n')}\n`;
}

const sets = [
  { name: 'synthetic', license: 'generated by this script', tracks: syntheticSet() },
  {
    name: 'sattari-lessons',
    license: 'Sattari original recordings in public/audio',
    tracks: lessonSet(),
  },
];
if (process.env.KEYBPM_BENCH_MANIFEST)
  sets.push(await manifestSet(process.env.KEYBPM_BENCH_MANIFEST));
const results = [];
for (const set of sets) {
  console.log(`Set ${set.name}: ${set.tracks.length} tracks`);
  const rows = await run(set);
  results.push({ summary: summarize(set.name, rows), license: set.license, rows });
}
await server.close();
const meta = {
  date: new Date().toISOString().slice(0, 10),
  commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
};
const outDir = resolve(root, process.env.KEYBPM_BENCH_OUT || 'docs/qualification');
await mkdir(outDir, { recursive: true });
await writeFile(
  resolve(outDir, `key-bpm-benchmark-${meta.date}.json`),
  JSON.stringify({ meta, results }, null, 2)
);
await writeFile(resolve(outDir, `key-bpm-benchmark-${meta.date}.md`), markdown(results, meta));
for (const { summary } of results)
  console.log(
    `${summary.name}: key exact ${pct(summary.key.exact, summary.key.n)}, weighted ${pct(summary.key.weighted, summary.key.n)}; tempo Acc1 ${pct(summary.tempo.acc1, summary.tempo.n)}, Acc2 ${pct(summary.tempo.acc2, summary.tempo.n)}`
  );
