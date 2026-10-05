// Browser smoke test for the Studio alpha labs (Split, Key & BPM, Vox).
//
//   npm run build && npx vite preview --host 127.0.0.1 --port 5191
//   LABS_URL=http://127.0.0.1:5191 node scripts/qualify-studio-labs.mjs
//
// LABS_CHROME=/path/to/chrome uses an installed Chrome instead of Playwright's
// bundled Chromium. LABS_SKIP_SPLIT=1 skips the real HTDemucs run (172 MB model
// download + CPU inference). Screenshots go to LABS_QA_DIR (/tmp/sattari-split-keybpm-vox-qa).
// This is a functional check with synthetic audio, not a quality benchmark.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { wavBytes } from '../src/utils/arrangementExport.js';
import { detectFundamental } from '../src/loop/pitch.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.LABS_URL || 'http://127.0.0.1:5191';
const out = process.env.LABS_QA_DIR || '/tmp/sattari-split-keybpm-vox-qa';
await mkdir(out, { recursive: true });
const rate = 44100;

function wavFile(name, samples) {
  return {
    name,
    mimeType: 'audio/wav',
    buffer: Buffer.from(
      wavBytes({
        sampleRate: rate,
        length: samples.length,
        numberOfChannels: 1,
        getChannelData: () => samples,
      })
    ),
  };
}

function loop(rootMidi, minor, bpm, seconds = 14) {
  const samples = new Float32Array(seconds * rate);
  const notes = [rootMidi, rootMidi + (minor ? 3 : 4), rootMidi + 7];
  for (let i = 0; i < samples.length; i++)
    samples[i] = notes.reduce(
      (sum, midi) => sum + 0.1 * Math.sin((2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i) / rate),
      0
    );
  for (let t = 0.2; t < seconds; t += 60 / bpm)
    for (let i = 0; i < 2000; i++) {
      const at = Math.floor(t * rate) + i;
      if (at < samples.length) samples[at] += 0.8 * Math.exp(-i / 240) * Math.sin(i * 0.225);
    }
  return samples;
}

// A "sung" C major line, every note 35 cents sharp.
const VOX_NOTES = [60, 62, 64, 65, 67, 65, 64, 62, 60, 64, 67, 72, 67, 64, 60];
const NOTE_SECONDS = 0.45;
function sharpVocal() {
  const samples = new Float32Array(Math.round(VOX_NOTES.length * NOTE_SECONDS * rate));
  VOX_NOTES.forEach((midi, index) => {
    const hz = 440 * 2 ** ((midi + 0.35 - 69) / 12);
    const start = Math.round(index * NOTE_SECONDS * rate);
    const length = Math.round((NOTE_SECONDS - 0.05) * rate);
    let phase = 0;
    for (let i = 0; i < length; i++) {
      phase += (2 * Math.PI * hz) / rate;
      const envelope = Math.min(1, i / 400, (length - i) / 400);
      samples[start + i] =
        envelope *
        (0.3 * Math.sin(phase) + 0.15 * Math.sin(2 * phase) + 0.07 * Math.sin(3 * phase));
    }
  });
  return samples;
}

function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(22, true);
  const bits = view.getUint16(34, true);
  const format = view.getUint16(20, true);
  let offset = 12;
  while (bytes.toString('ascii', offset, offset + 4) !== 'data')
    offset += 8 + view.getUint32(offset + 4, true);
  const size = view.getUint32(offset + 4, true);
  const start = offset + 8;
  const frames = size / (channels * (bits / 8));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const at = start + i * channels * (bits / 8);
    if (format === 3) samples[i] = view.getFloat32(at, true);
    else if (bits === 24) {
      let value = bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
      if (value & 0x800000) value -= 0x1000000;
      samples[i] = value / 8388608;
    } else samples[i] = view.getInt16(at, true) / 32768;
  }
  return { samples, rate: view.getUint32(24, true), channels };
}

