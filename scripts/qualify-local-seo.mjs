import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LOCAL_SEO_QA_URL || 'http://127.0.0.1:5190';
const output = process.env.LOCAL_SEO_QA_DIR || '/tmp/sattari-local-seo-qa';
const paths = [
  '/woodland-hills-drum-shop',
  '/encino-violin-shop',
  '/services/violin-repair-los-angeles',
  '/services/guitar-setup-los-angeles',
  '/services/instrument-repair-los-angeles',
  '/woodland-hills-music-store',
  '/encino-music-store',
  '/calabasas-music-store',
  '/shop/cymbals',
  '/shop/violins',
  '/shop/guitar-bass',
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
let checks = 0;
try {
  for (const theme of ['day', 'night']) {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        (value) => localStorage.setItem('sattari-theme-pref-v1', value),
        theme
      );
      for (const path of paths) {
        const label = `${theme} ${width}px ${path}`;
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        await page.locator('h1').waitFor();
        await page.waitForFunction(
          (expected) =>
            document.querySelector('link[rel="canonical"]')?.href ===
            `https://sattarimusic.com${expected}`,
          path
        );
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('h1').count(), 1, `${label}: H1 count`);
        assert.ok(!(await page.locator('h1').innerText()).includes('not found'), label);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1
        );
        assert.equal(overflow, false, `${label}: horizontal overflow`);
        const images = page.locator('.local-product img');
        for (const img of await images.all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate((element) => element.decode());
        }
        const faq = page.locator('details.faq-item').first();
        if (await faq.count()) {
          await faq.locator('summary').click();
          assert.equal(await faq.getAttribute('open'), '', `${label}: FAQ did not open`);
          assert.equal(await faq.locator('.faq-answer').isVisible(), true);
        }
        if (paths.slice(0, 4).includes(path)) {
          assert.ok(
            await page
              .locator('address')
              .innerText()
              .then((text) => text.includes('Woodland Hills'))
          );
          assert.ok(
            await page.locator('#local-inquiry form').count(),
            `${label}: inquiry form missing`
          );
          await page.locator('a[href="#local-inquiry"]').first().click();
          assert.equal(new URL(page.url()).hash, '#local-inquiry', `${label}: inquiry CTA`);
        }
        if ([390, 1440].includes(width) && paths.slice(0, 2).includes(path)) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `${output}/${theme}-${width}-${path.slice(1)}.png`,
            fullPage: true,
          });
        }
        checks++;
      }
      // Verify client-side discovery as well as direct page loads.
      await page.goto(base + '/shop/violins', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Choosing a violin near Encino' }).click();
      await page.waitForURL('**/encino-violin-shop');
      await page
        .getByRole('heading', { name: 'Find your next violin near Encino', exact: true })
        .waitFor();
      await page.close();
    }
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(
    `PASS: ${checks} local and catalog page checks, both themes, desktop/mobile, images, FAQs, inquiry anchors and client-side navigation. Screenshots: ${output}`
  );
} finally {
  await browser.close();
}
