import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';

const base = process.env.SITE_QA_URL || 'http://127.0.0.1:5190';
const output = process.env.SITE_QA_OUTPUT || '/tmp/sattari-site-ui-audit';
const sitemap = new JSDOM(
  await readFile(`${process.env.SITE_QA_DIST || 'dist'}/sitemap.xml`, 'utf8'),
  {
    contentType: 'application/xml',
  }
);
const routes = [
  ...new Set([
    ...[...sitemap.window.document.querySelectorAll('loc')].map(
      (n) => new URL(n.textContent).pathname
    ),
    '/cart',
    '/studio-booking',
    '/not-a-real-page',
  ]),
];
sitemap.window.close();
const selected = process.env.SITE_QA_ROUTES?.split(',') || routes;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SITE_QA_BROWSER ? { channel: process.env.SITE_QA_BROWSER } : {}),
});
const results = [];
try {
  for (const [width, theme] of [
    [390, 'day'],
    [1440, 'night'],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(
      (value) => localStorage.setItem('sattari-theme-pref-v1', value),
      theme
    );
    for (const route of selected) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const result = { route, width, theme, errors };
      try {
        await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => {
          const images = [...document.querySelectorAll('main img')];
          await Promise.all(
            images.map(async (img) => {
              img.loading = 'eager';
              try {
                await img.decode();
              } catch {
                /* Report the broken image below. */
              }
            })
          );
        });
        Object.assign(
          result,
          await page.evaluate(() => {
            const visible = (el) =>
              el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
            const label = (el) =>
              `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).replace(/\s+/g, '.')}`;
            return {
              title: document.title,
              h1: [...document.querySelectorAll('h1')].map((el) => el.textContent.trim()),
              mains: document.querySelectorAll('main, [role="main"]').length,
              overflow: document.documentElement.scrollWidth - innerWidth,
              wide: [...document.querySelectorAll('main *')]
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  if (!visible(el) || r.width < 2 || r.right <= innerWidth + 1) return false;
                  for (let p = el.parentElement; p; p = p.parentElement) {
                    if (p.matches('.site-shell, body, html')) continue;
                    if (
                      ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(p).overflowX)
                    )
                      return false;
                  }
                  return true;
                })
                .slice(0, 12)
                .map(label),
              brokenImages: [...document.querySelectorAll('img')]
                .filter((el) => visible(el) && el.complete && !el.naturalWidth)
                .map((el) => el.getAttribute('src')),
              unnamedControls: [...document.querySelectorAll('button')]
                .filter(
                  (el) =>
                    visible(el) &&
                    !el.textContent.trim() &&
                    !el.getAttribute('aria-label') &&
                    !el.getAttribute('aria-labelledby') &&
                    !el.getAttribute('title')
                )
                .map(label),
            };
          })
        );
        if (!route.startsWith('/product/') && !route.startsWith('/guides/')) {
          await page.screenshot({
            path: `${output}/${theme}-${width}-${route.replaceAll('/', '_') || 'home'}.png`,
            fullPage: true,
          });
        }
      } catch (error) {
        result.failure = error.message;
      }
      results.push(result);
      console.log(JSON.stringify(result));
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2));
}
const failures = results.filter(
  (r) =>
    r.failure ||
    r.errors.length ||
    r.overflow > 1 ||
    r.wide?.length ||
    r.mains !== 1 ||
    r.h1?.length !== 1 ||
    r.brokenImages?.length ||
    r.unnamedControls?.length
);
console.log(
  `${results.length} route/viewport checks, ${failures.length} need attention. Evidence: ${output}`
);
if (failures.length) process.exitCode = 1;
