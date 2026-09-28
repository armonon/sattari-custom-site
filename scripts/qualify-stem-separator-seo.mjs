import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { separatorGuides, separatorQuestions } from '../src/data/stemSeparatorContent.js';

const base = process.env.SEO_URL;
if (!base) throw new Error('Set SEO_URL to a built preview or deployed site.');
const output = process.env.SEO_QA_DIR || '/tmp/sattari-stem-seo-qa';
await mkdir(output, { recursive: true });
const paths = [
  '/stem-separator',
  '/tools/stem-separator',
  '/guides',
  ...separatorGuides.map((guide) => `/guides/${guide.slug}`),
];

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
for (const path of paths) {
  assert.ok(sitemap.includes(`https://sattarimusic.com${path}</loc>`), `${path}: not in sitemap`);
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200);
  const dom = new JSDOM(await response.text());
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('h1').length, 1, `${path}: missing initial heading`);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, `https://sattarimusic.com${path}`);
  for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
    JSON.parse(node.textContent);
  }
  dom.window.close();
}

const browser = await chromium.launch({ headless: true });
const errors = [];
let layouts = 0;
try {
  for (const width of [1440, 390]) {
    for (const theme of ['day', 'night']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.addInitScript(
        (value) => localStorage.setItem('sattari-theme-pref-v1', value),
        theme
      );
      page.on('pageerror', (error) => errors.push(error.message));
      for (const path of paths) {
        await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
        // A real theme toggle verifies hydration, including prerendered pages.
        const other = theme === 'day' ? 'night' : 'day';
        await page.getByRole('button', { name: `Switch to ${other} mode` }).click();
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('h1').count(), 1);
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
        for (const image of await page.locator('.resource-page img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((img) => img.decode());
          assert.ok(await image.evaluate((img) => img.naturalWidth > 0));
        }
        if (path.startsWith('/guides/')) {
          const contents = page.getByRole('navigation', { name: 'In this guide' });
          const first = contents.getByRole('link').first();
          const target = (await first.getAttribute('href')).slice(1);
          await first.click();
          await page.waitForFunction((id) => {
            const section = document.getElementById(id).getBoundingClientRect();
            const header = document.querySelector('.nav-wrap').getBoundingClientRect();
            return (
              location.hash === `#${id}` &&
              section.top >= header.bottom &&
              section.top < innerHeight
            );
          }, target);
          assert.equal(await page.locator('.resource-byline a').getAttribute('href'), '/about');
        }
        if (path === '/tools/stem-separator') {
          for (const { question } of separatorQuestions) {
            const summary = page.getByText(question, { exact: true });
            await summary.click();
            assert.equal(await summary.evaluate((node) => node.parentElement.open), true);
          }
          await page
            .locator('#questions')
            .screenshot({ path: `${output}/${width}-${theme}-questions.png` });
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `${path}: horizontal overflow at ${width}px (${theme})`
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${output}/${width}-${theme}-${path.slice(1).replaceAll('/', '-')}.png`,
          fullPage: true,
        });
        layouts += 1;
      }

      await page.goto(`${base}/stem-separator`);
      await page.getByLabel('Add audio tracks').setInputFiles({
        name: 'seo-check.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.from('queue check; no decoding requested'),
      });
      assert.equal(await page.getByRole('article', { name: 'seo-check.wav' }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Separate 1 track' }).isEnabled(), true);
      await page.getByRole('checkbox', { name: 'All stems', exact: true }).uncheck();
      assert.equal(await page.getByRole('button', { name: 'Separate 1 track' }).isEnabled(), false);
      await page.getByRole('checkbox', { name: 'Bass', exact: true }).check();
      assert.equal(await page.getByRole('button', { name: 'Separate 1 track' }).isEnabled(), true);
      const popupPromise = page.waitForEvent('popup');
      await page
        .getByRole('link', { name: 'Karaoke & vocal removal (opens in a new tab)' })
        .click();
      const popup = await popupPromise;
      await popup.waitForURL('**/guides/remove-vocals-for-karaoke');
      assert.equal(await page.getByRole('article', { name: 'seo-check.wav' }).count(), 1);
      await popup.close();
      await page.close();
    }
  }
  assert.deepEqual(errors, [], 'Browser errors');
  console.log(
    `PASS: ${paths.length} prerendered routes, ${layouts} responsive/theme checks, FAQ controls and uninterrupted file queues. Screenshots: ${output}`
  );
} finally {
  await browser.close();
}
