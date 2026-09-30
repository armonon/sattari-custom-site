import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Kept at this path for the Studio release runner; exercises the replacement Learn.
const base = process.env.LEARN_QA_URL || 'http://127.0.0.1:5190';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('Learn review qualification must run locally.');
}
const output = process.env.LEARN_QA_OUTPUT || '/tmp/sattari-learn-review-fixes';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--mute-audio'],
});
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/loop`);
    await page.waitForURL('**/learn');
    await page.getByRole('button', { name: 'Sattari Learn song library' }).waitFor();
    assert.equal(await page.getByRole('main').count(), 1);
    assert.equal(await page.locator('.nav-wrap').count(), 0);
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
      'https://sattarimusic.com/learn'
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false
    );
    await page.screenshot({ path: `${output}/library-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Learn Ode to Joy', exact: true }).click();
    await page.getByRole('tab', { name: 'Chord charts', exact: true }).click();
    await page.getByRole('img', { name: /C major. Frets/ }).waitFor();
    await page.getByRole('button', { name: 'Listen to the melody' }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('audio')].some(
        (audio) => !audio.paused && audio.currentTime > 0.1
      )
    );
    await page.getByRole('button', { name: 'Practice this song', exact: true }).click();
    await page.getByRole('button', { name: 'Enable microphone', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Explore without a microphone', exact: true }).click();
    await page.getByRole('button', { name: 'Hear this phrase', exact: true }).waitFor();
    assert.equal(await page.getByRole('main').count(), 1);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false
    );
    await page.screenshot({ path: `${output}/practice-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Exit practice', exact: true }).click();
    await page.getByRole('heading', { name: 'Ode to Joy', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Back to Sattari Hub', exact: true }).click();
    await page.waitForURL('**/hub');
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px: Learn redirect, song guides, reference playback, focused practice, Hub navigation and no overflow`
    );
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await page.goto(`${base}/studio`);
  await page.locator('#studio-workspace').waitFor({ timeout: 120000 });
  assert.equal(await page.getByRole('main').count(), 1);
  assert.equal(
    await page.getByRole('region', { name: 'Studio workspace', exact: true }).count(),
    1
  );
  await page.getByRole('link', { name: 'Skip to workspace' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(
    await page.locator('#studio-workspace').evaluate((node) => document.activeElement === node),
    true
  );
  console.log('PASS Studio has one main landmark and its skip link moves focus');
  await context.close();
} finally {
  await browser.close();
}
