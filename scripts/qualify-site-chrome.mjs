import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SITE_QA_URL || 'http://127.0.0.1:5190';
const output = process.env.SITE_QA_OUTPUT || '/tmp/sattari-site-chrome';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SITE_QA_BROWSER ? { channel: process.env.SITE_QA_BROWSER } : {}),
});
const sizes = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1024, 768],
  [1440, 1000],
];
try {
  for (const theme of ['day', 'night']) {
    for (const [width, height] of sizes) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      await context.addInitScript((theme) => {
        localStorage.setItem('sattari-theme-pref-v1', theme);
        localStorage.setItem(
          'sattari-cart-v1',
          JSON.stringify([
            { slug: 'cymbal-felts', size: null, color: null, quantity: 1 },
            { slug: 'classic-american-hickory-a7', size: null, color: null, quantity: 2 },
          ])
        );
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/shop', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.keyboard.press('Tab');
      assert.equal(
        await page
          .getByRole('link', { name: 'Skip to content' })
          .evaluate((el) => el === document.activeElement),
        true
      );
      await page.keyboard.press('Enter');
      assert.equal(
        await page.locator('#main-content').evaluate((el) => el === document.activeElement),
        true
      );
      if (width <= 760) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.keyboard.press('Escape');
        assert.equal(
          await page
            .getByRole('button', { name: 'Open menu' })
            .evaluate((el) => el === document.activeElement),
          true
        );
        await page.getByRole('button', { name: 'Open menu' }).click();
      } else {
        const tops = await page
          .locator('.nav-links > *')
          .evaluateAll((nodes) => nodes.map((el) => Math.round(el.getBoundingClientRect().top)));
        assert.equal(new Set(tops).size, 1, `${width}: desktop nav must not wrap`);
      }
      await page.getByRole('button', { name: /Open cart with 3 items/ }).click();
      const drawer = page.getByRole('dialog', { name: 'Shopping cart' });
      assert.equal(
        await drawer
          .locator('.cart-items-container-premium')
          .evaluate((el) => el.getBoundingClientRect().height >= 120),
        true,
        `${width}x${height}: collapsed cart items`
      );
      const checkout = drawer.getByRole('button', { name: /Proceed to Checkout/ });
      await checkout.scrollIntoViewIfNeeded();
      assert.equal(
        await checkout.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
          );
        }),
        true,
        `${width}x${height}: checkout clipped`
      );
      if (theme === 'day') {
        assert.equal(
          await drawer
            .locator('.total-amount')
            .evaluate((el) => getComputedStyle(el).webkitTextFillColor),
          'rgb(26, 32, 36)'
        );
        assert.equal(
          await drawer
            .getByRole('button', { name: 'Close cart' })
            .evaluate((el) => getComputedStyle(el).color),
          'rgb(26, 32, 36)'
        );
      }
      await page.screenshot({ path: `${output}/cart-${theme}-${width}x${height}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await drawer.isVisible(), false);
      assert.equal(
        await page.locator('body').evaluate((el) => el.classList.contains('cart-lock-scroll')),
        false
      );
      const headerStyle = async () =>
        page.locator('.nav-wrap').evaluate((el) => {
          const s = getComputedStyle(el);
          return [
            s.backgroundColor,
            s.borderBottomColor,
            Math.round(el.getBoundingClientRect().height),
          ];
        });
      const initial = await headerStyle();
      for (const [label, path] of [
        ['Home', '/'],
        ['About', '/about'],
        ['Shop', '/shop'],
        ['Local Services', '/services'],
        ['Sattari Hub', '/hub'],
      ]) {
        if (width <= 760) await page.getByRole('button', { name: 'Open menu' }).click();
        await page
          .getByRole('navigation', { name: 'Primary navigation' })
          .getByRole('link', { name: label, exact: true })
          .click();
        await page.waitForURL(base + path);
        if (width <= 760) {
          await page.waitForFunction(
            () =>
              document.querySelector('.mobile-menu-button')?.getAttribute('aria-expanded') ===
              'false'
          );
          await page.waitForFunction(
            () => getComputedStyle(document.querySelector('.nav-links')).visibility === 'hidden'
          );
        }
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.deepEqual(
          await headerStyle(),
          initial,
          `${theme} ${width}: header changes on ${label}`
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false
        );
      }
      await page.screenshot({
        path: `${output}/hub-${theme}-${width}x${height}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${theme} ${width}x${height}: shared header across routes, skip link, menu, short-screen cart and totals`
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
