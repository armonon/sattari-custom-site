// Browser smoke test for the wave-3 alpha tools (Lyric, Clean) against the
// production build. Run `npm run build` first, then:
//   node scripts/qualify-lyric-clean.mjs            (starts `vite preview` itself)
//   LABS_QA_URL=https://deploy-preview… node scripts/qualify-lyric-clean.mjs
// PLAYWRIGHT_CHANNEL=chrome uses an installed Chrome instead of Playwright's.
// This is a load/render smoke check, not an exercise of the on-device DSP or
// Whisper alignment pipelines (those are covered by unit tests under
// src/labs/lyric and src/labs/clean).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const output = process.env.LABS_QA_OUTPUT || '/tmp/sattari-lyric-clean-qa';
await mkdir(output, { recursive: true });

let server = null;
let base = process.env.LABS_QA_URL;
if (!base) {
  server = await preview({ preview: { port: 5392, host: '127.0.0.1' } });
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});

async function checkPage(path, headingName) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  // Only uncaught exceptions, matching qualify-labs.mjs/qualify-hub.mjs: a bare
  // `vite preview` has no Netlify functions dev server, so /api/inventory (used
  // by shared chrome on every route) 404s here and would be a false positive.
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}${path}`, { timeout: 60000 });
  await page.getByRole('heading', { name: headingName }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${output}${path.replace(/\//g, '-')}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(overflow, false, `${path}: unexpected horizontal overflow`);
  assert.equal(errors.length, 0, `${path}: console/page errors: ${errors.join('; ')}`);
  await context.close();
}

try {
  await checkPage('/studio/lyric', /Lyric/);
  await checkPage('/studio/clean', /Clean/);
  console.log('qualify-lyric-clean: ok');
} finally {
  await browser.close();
  if (server) await server.close();
}
