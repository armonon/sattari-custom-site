import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.HUB_QA_URL || 'http://127.0.0.1:5190';
const output = '/tmp/sattari-hub-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['day', 'night']) {
    for (const width of [1440, 1024, 768, 390, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: 'reduce',
      });
      await context.addInitScript(
        (value) => localStorage.setItem('sattari-theme-pref-v1', value),
        theme
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/hub`);
      await page.getByRole('heading', { name: 'Sattari Hub', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const img of await page.locator('.hub-page img').all()) {
        await img.evaluate((image) => image.decode());
        assert(await img.evaluate((image) => image.naturalWidth > 0));
      }
      assert.equal(await page.locator('.hub-page h1').count(), 1);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${theme} ${width} overflow`
      );
      assert.equal(await page.locator('.hub-tool').count(), 3);
      assert.equal(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
        'https://sattarimusic.com/hub'
      );
      const ready = page.getByRole('button', { name: 'Play demo', exact: true });
      await ready.waitFor();
      await page.waitForFunction(
        () => document.querySelector('.hub-listening audio').readyState >= 1
      );
      assert.equal(
        await page.locator('.hub-listening audio').evaluate((audio) => audio.paused),
        true
      );
      await ready.click();
      await page.waitForFunction(
        () => document.querySelector('.hub-listening audio').currentTime > 1
      );
      await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
      const pausedTime = await page
        .locator('.hub-listening audio')
        .evaluate((audio) => audio.currentTime);
      await page.getByRole('radio', { name: 'Bass', exact: true }).check();
      await page.waitForFunction(
        () =>
          document.querySelector('.hub-listening audio').readyState >= 1 &&
          !document.querySelector('.hub-play-button').disabled
      );
      assert(
        Math.abs(
          (await page.locator('.hub-listening audio').evaluate((audio) => audio.currentTime)) -
            pausedTime
        ) < 0.1
      );
      assert.equal(
        await page.locator('.hub-listening audio').evaluate((audio) => audio.paused),
        true
      );
      await page.getByRole('button', { name: 'Play demo', exact: true }).click();
      await page.getByRole('button', { name: 'Pause demo', exact: true }).waitFor();
      await page.getByRole('radio', { name: 'Drums', exact: true }).check();
      await page.getByRole('button', { name: 'Pause demo', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
      await page.getByRole('button', { name: 'Mute demo', exact: true }).click();
      assert.equal(
        await page.locator('.hub-listening audio').evaluate((audio) => audio.muted),
        true
      );
      await page.getByRole('button', { name: 'Unmute demo', exact: true }).click();
      await page.getByRole('button', { name: 'Loop demo', exact: true }).click();
      assert.equal(
        await page.locator('.hub-listening audio').evaluate((audio) => audio.loop),
        false
      );
      const source = page.getByRole('radio', { name: 'Full mix', exact: true });
      await source.focus();
      await source.press('ArrowRight');
      assert.equal(await page.getByRole('radio', { name: 'Bass', exact: true }).isChecked(), true);
      const download = page.getByRole('link', { name: 'Download bass WAV', exact: true });
      assert.equal(await download.getAttribute('href'), '/audio/sattari-demo-bass.wav');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true });
      await page
        .locator('#hub-listening-desk')
        .screenshot({ path: `${output}/player-${theme}-${width}.png` });
      await page.getByRole('link', { name: 'Open Sattari Learn', exact: true }).click();
      await page.waitForURL('**/learn');
      await page.locator('.hub-listening audio').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.hub-listening audio').count(), 0);
      assert.deepEqual(errors, [], `${theme} ${width} page errors`);
      console.log(
        `PASS ${theme} ${width}: layout, images, native audio, stem switching, controls, keyboard, links`
      );
      await context.close();
    }
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/audio/sattari-practice-demo.wav', (route) => route.abort());
  await page.goto(`${base}/hub`);
  await page.getByRole('alert').filter({ hasText: 'This demo could not load' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Retry demo audio' }).isEnabled(), true);
  await page.getByRole('radio', { name: 'Bass', exact: true }).check();
  await page.getByRole('button', { name: 'Play demo' }).click();
  await page.getByRole('button', { name: 'Pause demo' }).waitFor();
  assert.equal(await page.locator('.hub-audio-error').count(), 0);
  await context.close();
  console.log(`PASS network-error recovery. Screenshots: ${output}`);
} finally {
  await browser.close();
}
