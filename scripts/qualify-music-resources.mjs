import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { musicGuides } from '../src/data/musicGuides.js';
import { toolDetails } from '../src/data/toolDetails.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.RESOURCE_QA_URL || 'http://127.0.0.1:5173';
const out = '/tmp/sattari-resources-qa';
await mkdir(out, { recursive: true });
const paths = [
  '/guides',
  '/visit',
  '/privacy',
  ...musicGuides.map((guide) => `/guides/${guide.slug}`),
  ...Object.values(toolDetails).map((tool) => `/tools${tool.path}`),
];
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ['day', 'night']) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(
        (theme) => localStorage.setItem('sattari-theme-pref-v1', theme),
        theme
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const events = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/site-event')) events.push(request);
      });
      for (const path of paths) {
        await page.goto(base + path);
        await page.locator('.resource-page h1').waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('h1').count(), 1, path);
        assert.equal(
          await page.locator('link[rel="canonical"]').getAttribute('href'),
          `https://sattarimusic.com${path}`
        );
        for (const img of await page.locator('.resource-page img').all()) {
          await img.scrollIntoViewIfNeeded();
          await img.evaluate((element) => element.decode());
          assert(await img.evaluate((element) => element.naturalWidth > 0), path);
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
          `${path} overflows at ${width}`
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        if (
          ['/guides', '/tools/learn', '/visit', '/guides/choose-your-first-cymbals'].includes(path)
        )
          await page.screenshot({
            path: `${out}/${theme}-${width}-${path.replaceAll('/', '_')}.png`,
            fullPage: true,
          });
      }
      await page.goto(base + '/privacy');
      await page.getByRole('button', { name: 'No thanks', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Allow anonymous usage counts' }).check();
      assert.equal(
        await page.evaluate(() => localStorage.getItem('sattari-measurement-v1')),
        'allowed'
      );
      await page.getByRole('checkbox', { name: 'Allow anonymous usage counts' }).uncheck();
      assert.equal(
        await page.evaluate(() => localStorage.getItem('sattari-measurement-v1')),
        'denied'
      );
      assert.equal(events.length, 0, 'Local QA must not create metrics');
      assert.deepEqual(errors, [], 'Page errors');
      await context.close();
      console.log(
        `PASS ${paths.length} resource routes, assets, consent controls: ${theme} ${width}px`
      );
    }
  }
  if (['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
    await page.addInitScript(() => sessionStorage.setItem('sattari_staff_token', 'qa-test-only'));
    await page.route('**/api/staff/stock', (route) =>
      route.fulfill({ json: { items: [], staff: 'QA staff' } })
    );
    await page.route('**/api/staff/insights', (route) => {
      assert.equal(route.request().headers().authorization, 'Bearer qa-test-only');
      return route.fulfill({
        json: {
          days: [
            {
              date: new Date().toISOString().slice(0, 10),
              total: 3,
              counts: { 'chatgpt|learn|learn_completed': 2, 'google|services|inquiry_sent': 1 },
            },
          ],
        },
      });
    });
    await page.goto(`${base}/staff-cc6436694e.html`);
    await page.getByRole('button', { name: 'Site insights', exact: true }).click();
    await page.locator('#insights-rows tr').nth(1).waitFor();
    await page.getByLabel('Referral source').selectOption('chatgpt');
    assert.equal(await page.locator('#insights-rows tr').count(), 1);
    assert.match(await page.locator('#insights-rows').innerText(), /learn_completed/);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false
    );
    await page.screenshot({ path: `${out}/staff-insights-mobile.png`, fullPage: true });
    console.log('PASS authenticated staff report UI and source filter with mocked counts.');
  }
} finally {
  await browser.close();
}
