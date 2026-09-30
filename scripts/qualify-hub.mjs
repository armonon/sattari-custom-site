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
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}/hub`, { timeout: 120000 });
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
      assert.equal(
        await page.locator('#hub-listening-desk, .hub-listening, .hub-page audio').count(),
        0
      );
      assert.equal(await page.locator('a[href="#hub-listening-desk"]').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Play demo', exact: true }).count(), 0);
      assert.equal(await page.locator('.hub-workspaces + .hub-reading').count(), 1);
      for (const [name, route] of [
        ['Sattari Studio', '/studio'],
        ['Sattari Learn', '/learn'],
        ['Stem Separator', '/stem-separator'],
      ]) {
        assert.equal(
          await page.getByRole('link', { name: `Open ${name}`, exact: true }).getAttribute('href'),
          route
        );
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true });
      assert.deepEqual(errors, [], `${theme} ${width} page errors`);
      console.log(
        `PASS ${theme} ${width}: layout, images, workspace links; listening desk and shortcut removed`
      );
      await context.close();
    }
  }
  console.log(`PASS hub without listening desk. Screenshots: ${output}`);
} finally {
  await browser.close();
}
