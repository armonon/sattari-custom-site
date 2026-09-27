import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const base = process.env.SEO_URL;
if (!base) throw new Error('Set SEO_URL to the Netlify preview or production origin.');
const output = process.env.SEO_QA_DIR || '/tmp/sattari-seo-qa';
await mkdir(output, { recursive: true });
const paths = [
  '/',
  '/about',
  '/shop',
  '/shop/violins',
  '/product/pirouz-series-cymbals',
  '/services',
  '/encino-music-store',
  '/woodland-hills-music-store',
  '/calabasas-music-store',
  '/los-angeles-music-store',
  '/stem-separator',
  '/learn',
  '/studio',
];
for (const path of paths) {
  const response = await fetch(`${base}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, `${path}: expected a directly accessible canonical route`);
  const dom = new JSDOM(await response.text());
  const doc = dom.window.document;
  assert.equal(doc.querySelector('link[rel="canonical"]')?.href, `https://sattarimusic.com${path}`);
  assert.ok(doc.querySelector('h1')?.textContent, `${path}: no prerendered content`);
  console.log(`PASS initial HTML: ${path}`);
  dom.window.close();
}
for (const [path, target] of [
  ['/buy', '/shop'],
  ['/audio-suite', '/downloads'],
  ['/services/music-classes-los-angeles', '/services/music-lessons-los-angeles'],
  ['/services/drum-repair-los-angeles', '/services/instrument-repair-los-angeles'],
  ['/stem-seperator', '/stem-separator'],
]) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  assert.equal(response.status, 301, `${path}: missing permanent redirect`);
  assert.equal(new URL(response.headers.get('location'), base).pathname, target);
}
{
  const path = '/shop/violins-los-angeles';
  const response = await fetch(`${base}${path}`, { redirect: 'manual' });
  assert.equal(response.status, 200, `${path}: expected the page to stay accessible`);
  const dom = new JSDOM(await response.text());
  assert.equal(
    dom.window.document.querySelector('link[rel="canonical"]')?.href,
    'https://sattarimusic.com/shop/violins',
    `${path}: expected to canonicalize to /shop/violins`
  );
  dom.window.close();
}
assert.equal((await fetch(`${base}/seo-check-page-does-not-exist`)).status, 404);
// netlify/edge-functions/product-not-found.js: unknown product slugs are real 404s.
assert.equal((await fetch(`${base}/product/seo-check-product-does-not-exist`)).status, 404);
const cart = await fetch(`${base}/cart`);
assert.match(cart.headers.get('x-robots-tag'), /noindex/);
assert.equal((await fetch(`${base}/api/inventory`)).status, 200);
console.log('PASS redirects, 404, cart noindex header and inventory API');

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/about', '/services', '/encino-music-store', '/stem-separator']) {
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => !document.getElementById('root').innerHTML.includes('<!--$-->')
      );
      await page.locator('h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const img of await page.locator('img:visible').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate((image) => image.decode());
        assert.ok(
          await img.evaluate((image) => image.naturalWidth > 0),
          `${path}: image failed to load`
        );
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
      assert.equal(await page.locator('meta[name="description"]').count(), 1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      assert.equal(overflow, false, `${path}: horizontal overflow at ${width}px`);
      await page.screenshot({
        path: `${output}/${width}-${path.slice(1) || 'home'}.png`,
        fullPage: true,
      });
    }
    await page.getByRole('checkbox', { name: 'All stems', exact: true }).uncheck();
    assert.equal(
      await page.locator('input[type="checkbox"]:checked').count(),
      0,
      'Stem controls must still work after prerender'
    );
  }
  await page.locator('.separator-breadcrumb a[href="/hub"]').click();
  await page.waitForURL('**/hub');
  await page.waitForFunction(() =>
    document.querySelector('link[rel="canonical"]')?.href.endsWith('/hub')
  );
  assert.equal(
    await page.locator('link[rel="canonical"]').count(),
    1,
    'Client navigation retained an old canonical'
  );
  assert.deepEqual(errors, [], 'Browser errors');
  console.log(
    `PASS responsive layout, interactive separator and client-side metadata updates. Screenshots: ${output}`
  );
} finally {
  await browser.close();
}