async function download(page, click) {
  const [file] = await Promise.all([page.waitForEvent('download'), click()]);
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

// React tracks input values, so set ranges through the native setter.
async function setRange(locator, value) {
  await locator.evaluate((element, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
}

async function noOverflow(page, label) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/${label}-mobile.png`, fullPage: true });
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert(fits, `${label}: mobile layout overflows`);
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.LABS_CHROME ? { executablePath: process.env.LABS_CHROME } : {}),
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
await context.grantPermissions(['microphone'], { origin: base });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) console.log('HTTP', response.status(), response.url());
});
page.on('console', (event) => {
  if (event.type() === 'error') console.log('CONSOLE:', event.text());
});
const report = {};

try {
  // ---------- Key & BPM ----------
  await page.goto(`${base}/studio/keybpm`);
  await page.getByRole('heading', { level: 1, name: /Key & BPM/ }).waitFor();
  await page
    .locator('input[type=file]')
    .setInputFiles([
      wavFile('c-major-120.wav', loop(60, false, 120)),
      wavFile('a-minor-100.wav', loop(57, true, 100)),
      wavFile('silence.wav', new Float32Array(rate * 4)),
    ]);
  await page
    .locator('tbody tr[data-status="done"], tbody tr[data-status="error"]')
    .nth(2)
    .waitFor({ timeout: 180000 });
  const rows = await page.$$eval('tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll('th,td')].map((cell) => cell.textContent.trim()))
  );
  console.log('Key & BPM rows', rows);
  report.keybpm = rows;
  assert.match(rows[0][2], /^C major/);
  assert.equal(rows[0][3], '8B');
  assert.match(rows[0][4], /^120/);
  assert.match(rows[1][2], /^A minor/);
  assert.equal(rows[1][3], '8A');
  assert.match(rows[1][4], /^100/);
  assert.equal(rows[2][2], '—');
  const csv = await download(page, () => page.getByRole('button', { name: 'Export CSV' }).click());
  const csvText = csv.bytes.toString('utf8');
  assert.equal(csv.name, 'sattari-key-bpm.csv');
  assert.equal(csvText.trim().split('\r\n').length, 4);
  assert.match(csvText, /"c-major-120.wav","14.0","C major","8B"/);
  await page.screenshot({ path: `${out}/keybpm-desktop.png`, fullPage: true });
  await noOverflow(page, 'keybpm');

  // ---------- Vox: file ----------
  await page.goto(`${base}/studio/vox`);
  await page.getByRole('heading', { level: 1, name: /Vox/ }).waitFor();
  await page.locator('input[type=file]').setInputFiles(wavFile('sharp-line.wav', sharpVocal()));
  await page.getByText(/^Detected |No clear key/).waitFor({ timeout: 60000 });
  const detected = await page.locator('.alab-controls .alab-note').first().textContent();
  console.log('Vox key:', detected);
  report.voxKey = detected;
  assert.match(detected, /C major|A minor/);
  // Correct fully and instantly to C major, then measure the exported take.
  await page.getByLabel('Key root', { exact: true }).selectOption('0');
  await page.getByLabel('Scale', { exact: true }).selectOption('major');
  await setRange(page.locator('.alab-slider input').first(), 1);
  await setRange(page.locator('.alab-slider input').nth(1), 0);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Play tuned' }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.alab-actions [role=status]'));
  const tuned = await download(page, () =>
    page.getByRole('button', { name: 'Export WAV' }).click()
  );
  const wav = readWav(tuned.bytes);
  assert.equal(wav.rate, rate);
  const cents = VOX_NOTES.map((midi, index) => {
    const at = Math.round((index * NOTE_SECONDS + 0.15) * rate);
    const found = detectFundamental(wav.samples.subarray(at, at + 4096), rate, 70, 1200, 0.001);
    return found
      ? Math.round(1200 * Math.log2(found.frequency / (440 * 2 ** ((midi - 69) / 12))))
      : null;
  });
  console.log('Vox output error per note (cents, input was +35):', cents);
  report.voxCents = cents;
  assert(
    cents.every((value) => value !== null && Math.abs(value) <= 12),
    'Vox did not tune the line'
  );
  await page.getByText('3rd above').click();
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !document.querySelector('.alab-actions [role=status]'));
  const harmony = await download(page, () =>
    page.getByRole('button', { name: 'Harmony only' }).click()
  );
  const harmonyWav = readWav(harmony.bytes);
  const first = detectFundamental(
    harmonyWav.samples.subarray(Math.round(0.15 * rate), Math.round(0.15 * rate) + 4096),
    rate,
    70,
    1500,
    0.001
  );
  report.harmonyFirstHz = first?.frequency;
  console.log('Harmony over C4 (expect E4 ≈ 329.6 Hz):', first?.frequency);
  assert(
    first && Math.abs(1200 * Math.log2(first.frequency / 329.63)) < 20,
    'Harmony is not a third above'
  );
  await page.screenshot({ path: `${out}/vox-desktop.png`, fullPage: true });
  await noOverflow(page, 'vox');

  // ---------- Vox: microphone (Chrome fake device) ----------
  await page.goto(`${base}/studio/vox`);
  await page.getByRole('button', { name: 'Record a take' }).click();
  await page.getByRole('button', { name: /^Stop/ }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^Stop/ }).click();
  await page.getByRole('heading', { name: 'vox-recording' }).waitFor({ timeout: 30000 });
  await page.getByText(/^Detected |No clear key/).waitFor({ timeout: 60000 });
  report.recording = 'ok';
  await page.screenshot({ path: `${out}/vox-recorded.png`, fullPage: true });

  // ---------- Split (real HTDemucs) ----------
  if (process.env.LABS_SKIP_SPLIT !== '1') {
    await page.goto(`${base}/studio/split`);
    await page.getByRole('heading', { level: 1, name: /Split/ }).waitFor();
    await page.screenshot({ path: `${out}/split-empty.png`, fullPage: true });
    const started = Date.now();
    await page.getByRole('button', { name: /8-second demo/ }).click();
    await page.getByRole('status').first().waitFor({ timeout: 60000 });
    await page.screenshot({ path: `${out}/split-progress.png`, fullPage: true });
    await page.getByRole('button', { name: 'Open in StemDeck' }).waitFor({ timeout: 15 * 60000 });
    report.splitSeconds = Math.round((Date.now() - started) / 1000);
    console.log(`Split finished in ${report.splitSeconds}s`);
    await page.getByRole('button', { name: 'Play stems' }).waitFor();
    await page.waitForFunction(() => !document.querySelector('.alab-play [class*=alab-spin]'));
    const lanes = await page.$$eval('.alab-lane-name', (nodes) =>
      nodes.map((node) => node.textContent)
    );
    assert.deepEqual(lanes, ['Vocals', 'Drums', 'Bass', 'Instruments', 'Original']);
    await page.getByRole('button', { name: 'Mute Vocals' }).click();
    await page.getByRole('button', { name: 'Play stems' }).click();
    await page.waitForTimeout(1200);
    const position = await page.getByLabel('Playback position').inputValue();
    assert(Number(position) > 0.3, 'Stem preview did not play');
    await page.getByRole('button', { name: 'Pause stems' }).click();
    const stem = await download(page, () =>
      page.getByRole('link', { name: 'Download Bass WAV' }).click()
    );
    const bass = readWav(stem.bytes);
    assert.equal(bass.channels, 2);
    assert.equal(bass.samples.length, 8 * rate, 'Bass stem length must match the 8 s demo');
    await page.screenshot({ path: `${out}/split-done.png`, fullPage: true });
    await noOverflow(page, 'split');
    await page.getByRole('button', { name: 'Open in StemDeck' }).click();
    await page.waitForURL(/\/studio$/);
    await page.getByText(/Split stems are ready in Deck/).waitFor({ timeout: 120000 });
    report.handoff = await page
      .getByText(/Split stems are ready in Deck/)
      .first()
      .textContent();
    console.log('StemDeck:', report.handoff);
    await page.screenshot({ path: `${out}/stemdeck-handoff.png` });
  }

  assert.deepEqual(errors, [], `Page errors: ${errors.join('; ')}`);
  console.log('PASS', JSON.stringify(report));
} finally {
  await browser.close();
}
