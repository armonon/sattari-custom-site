// Actual UI/worker/decoder with deterministic generated PCM; no physical inputs/uploads.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as playwright from 'playwright';
import { wavBytes } from '../src/utils/arrangementExport.js';
const base = process.env.KEYBPM_URL || 'http://127.0.0.1:4292';
const origin = new URL(base);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))
  throw Error('Local isolated origin required');
const out = resolve(process.env.KEYBPM_QA_DIR || '/tmp/key-bpm-qa');
await mkdir(out, { recursive: true });
const engine = process.env.KEYBPM_BROWSER || 'chromium';
const report = {
  at: new Date().toISOString(),
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  engine,
  pass: false,
  scope:
    'Generated-fixture browser workflow; not labelled-music accuracy or physical mobile qualification',
  checks: [],
  errors: [],
};
const rate = 44100;
function fixture(name, root, minor, bpm, seconds = 14) {
  const samples = new Float32Array(seconds * rate);
  if (root !== null) {
    const notes = [root, root + (minor ? 3 : 4), root + 7];
    for (let i = 0; i < samples.length; i++)
      samples[i] = notes.reduce(
        (sum, n) => sum + 0.1 * Math.sin((2 * Math.PI * 440 * 2 ** ((n - 69) / 12) * i) / rate),
        0
      );
    for (let t = 0.2; t < seconds; t += 60 / bpm)
      for (let i = 0; i < 2000; i++) {
        const at = Math.floor(t * rate) + i;
        if (at < samples.length) samples[at] += 0.8 * Math.exp(-i / 240) * Math.sin(i * 0.225);
      }
  }
  const buffer = Buffer.from(
    wavBytes({
      sampleRate: rate,
      length: samples.length,
      numberOfChannels: 1,
      getChannelData: () => samples,
    })
  );
  return { name, mimeType: 'audio/wav', buffer };
}
const fixtures = [
  fixture('C major 120.wav', 60, false, 120),
  fixture('A minor 100.wav', 57, true, 100),
  fixture('silence.wav', null, false, 0, 4),
];
report.fixtures = fixtures.map((f) => ({
  name: f.name,
  bytes: f.buffer.length,
  sha256: createHash('sha256').update(f.buffer).digest('hex'),
  provenance: 'Original deterministic synthesis in this script',
}));
const browser = await playwright[engine].launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE && engine === 'chromium'
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
    : {}),
  ...(engine === 'chromium' ? { args: ['--mute-audio'] } : {}),
});
report.browserVersion = browser.version();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(base + '/studio/keybpm');
  await page.getByRole('heading', { level: 1, name: /Key & BPM/ }).waitFor();
  const started = Date.now();
  await page.getByLabel('Add tracks', { exact: true }).setInputFiles(fixtures);
  await page.waitForFunction(
    () =>
      document.querySelectorAll('tbody tr[data-status="done"],tbody tr[data-status="error"]')
        .length === 3,
    {},
    { timeout: 180000 }
  );
  const rows = await page
    .locator('tbody tr')
    .evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll('th,td')].map((cell) => cell.textContent.trim()))
    );
  assert.match(rows[0][2], /^C major/);
  assert.equal(rows[0][3], '8B');
  assert.match(rows[0][4], /^120/);
  assert.match(rows[1][2], /^A minor/);
  assert.equal(rows[1][3], '8A');
  assert.match(rows[1][4], /^100/);
  assert.equal(rows[2][2], '—');
  assert.equal(rows[2][4], '—');
  report.checks.push({
    name: 'Import -> actual decoder/worker -> key/Camelot/tempo and silence refusal',
    pass: true,
    rows,
    elapsedMs: Date.now() - started,
  });
  await page.getByRole('combobox', { name: /Sort/ }).selectOption('bpm');
  assert.match(await page.locator('tbody tr').first().innerText(), /A minor 100/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), 'utf8');
  assert.match(csv, /"C major 120.wav","14.0","C major","8B"/);
  assert.equal(csv.trim().split('\r\n').length, 4);
  await writeFile(resolve(out, engine + '-results.csv'), csv);
  report.checks.push({
    name: 'Sort and real CSV download/readback',
    pass: true,
    bytes: Buffer.byteLength(csv),
  });
  await page.getByLabel('Add tracks', { exact: true }).setInputFiles({
    name: 'malformed.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('not audio'),
  });
  await page.locator('tbody tr[data-status="error"]').waitFor();
  assert.match(
    await page.locator('tbody tr[data-status="error"]').innerText(),
    /could not be decoded/
  );
  report.checks.push({
    name: 'Malformed input fails clearly without dropping completed results',
    pass: true,
  });
  const reportReady = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  const saved = await reportReady,
    savedPath = resolve(out, `${engine}-saved.keybpm.json`);
  await saved.saveAs(savedPath);
  const beforeReport = JSON.parse(await readFile(savedPath, 'utf8'));
  assert.equal(beforeReport.tracks.length, 4);
  // A fresh browser context has no old page state/storage; use the actual file picker.
  const reopenedContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const reopened = await reopenedContext.newPage();
  await reopened.goto(base + '/studio/keybpm');
  await reopened.getByLabel('Open analysis report', { exact: true }).setInputFiles(savedPath);
  await reopened.waitForFunction(() => document.querySelectorAll('tbody tr').length === 4);
  assert.equal(await reopened.getByText('Report · audio not included', { exact: true }).count(), 4);
  const reexportReady = reopened.waitForEvent('download');
  await reopened.getByRole('button', { name: 'Save report', exact: true }).click();
  const reexport = await reexportReady,
    reexported = JSON.parse(await readFile(await reexport.path(), 'utf8'));
  assert.deepEqual(reexported.tracks, beforeReport.tracks);
  const previousText = await reopened.locator('tbody').innerText();
  await reopened.getByLabel('Open analysis report', { exact: true }).setInputFiles({
    name: 'broken.keybpm.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  });
  await reopened.getByRole('alert').filter({ hasText: 'Invalid or unsupported' }).waitFor();
  assert.equal(await reopened.locator('tbody').innerText(), previousText);
  await reopened.getByLabel('Open analysis report', { exact: true }).setInputFiles({
    name: 'oversized.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await reopened.getByRole('alert').filter({ hasText: '2 MB' }).waitFor();
  assert.equal(await reopened.locator('tbody').innerText(), previousText);
  await reopenedContext.close();
  report.checks.push({
    name: 'Save real report -> fresh context -> reopen -> exact measurements/confidence/time -> reexport; malformed/oversized imports atomic',
    pass: true,
  });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByLabel('Add tracks', { exact: true }).setInputFiles([
    { ...fixtures[0], name: 'same-name.wav' },
    { ...fixtures[1], name: 'same-name.wav' },
  ]);
  await page.waitForFunction(
    () => document.querySelectorAll('tbody tr[data-status="done"]').length === 2,
    null,
    { timeout: 30000 }
  );
  assert.equal(
    await page.locator('tbody tr').count(),
    2,
    'Distinct audio with same name/size was discarded as duplicate'
  );
  report.checks.push({
    name: 'Different audio files sharing filename/byte length both analyzed',
    pass: true,
  });
  // A byte-identical repeat is rejected, but genuine same-name content survives.
  await page
    .getByLabel('Add tracks', { exact: true })
    .setInputFiles({ ...fixtures[0], name: 'same-name.wav' });
  await page.getByRole('alert').filter({ hasText: 'identical audio' }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 2);
  if (process.env.KEYBPM_EXTENDED === '1') {
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    const silenceWav = (seconds) => {
      const frames = seconds * 8000,
        buffer = Buffer.alloc(44 + frames * 2);
      buffer.write('RIFF');
      buffer.writeUInt32LE(buffer.length - 8, 4);
      buffer.write('WAVEfmt ', 8);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(1, 22);
      buffer.writeUInt32LE(8000, 24);
      buffer.writeUInt32LE(16000, 28);
      buffer.writeUInt16LE(2, 32);
      buffer.writeUInt16LE(16, 34);
      buffer.write('data', 36);
      buffer.writeUInt32LE(frames * 2, 40);
      return { name: `${seconds}-seconds.wav`, mimeType: 'audio/wav', buffer };
    };
    await page
      .getByLabel('Add tracks', { exact: true })
      .setInputFiles([silenceWav(600), silenceWav(601)]);
    await page.locator('tbody tr[data-status="error"]').waitFor({ timeout: 180000 });
    assert.equal(await page.locator('tbody tr[data-status="done"]').count(), 1);
    assert.match(await page.locator('tbody tr[data-status="error"]').innerText(), /10 minutes/);
    report.checks.push({
      name: '600-second boundary accepted;601-second file rejected by actual decoder',
      pass: true,
    });
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    const short = fixture('queue.wav', 60, false, 120, 4);
    await page
      .getByLabel('Add tracks', { exact: true })
      .setInputFiles(Array.from({ length: 20 }, (_, i) => ({ ...short, name: `queue-${i}.wav` })));
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.getByRole('button', { name: /Resume/ }).waitFor();
    const completedBeforeResume = await page.locator('tbody tr[data-status="done"]').count();
    await page.getByRole('button', { name: /Resume/ }).click();
    await page.waitForFunction(
      () => document.querySelectorAll('tbody tr[data-status="done"]').length === 20,
      null,
      { timeout: 180000 }
    );
    report.checks.push({
      name: 'Stop and resume actual20-file worker queue without lost/duplicated rows',
      pass: true,
      completedBeforeResume,
    });
  }
  if (process.env.KEYBPM_FORMATS === '1') {
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    const sourcePath = resolve(out, 'generated-reference.wav');
    await writeFile(sourcePath, fixtures[0].buffer);
    const files = [];
    for (const [extension, codec, mimeType] of [
      ['mp3', 'libmp3lame', 'audio/mpeg'],
      ['flac', 'flac', 'audio/flac'],
      ['m4a', 'aac', 'audio/mp4'],
      ['ogg', 'vorbis', 'audio/ogg'],
      ['aiff', 'pcm_s16be', 'audio/aiff'],
    ]) {
      const path = resolve(out, `generated-reference.${extension}`);
      execFileSync(process.env.FFMPEG_EXECUTABLE || 'ffmpeg', [
        '-nostdin',
        '-loglevel',
        'error',
        '-y',
        '-i',
        sourcePath,
        '-c:a',
        codec,
        ...(codec === 'vorbis' ? ['-strict', '-2', '-ac', '2'] : []),
        path,
      ]);
      const buffer = await readFile(path);
      files.push({ name: `generated-reference.${extension}`, mimeType, buffer });
      report.fixtures.push({
        name: `generated-reference.${extension}`,
        bytes: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex'),
        provenance: 'FFmpeg encoding of original generated reference WAV',
      });
    }
    await page.getByLabel('Add tracks', { exact: true }).setInputFiles(files);
    await page.waitForFunction(
      () =>
        document.querySelectorAll('tbody tr[data-status="done"], tbody tr[data-status="error"]')
          .length === 5,
      null,
      { timeout: 180000 }
    );
    const formats = await page.locator('tbody tr').evaluateAll((trs) =>
      trs.map((tr) => ({
        status: tr.dataset.status,
        cells: [...tr.querySelectorAll('th,td')].map((cell) => cell.textContent.trim()),
      }))
    );
    report.formatResults = formats;
    for (const row of formats) {
      // AIFF is accepted for browsers that can decode it, but not advertised
      // as universally supported. A clear rejection is a tested limitation.
      if (row.cells[0].endsWith('.aiff') && row.status === 'error') {
        assert.match(row.cells.join(' '), /could not be decoded/);
        row.support = 'UNSUPPORTED_IN_THIS_BROWSER';
        continue;
      }
      assert.equal(row.status, 'done', `Decoder rejected ${row.cells[0]}: ${row.cells.join(' ')}`);
      assert.match(row.cells[2], /^C major/);
      assert.equal(row.cells[3], '8B');
      assert(Math.abs(parseFloat(row.cells[4]) - 120) <= 1);
    }
    report.checks.push({
      name: 'Real MP3/FLAC/M4A/OGG decode and reference key/tempo; AIFF support or explicit rejection recorded',
      pass: true,
      formats,
    });
  }
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Page overflow at' + width
    );
    if (width === 390) {
      const region = page.getByRole('region', { name: 'Track analysis results' });
      await region.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.alab-table-wrap').scrollLeft > 0);
    }
    await page.screenshot({ path: resolve(out, `${engine}-${width}.png`), fullPage: true });
  }
  report.checks.push({ name: '1440/768/390 CSS widths; not physical devices', pass: true });
  assert.equal(report.errors.length, 0);
  report.pass = true;
} catch (error) {
  report.error = error.stack;
} finally {
  await browser.close();
  await writeFile(resolve(out, `${engine}-report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
if (!report.pass) process.exitCode = 1;
