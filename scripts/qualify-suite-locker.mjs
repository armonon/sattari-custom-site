// Suite menu + Locker check for the studio apps, against the production build
// (or a deployed URL). Uses the live kit at https://thecreatingco.com.
//   node scripts/qualify-suite-locker.mjs               (serves dist/ with vite preview)
//   SUITE_QA_URL=https://sattarimusic.com node scripts/qualify-suite-locker.mjs
// localhost and sattarimusic.com are outside thecreatingco.com, so the Locker
// runs in popup-handoff mode there; that is the path exercised here.
// CHROME_PATH points Playwright at a local Chrome/Chromium binary.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

let server = null;
let base = process.env.SUITE_QA_URL?.replace(/\/$/, '');
if (!base) {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: 5399, host: 'localhost', strictPort: true } });
  base = 'http://localhost:5399'; // the Locker allowlists localhost, not 127.0.0.1
}
const log = (line) => console.log(`  ✓ ${line}`);
// Same site as thecreatingco.com → hidden bridge iframe; anything else → popup handoff.
const expectedMode = /(^|\.)thecreatingco\.com$/.test(new URL(base).hostname) ? 'bridge' : 'popup';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
});
const errors = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(`${page.url()} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text()))
      errors.push(`${page.url()} console: ${message.text()}`);
  });
};

const PAGES = [
  ['/studio', 'stemdeck'],
  ['/studio/split', 'split'],
  ['/studio/keybpm', 'key-bpm'],
  ['/studio/vox', 'vox'],
  ['/studio/canvas', 'canvas'],
  ['/studio/pocket', 'pocket'],
  ['/press', 'press'],
];

try {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 860 },
  });

  // 1. Menu on every tool page, with the right app id and no layout shift.
  for (const [path, app] of PAGES) {
    const page = await context.newPage();
    watch(page);
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    const slot = page.locator('tcc-suite-menu').first();
    await slot.waitFor({ state: 'attached' });
    // The page's CSS reserves the box; measure once it applies, before the kit upgrades it.
    await page.waitForFunction(
      () => document.querySelector('tcc-suite-menu')?.getBoundingClientRect().width > 0
    );
    const before = await slot.boundingBox();
    await page.waitForFunction(() => window.TCC?.locker, null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('tcc-suite-menu')?.shadowRoot);
    const after = await slot.boundingBox();
    assert.deepEqual(
      [after.x, after.y, after.width, after.height].map(Math.round),
      [before.x, before.y, before.width, before.height].map(Math.round),
      `${path}: menu box changed size`
    );
    const script = await page.evaluate(() => {
      const node = document.querySelector(
        'script[src="https://thecreatingco.com/suite/v1/suite.js"]'
      );
      return {
        app: node?.dataset.app,
        count: document.querySelectorAll('script[src*="/suite/v1/suite.js"]').length,
        mode: window.TCC.locker.mode,
      };
    });
    assert.equal(script.app, app, `${path} data-app`);
    assert.equal(script.count, 1);
    assert.equal(script.mode, expectedMode, `${path} Locker mode`);
    await page.close();
  }
  log(
    `menu renders on ${PAGES.length} tool pages with the right data-app, no layout shift, Locker mode ${expectedMode}`
  );

  for (const path of ['/', '/hub', '/shop']) {
    const page = await context.newPage();
    await page.goto(`${base}${path}`, { waitUntil: 'load' });
    assert.equal(
      await page.locator('script[src*="/suite/v1/suite.js"]').count(),
      0,
      `${path} must not load the kit`
    );
    await page.close();
  }
  log('the shop and marketing pages do not load the kit');

  // 2. Export → Save to Locker (popup handoff), from Pocket.
  const page = await context.newPage();
  watch(page);
  await page.goto(`${base}/studio/pocket`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.TCC?.locker);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'WAV loop' }).click(),
  ]);
  const savedName = download.suggestedFilename();
  const offer = page.locator('.tcc-locker-offer');
  await offer.getByRole('button', { name: /Save to Locker/ }).click();
  await offer
    .getByText('Saved to your Locker')
    .waitFor({ timeout: 30000 })
    .catch(async (error) => {
      throw new Error(`${error.message}\nOffer says: ${await offer.textContent()}`);
    });
  log(`Pocket WAV "${savedName}" → Save to Locker → saved (${expectedMode})`);

  // The file is in the Locker on thecreatingco.com (first-party storage).
  const locker = await context.newPage();
  await locker.goto('https://thecreatingco.com/locker/', { waitUntil: 'networkidle' });
  await locker.waitForFunction(() => window.TCC?.locker);
  const entries = await locker.evaluate(() => window.TCC.locker.list());
  const entry = entries.find((item) => item.name === savedName);
  assert.ok(entry, 'saved file is listed in the Locker');
  assert.equal(entry.app, 'pocket');
  log(`thecreatingco.com/locker lists it (app "${entry.app}", ${entry.size} bytes)`);

  // 3. onOpen: open that file in Split with ?tcc-open= (popup mode without an opener → the kit's "Open file" prompt).
  const split = await context.newPage();
  watch(split);
  await split.goto(`${base}/studio/split?tcc-open=${encodeURIComponent(entry.id)}`, {
    waitUntil: 'networkidle',
  });
  const prompt = split.getByRole('button', { name: /open/i }).filter({ hasNotText: /StemDeck/ });
  const loaded = split.locator('.alab-card h2', { hasText: savedName });
  if (!(await loaded.isVisible().catch(() => false))) {
    // Partitioned origin: the kit asks for one click to fetch the file.
    await split.waitForTimeout(1500);
    const kitButton = split.locator('text=/^Open( file)?$/i').first();
    if (await kitButton.count()) await kitButton.click();
    else if (await prompt.count()) await prompt.first().click();
  }
  await loaded.waitFor({ timeout: 30000 });
  assert.ok(!split.url().includes('tcc-open'), 'kit removes ?tcc-open from the URL');
  log(`Split?tcc-open=… loads "${savedName}" from the Locker as the song to split`);

  // …and in StemDeck: it becomes the full mix of the first free deck.
  const deck = await context.newPage();
  watch(deck);
  await deck.goto(`${base}/studio?tcc-open=${encodeURIComponent(entry.id)}`, {
    waitUntil: 'networkidle',
  });
  const deckA = deck.locator('article[aria-label="Deck A"] .sd-deck-title');
  if (!(await deckA.isVisible().catch(() => false))) {
    await deck.waitForTimeout(1500);
    const kitButton = deck.locator('text=/^Open( file)?$/i').first();
    if (await kitButton.count()) await kitButton.click();
  }
  await deck.waitForFunction(
    (name) =>
      document
        .querySelector('article[aria-label="Deck A"] .sd-deck-title')
        ?.textContent.includes(name.replace(/\.wav$/, '')),
    savedName,
    { timeout: 60000 }
  );
  log(`StemDeck?tcc-open=… loads it into Deck A`);

  // Clean up the test file from the Locker.
  await locker.evaluate((id) => window.TCC.locker.remove(id), entry.id).catch(() => {});
  await context.close();

  // 4. Kit unreachable: the tools keep working, no menu errors, no Locker offer.
  const blocked = await browser.newContext({ acceptDownloads: true });
  await blocked.route('https://thecreatingco.com/**', (route) => route.abort());
  const offline = await blocked.newPage();
  const blockedErrors = [];
  offline.on('pageerror', (error) => blockedErrors.push(error.message));
  await offline.goto(`${base}/studio/pocket`, { waitUntil: 'networkidle' });
  const [blockedDownload] = await Promise.all([
    offline.waitForEvent('download'),
    offline.getByRole('button', { name: 'WAV loop' }).click(),
  ]);
  assert.ok(blockedDownload.suggestedFilename().endsWith('.wav'));
  await offline.waitForTimeout(1000);
  assert.equal(await offline.locator('.tcc-locker-offer').count(), 0);
  assert.deepEqual(blockedErrors, []);
  await offline.goto(`${base}/studio`, { waitUntil: 'networkidle' });
  await offline.locator('.sd-product-brand').waitFor();
  assert.deepEqual(blockedErrors, []);
  log('kit blocked: Pocket still exports, StemDeck opens, no errors, no Locker offer');
  await blocked.close();
} finally {
  await browser.close();
  await server?.close();
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS — suite menu + Locker');
