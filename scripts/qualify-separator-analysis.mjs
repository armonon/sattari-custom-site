import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { unzipSync } from 'fflate';

const base = process.env.SEPARATOR_QA_URL || 'http://127.0.0.1:5190';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Run only against the local app.');
const output = '/tmp/sattari-separator-analysis-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  await page.addInitScript(() => {
    localStorage.setItem('sattari-theme-pref-v1', 'night');
    localStorage.setItem('sattari-measurement-v1', 'denied');
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/stem-separator`);
  await page.getByLabel('Add audio tracks').setInputFiles('public/audio/sattari-practice-demo.wav');
  await page.getByRole('button', { name: 'Separate 1 track', exact: true }).click();
  await page
    .getByRole('region', { name: 'Song analysis', exact: true })
    .waitFor({ timeout: 30000 });
  console.log('Song analysis arrived before separation finished.');
  assert.equal(await page.locator('.separator-track.is-processing').count(), 1);
  const deadline = Date.now() + 12 * 60 * 1000;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const status = await page
      .locator('.separator-track-progress')
      .textContent()
      .catch(() => '');
    if (status !== lastStatus) {
      console.log(status);
      lastStatus = status;
    }
    if (await page.locator('.separator-track.is-error').count())
      throw new Error(await page.locator('.separator-track-error').innerText());
    if (await page.locator('.separator-track.is-done').count()) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  assert.equal(await page.locator('.separator-track.is-done').count(), 1);
  assert.equal(await page.locator('.separator-output .separator-analysis').count(), 4);
  assert.match(
    await page.getByRole('region', { name: 'Drums analysis', exact: true }).innerText(),
    /Not assigned/
  );
  for (const stem of ['Vocals', 'Drums', 'Bass', 'Instruments']) {
    const data = await page.getByLabel(`${stem} preview`).evaluate(async (audio) => {
      const buffer = await (await fetch(audio.src)).arrayBuffer();
      return {
        magic: new TextDecoder().decode(new Uint8Array(buffer, 0, 4)),
        rate: new DataView(buffer).getUint32(24, true),
        length: buffer.byteLength,
      };
    });
    assert.equal(data.magic, 'RIFF');
    assert.equal(data.rate, 44100);
    assert.equal((data.length - 44) / 8, 44100 * 8);
  }
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download analysis for sattari-practice-demo.wav', exact: true })
    .click();
  const report = JSON.parse(await readFile(await (await download).path(), 'utf8'));
  assert.equal(report.song.bpm, 120);
  assert.equal(report.stems.length, 4);
  assert.equal(report.stems.find((stem) => stem.id === 'drums').analysis.key, null);
  console.log(JSON.stringify(report, null, 2));
  const zipDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download track ZIP', exact: true }).click();
  const zip = unzipSync(await readFile(await (await zipDownload).path()));
  assert.equal(Object.keys(zip).length, 5);
  const zippedReport = JSON.parse(
    new TextDecoder().decode(zip[Object.keys(zip).find((name) => name.endsWith('/analysis.json'))])
  );
  assert.deepEqual(zippedReport, report);
  for (const theme of ['day', 'night']) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute('data-theme', value),
      theme
    );
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.separator-track').scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${theme} ${width}: overflow`
      );
      if (width === 1440) {
        const pixels = await page
          .locator('.separator-waveform')
          .first()
          .evaluate((canvas) =>
            [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data].some(
              (v) => v !== 0
            )
          );
        assert(pixels, 'Actual waveform canvas is blank');
      }
      await page
        .locator('.separator-track')
        .screenshot({ path: `${output}/${theme}-${width}.png` });
      if (width === 1440 || width === 320) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${output}/page-${theme}-${width}.png`, fullPage: true });
      }
      console.log(`PASS ${theme} ${width}: song and stem measurements, layout, waveform`);
    }
  }
  await page
    .getByRole('region', { name: 'Song analysis', exact: true })
    .getByText('Analysis details', { exact: true })
    .click();
  assert.equal(
    await page
      .getByRole('region', { name: 'Song analysis', exact: true })
      .getByText('Working sample rate')
      .isVisible(),
    true
  );
  await page.locator('.separator-track').screenshot({ path: `${output}/details-320.png` });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByLabel('Add audio tracks').setInputFiles('public/audio/sattari-demo-bass.wav');
  await page.getByRole('button', { name: 'Separate 1 track', exact: true }).click();
  await page.locator('.separator-track.is-processing .separator-song-analysis').waitFor();
  await page.getByRole('button', { name: 'Stop batch', exact: true }).click();
  await page.locator('.separator-track.is-cancelled').waitFor();
  assert.equal(await page.locator('.separator-track.is-cancelled .separator-analysis').count(), 1);
  assert.equal(await page.locator('.separator-track.is-done').count(), 1);
  assert.deepEqual(errors, []);
  console.log(`PASS actual HTDemucs, WAVs, JSON, ZIP report, cancellation. Screenshots: ${output}`);
} finally {
  await browser.close();
}
