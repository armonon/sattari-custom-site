import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.NAV_QA_URL || 'http://127.0.0.1:5190';
const output = process.env.NAV_QA_DIR || '/tmp/sattari-navbar-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  for (const mode of ['day', 'night']) {
    for (const width of [320, 390, 440, 760, 768, 860, 1024, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        (theme) => localStorage.setItem('sattari-theme-pref-v1', theme),
        mode
      );
      for (const path of ['/', '/shop', '/services', '/hub']) {
        await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
        await page.locator('h1').waitFor();
        await page.locator('.brand-logo').evaluate((img) => img.decode());
        await page.evaluate(() => document.fonts.ready);
        const logo = await page.evaluate(() => {
          const image = document.querySelector('.brand-logo');
          const frame = document.querySelector('.nav-logo-frame');
          const actions = document.querySelector('.nav-actions-row').getBoundingClientRect();
          const r = image.getBoundingClientRect();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.filter = getComputedStyle(image).filter;
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let brightness = 0;
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 200) {
              brightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
              count += 1;
            }
          }
          return {
            ratio: r.width / r.height,
            naturalRatio: image.naturalWidth / image.naturalHeight,
            width: r.width,
            insideViewport: r.left >= 0 && r.right <= innerWidth,
            overlapsActions:
              r.right > actions.left &&
              r.left < actions.right &&
              r.bottom > actions.top &&
              r.top < actions.bottom,
            brightness: brightness / count,
            opaquePixels: count,
            frameBackground: getComputedStyle(frame).backgroundColor,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        const label = `${mode} ${width}px ${path}`;
        assert.ok(Math.abs(logo.ratio - logo.naturalRatio) < 0.02, `${label}: distorted logo`);
        assert.equal(Math.round(logo.width), width <= 760 ? 126 : 164, `${label}: logo shrank`);
        assert.equal(logo.insideViewport, true, `${label}: logo outside viewport`);
        assert.equal(logo.overlapsActions, false, `${label}: logo overlaps header controls`);
        assert.equal(logo.overflow, false, `${label}: page overflow`);
        assert.ok(logo.opaquePixels > 100, `${label}: missing artwork`);
        assert.ok(
          mode === 'day' ? logo.brightness < 20 : logo.brightness > 240,
          `${label}: low-contrast logo`
        );
        if (mode === 'night') {
          assert.notEqual(
            logo.frameBackground,
            'rgb(255, 255, 255)',
            `${label}: white-on-white logo`
          );
        }
        if ([390, 440, 1440].includes(width) && ['/', '/services'].includes(path)) {
          await page.screenshot({
            path: `${output}/${mode}-${width}-${path.slice(1) || 'home'}.png`,
          });
        }
        const menu = page.getByRole('button', { name: 'Open menu', exact: true });
        if (await menu.isVisible()) {
          await menu.click();
          await page.waitForFunction(() =>
            document.querySelector('#primary-navigation').classList.contains('nav-links-open')
          );
          await page.locator('#primary-navigation').evaluate(async (nav) => {
            await Promise.all(nav.getAnimations().map((animation) => animation.finished));
          });
          const navFits = await page.locator('#primary-navigation').evaluate((nav) => {
            const r = nav.getBoundingClientRect();
            return Array.from(nav.querySelectorAll('a, button')).every((link) => {
              const item = link.getBoundingClientRect();
              return (
                item.top >= r.top - 1 &&
                item.bottom <= r.bottom + 1 &&
                item.left >= 0 &&
                item.right <= innerWidth
              );
            });
          });
          assert.equal(navFits, true, `${label}: mobile menu clips a control`);
          await page.getByRole('button', { name: 'Close menu', exact: true }).click();
        }
        console.log(`PASS ${label}: logo contrast, proportions, header controls`);
      }
      await page.close();
    }
  }
  for (const width of [320, 440, 740]) {
    const page = await browser.newPage({
      viewport: { width, height: 360 },
      reducedMotion: 'reduce',
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/services`, { waitUntil: 'domcontentloaded' });
    await page.locator('h1').waitFor();
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'Open cart', exact: true }).scrollIntoViewIfNeeded();
    const fits = await page.locator('#primary-navigation').evaluate((nav) => {
      const r = nav.getBoundingClientRect();
      const cart = nav.querySelector('.nav-cart-button').getBoundingClientRect();
      return r.bottom <= innerHeight && cart.top >= r.top && cart.bottom <= r.bottom + 1;
    });
    assert.equal(fits, true, `Short ${width}px viewport: cart must be reachable inside the menu`);
    await page.screenshot({ path: `${output}/short-${width}-menu.png` });
    await page.getByRole('button', { name: 'Open cart', exact: true }).click();
    await page.locator('.cart-drawer.open').waitFor();
    assert.equal(await page.locator('.nav-links-open').count(), 0);
    console.log(`PASS short ${width}x360 viewport: scrolling menu and Cart action`);
    await page.close();
  }
  assert.deepEqual(errors, [], 'Browser errors');
  console.log(`PASS all 64 header checks. Screenshots: ${output}`);
} finally {
  await browser.close();
}
