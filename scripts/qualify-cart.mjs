import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.CART_QA_URL || 'http://127.0.0.1:5190';
const output = process.env.CART_QA_DIR || '/tmp/sattari-cart-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['day', 'night']) {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        (value) => localStorage.setItem('sattari-theme-pref-v1', value),
        theme
      );
      // This test must never create a real checkout or reserve inventory.
      await page.route('**/api/create-checkout-session', (route) => route.abort());
      await page.goto(`${base}/product/pirouz-series-cymbals`);
      await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
      await page.goto(`${base}/cart`);
      const quantity = page.getByRole('spinbutton', { name: /Quantity for/ });
      async function expectQuantity(value) {
        await page.waitForFunction(
          (expected) => document.querySelector('.cart-quantity-control input')?.value === expected,
          value
        );
        assert.equal(await quantity.inputValue(), value);
      }
      await expectQuantity('1');
      await quantity.fill('2');
      await quantity.press('Tab');
      await expectQuantity('2');
      await page.reload();
      await expectQuantity('2');
      // Normal clicks enforce visibility and hit testing; no forced clicks.
      await page.getByRole('button', { name: 'Decrease quantity', exact: true }).click();
      await expectQuantity('1');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${theme} ${width}px: horizontal overflow`
      );
      await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Remove Pirouz Series Cymbals', exact: true }).click();
      await page.getByRole('heading', { name: 'Your bag is empty', exact: true }).waitFor();
      assert.deepEqual(errors, [], `${theme} ${width}px: browser errors`);
      console.log(`PASS ${theme} ${width}px: add, quantity, reload, remove; no checkout created`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
