import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.RESOURCE_QA_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Run only against the local app.');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.addInitScript(() => {
    localStorage.setItem('sattari-theme-pref-v1', 'night');
    localStorage.setItem('sattari-measurement-v1', 'denied');
  });
  await page.goto(`${base}/stem-separator`);
  await page.getByLabel('All stems', { exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Bass', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Drums', exact: true }).check();
  await page.getByLabel('Add audio tracks').setInputFiles('public/audio/sattari-practice-demo.wav');
  await page.getByRole('button', { name: 'Separate 1 track', exact: true }).click();
  const deadline = Date.now() + 12 * 60 * 1000;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const status = await page.locator('.separator-queue').innerText();
    if (status !== lastStatus) {
      console.log(status.slice(0, 300));
      lastStatus = status;
    }
    if (await page.locator('.separator-track.is-error').count()) throw new Error(status);
    if (await page.locator('.separator-track.is-done').count()) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  assert.equal(await page.locator('.separator-track.is-done').count(), 1);
  for (const stem of ['Bass', 'Drums']) {
    const data = await page
      .getByLabel(`${stem} preview`)
      .evaluate(async (audio) =>
        Array.from(new Uint8Array(await (await fetch(audio.src)).arrayBuffer()))
      );
    const bytes = Buffer.from(data);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt32LE(24), 44100);
    assert.equal((bytes.length - 44) / 8, 44100 * 8);
    await writeFile(`public/audio/sattari-demo-${stem.toLowerCase()}.wav`, bytes);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'public/images/tools/separator.jpg',
    type: 'jpeg',
    quality: 90,
    fullPage: true,
  });
  console.log('Captured genuine HTDemucs bass and drum outputs; no audio uploaded.');
} finally {
  await browser.close();
}
