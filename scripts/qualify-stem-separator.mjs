import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { wavBytes } from '../src/utils/arrangementExport.js';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.SEPARATOR_URL || 'http://127.0.0.1:5173/stem-separator';
const outputDir = process.env.SEPARATOR_QA_DIR || '/tmp/sattari-separator-qa';
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => {
  errors.push(error.message);
  console.log('PAGE ERROR:', error.message);
});
page.on('console', (event) => {
  if (event.type() === 'error') console.log('CONSOLE:', event.text());
});
page.on('requestfailed', (request) =>
  console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText)
);

function fixture(name, seconds) {
  const sampleRate = 44100;
  const samples = Float32Array.from({ length: Math.floor(seconds * sampleRate) }, (_, i) => {
    const t = i / sampleRate;
    const beat = t % 0.5;
    return (
      0.13 * Math.sin(t * Math.PI * 220) +
      0.09 * Math.sin(t * Math.PI * 880) +
      0.2 * Math.exp(-beat * 30) * Math.sin(beat * Math.PI * 120)
    );
  });
  return {
    name,
    mimeType: 'audio/wav',
    buffer: Buffer.from(
      wavBytes({
        sampleRate,
        length: samples.length,
        numberOfChannels: 2,
        getChannelData: () => samples,
      })
    ),
  };
}

try {
  await page.goto(url);
  await page.getByRole('heading', { name: /Stem Separator/ }).waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${outputDir}/desktop-empty.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${outputDir}/mobile-empty.png`, fullPage: true });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Mobile page overflows'
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const seconds = Number(process.env.SEPARATOR_TEST_SECONDS || 2);
  const stems = (process.env.SEPARATOR_STEMS || 'Vocals,Drums,Bass,Instruments').split(',');
  await page.getByLabel('All stems').uncheck();
  for (const stem of stems)
    await page.getByRole('checkbox', { name: new RegExp(`^${stem}`) }).check();
  await page
    .getByLabel('Add audio tracks')
    .setInputFiles([fixture('test-mix.wav', seconds), fixture('test-short.wav', 0.8)]);
  await page.getByRole('button', { name: 'Separate 2 tracks', exact: true }).click();
  if (process.env.SEPARATOR_CANCEL_FIRST) {
    await page.getByRole('button', { name: 'Stop batch' }).click();
    await page.locator('.separator-track.is-cancelled').waitFor();
    assert.equal(await page.locator('.separator-track.is-queued').count(), 1);
    await page.getByRole('button', { name: 'Separate 2 tracks', exact: true }).click();
  }
  let previous = '';
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    const status = await page.locator('.separator-queue').innerText();
    if (status !== previous) {
      console.log(status.slice(0, 1500));
      previous = status;
    }
    if (await page.locator('.separator-track.is-error').count())
      throw new Error(`Separation failed: ${status}`);
    if ((await page.locator('.separator-track.is-done').count()) === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  assert.equal(
    await page.locator('.separator-track.is-done').count(),
    2,
    'Real batch did not finish'
  );
  assert.equal(await page.locator('.separator-output').count(), stems.length * 2);
  const checks = await page.locator('.separator-output audio').evaluateAll(async (elements) => {
    const results = [];
    for (const element of elements) {
      const bytes = await (await fetch(element.src)).arrayBuffer();
      const view = new DataView(bytes);
      const samples = new Float32Array(bytes, 44);
      results.push({
        frames: samples.length / 2,
        rate: view.getUint32(24, true),
        finite: samples.every(Number.isFinite),
        energy: samples.reduce((sum, value) => sum + value * value, 0),
        signature: [...samples.slice(1000, 1020)],
      });
    }
    return results;
  });
  checks.forEach((check, index) => {
    assert.equal(check.rate, 44100);
    assert.equal(check.finite, true);
    assert.equal(check.frames, index < stems.length ? Math.floor(seconds * 44100) : 35280);
  });
  assert(
    checks.some((check) => check.energy > 0.001),
    'All outputs are silent'
  );
  assert(
    stems.length === 1 ||
      new Set(checks.slice(0, stems.length).map((check) => JSON.stringify(check.signature))).size >
        1,
    'Outputs are identical'
  );
  console.log(
    'REAL INFERENCE VERIFIED:',
    JSON.stringify(checks.map(({ signature, ...check }) => check))
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download all ZIP' }).click(),
  ]);
  await download.saveAs(`${outputDir}/sattari-stems.zip`);
  const archive = unzipSync(await readFile(`${outputDir}/sattari-stems.zip`));
  const names = Object.keys(archive);
  assert.equal(names.filter((name) => name.endsWith('.wav')).length, stems.length * 2);
  const reports = names.filter((name) => name.endsWith('/analysis.json'));
  assert.equal(reports.length, 2);
  for (const name of reports) {
    const report = JSON.parse(new TextDecoder().decode(archive[name]));
    assert.equal(report.stems.length, stems.length);
    assert.equal(report.song.status, 'ready');
  }
  const player = page.locator('.separator-output audio').first();
  await player.evaluate((audio) => audio.play());
  await page.waitForFunction(
    () => document.querySelector('.separator-output audio').currentTime > 0
  );
  await player.evaluate((audio) => audio.pause());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outputDir}/desktop-results.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outputDir}/mobile-results.png`, fullPage: true });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'Mobile results overflow'
  );
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.theme-toggle').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${outputDir}/desktop-night.png`, fullPage: true });
  console.log(
    `PASS: real two-track inference (${stems.join(', ')}), WAV shape/playback, ZIP contents, desktop/mobile layout. Artifacts: ${outputDir}`
  );
} finally {
  await browser.close();
}
