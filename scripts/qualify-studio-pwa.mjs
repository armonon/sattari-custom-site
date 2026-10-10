// Installable + offline check for the studio apps (StemDeck and the Sattari
// tools) against the production build. `npm run build` first, then:
//   node scripts/qualify-studio-pwa.mjs              (serves dist/ with vite preview)
//   STUDIO_PWA_URL=https://… node scripts/qualify-studio-pwa.mjs   (read-only checks
//     against a deployed site; skips the update test, which edits dist/)
// CHROME_PATH points Playwright at a local Chrome/Chromium binary.
//
// Checks: both manifests parse with installable fields and real icons; the
// worker installs with scope /studio and controls the studio pages but not
// the shop, hub or downloads pages; fully offline, all six studio pages open
// and Pocket still exports for Ableton; the caches hold no audio and nothing
// cross-origin except the suite menu script; a new deploy shows the update
// prompt and only takes over after "Reload".
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const local = !process.env.STUDIO_PWA_URL;
let server = null;
let base = process.env.STUDIO_PWA_URL?.replace(/\/$/, '');
if (local) {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: 5395, host: '127.0.0.1', strictPort: true } });
  base = 'http://127.0.0.1:5395';
}

const APP_PAGES = [
  ['/studio', 'STEMDECK'],
  ['/studio/split', 'Split'],
  ['/studio/keybpm', 'Key & BPM'],
  ['/studio/vox', 'Vox'],
  ['/studio/canvas', 'Canvas'],
  ['/studio/pocket', 'Pocket'],
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
});
const context = await browser.newContext({ acceptDownloads: true });
const errors = [];
const log = (line) => console.log(`  ✓ ${line}`);
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(`${page.url()} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Offline, requests the app makes on purpose to the network fail by design.
    if (/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(text)) return;
    errors.push(`${page.url()} console: ${text}`);
  });
};

async function manifest(page, href, expected) {
  const response = await page.request.get(`${base}${href}`);
  assert.equal(response.status(), 200, `${href} status`);
  const data = await response.json();
  for (const [key, value] of Object.entries(expected))
    assert.equal(data[key], value, `${href} ${key}`);
  assert.equal(data.display, 'standalone');
  const sizes = new Set();
  for (const icon of data.icons) {
    const image = await page.request.get(`${base}${icon.src}`);
    assert.equal(image.status(), 200, icon.src);
    sizes.add(`${icon.sizes}/${icon.purpose}`);
  }
  for (const needed of ['192x192/any', '512x512/any', '512x512/maskable'])
    assert.ok(sizes.has(needed), `${href} needs a ${needed} icon`);
  return data;
}

try {
  const page = await context.newPage();
  watch(page);

  // Manifests and route scoping of the <link rel="manifest">.
  await manifest(page, '/studio.webmanifest', {
    name: 'StemDeck',
    scope: '/studio',
    id: '/studio',
  });
  const sattari = await manifest(page, '/studio/sattari.webmanifest', {
    name: 'Sattari',
    scope: '/studio/',
  });
  assert.equal(sattari.shortcuts.length, 5);
  log(
    'manifests: StemDeck (scope /studio) and Sattari (scope /studio/, 5 shortcuts), icons resolve'
  );

  const manifestHref = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    return page
      .locator('link[rel="manifest"]')
      .first()
      .getAttribute('href', { timeout: 2000 })
      .catch(() => null);
  };
  assert.equal(await manifestHref('/studio'), '/studio.webmanifest');
  assert.equal(await manifestHref('/studio/pocket'), '/studio/sattari.webmanifest');
  assert.equal(await manifestHref('/hub'), null);
  assert.equal(await manifestHref('/press'), null);
  log('only /studio and /studio/* pages link a manifest (not /hub, /press)');

  // Install the worker from /studio, then reload so it controls the page.
  await page.goto(`${base}/studio`, { waitUntil: 'load' });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  assert.equal(new URL(scope).pathname, '/studio');
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.some((key) => key.startsWith('sattari-studio-shell-'));
  });
  await page.reload({ waitUntil: 'load' });
  assert.ok(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    'controls /studio'
  );
  log(`worker active, scope ${new URL(scope).pathname}, controls /studio`);

  for (const path of ['/', '/hub', '/shop', '/downloads']) {
    const other = await context.newPage();
    await other.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
    assert.equal(
      await other.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      false,
      `${path} must not be controlled`
    );
    await other.close();
  }
  log('/, /hub, /shop and /downloads are not controlled by the worker');

  // Fully offline. Every same-origin app file must come from the worker.
  await context.setOffline(true);
  const offlineFailures = [];
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const reason = request.failure()?.errorText || '';
    if (url.origin === new URL(base).origin && /^\/(assets|fonts)\//.test(url.pathname))
      offlineFailures.push(`${url.pathname} ${reason}`);
  });
  for (const [path, heading] of APP_PAGES) {
    const response = await page.goto(`${base}${path}`, { waitUntil: 'load' });
    assert.ok(response?.ok(), `${path} offline status ${response?.status()}`);
    if (path === '/studio') await page.locator('.sd-product-brand').waitFor({ timeout: 15000 });
    else await page.locator('h1', { hasText: heading }).waitFor({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
  }
  assert.deepEqual(offlineFailures, [], 'app files missing offline');
  log('offline: /studio, /studio/split, /keybpm, /vox, /canvas, /pocket open with all their code');

  await page.goto(`${base}/studio/pocket`, { waitUntil: 'networkidle' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: 'Export for Ableton' }).click(),
  ]).catch(async (error) => {
    throw new Error(
      `${error.message} — status: ${await page.locator('.lab-status').textContent()}`
    );
  });
  assert.match(download.suggestedFilename(), /\(Ableton Live Set\)\.zip$/);
  log(`offline: Pocket → Export for Ableton → ${download.suggestedFilename()}`);

  const offlineHub = await context.newPage();
  const hubResponse = await offlineHub.goto(`${base}/hub`).catch(() => null);
  assert.ok(!hubResponse?.ok(), '/hub must not be served offline by the studio worker');
  await offlineHub.close();
  log('offline: /hub is not served from the studio caches (out of scope)');
  await context.setOffline(false);

  // Nothing user-shaped in the caches.
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys()) out.push([name, request.url]);
    return out;
  });
  const bad = cached.filter(
    ([, url]) =>
      /\.(wav|mp3|m4a|flac|ogg|aiff?|onnx|mp4|webm)(\?|$)/i.test(url) ||
      (!url.startsWith(base) && !url.startsWith('https://thecreatingco.com/suite/v1/'))
  );
  assert.deepEqual(bad, [], 'no audio, models or cross-origin data in caches');
  log(`caches hold ${cached.length} entries: app files only, no audio/models/user data`);

  if (process.env.SPLIT_OFFLINE) {
    // Opt-in offline Split, end to end: save the model + runtime online, then
    // split a song with the network off. Downloads the 172 MB model.
    await page.goto(`${base}/studio/split`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Make Split available offline' }).click();
    await page
      .getByText('Split works offline in this browser')
      .waitFor({ timeout: 15 * 60 * 1000 });
    log('Split: model and runtime saved for offline on request');
    await context.setOffline(true);
    await page.goto(`${base}/studio/split`, { waitUntil: 'networkidle' });
    const rate = 44100;
    const frames = rate * 6;
    const wav = Buffer.alloc(44 + frames * 2);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + frames * 2, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(frames * 2, 40);
    for (let i = 0; i < frames; i++) {
      const t = i / rate;
      const kick = Math.sin(2 * Math.PI * 55 * (t % 0.5)) * Math.exp(-(t % 0.5) / 0.07);
      const tone = 0.3 * Math.sin(2 * Math.PI * 440 * t);
      wav.writeInt16LE(
        Math.round(Math.max(-1, Math.min(1, 0.6 * kick + tone)) * 32767),
        44 + i * 2
      );
    }
    await page.locator('.alab-file-input').setInputFiles({
      name: 'offline-test.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    });
    await page.getByRole('button', { name: 'Split into stems' }).click();
    await page.locator('.alab-mixer').waitFor({ timeout: 15 * 60 * 1000 });
    log('Split: separated a song into stems with the network off');
    await context.setOffline(false);
    await page.goto(`${base}/studio/split`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Remove offline Split' }).click();
    await page.getByRole('button', { name: 'Make Split available offline' }).waitFor();
    log('Split: "Remove offline Split" frees the space again');
  }

  if (local) {
    // A new deploy: change the worker's bytes as a deploy would.
    const swPath = new URL('../dist/studio-sw.js', import.meta.url);
    const original = await readFile(swPath, 'utf8');
    try {
      await writeFile(swPath, `${original}\n// qualify-studio-pwa update test ${Date.now()}\n`);
      await page.goto(`${base}/studio/pocket`, { waitUntil: 'load' });
      await page.evaluate(async () =>
        (await navigator.serviceWorker.getRegistration('/studio')).update()
      );
      const toast = page.locator('.studio-pwa-toast', { hasText: 'new version' });
      await toast.waitFor({ timeout: 30000 });
      const before = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
      assert.ok(before);
      log('update: "A new version is ready" appears; old worker keeps control until Reload');
      await Promise.all([
        page.waitForEvent('load'),
        toast.getByRole('button', { name: 'Reload' }).click(),
      ]);
      await page.waitForFunction(async () => {
        const registration = await navigator.serviceWorker.getRegistration('/studio');
        return !registration.waiting && registration.active === navigator.serviceWorker.controller;
      });
      log('update: Reload activates the new worker and reloads the page');
    } finally {
      await writeFile(swPath, original);
    }
  }
} finally {
  await context.close();
  await browser.close();
  await server?.close();
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS — studio PWA');
