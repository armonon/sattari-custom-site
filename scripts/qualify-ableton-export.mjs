// Browser check for "Export for Ableton" in Pocket and StemDeck: clicks the
// real buttons, catches the downloads, unzips them and checks the Live Set.
//   node scripts/qualify-ableton-export.mjs               (starts a Vite dev server)
//   ABLETON_QA_URL=https://… node scripts/qualify-ableton-export.mjs
// ABLETON_QA_OUTPUT (default /tmp/sattari-ableton-qa) receives the unzipped
// projects, ready to open in Ableton Live for a by-hand check.
// CHROME_PATH points Playwright at a local Chrome/Chromium binary.
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync, strFromU8, unzipSync } from 'fflate';
import { chromium } from 'playwright';

const output = process.env.ABLETON_QA_OUTPUT || '/tmp/sattari-ableton-qa';
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let server = null;
let base = process.env.ABLETON_QA_URL;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5393, host: '127.0.0.1', strictPort: true } });
  await server.listen();
  base = 'http://127.0.0.1:5393';
}

/** 8 s at 120 BPM: a kick on every beat, as 16-bit mono WAV. */
async function testTrack(name, frequency) {
  const rate = 44100;
  const frames = rate * 8;
  const data = Buffer.alloc(44 + frames * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + frames * 2, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const t = (i % (rate / 2)) / rate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / 0.08) * 0.8;
    data.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  const path = join(output, name);
  await writeFile(path, data);
  return path;
}

async function unpack(download, label) {
  const zipPath = join(output, `${label}.zip`);
  await download.saveAs(zipPath);
  const files = unzipSync(new Uint8Array(await readFile(zipPath)));
  for (const [path, data] of Object.entries(files)) {
    const target = join(output, label, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  const setPath = Object.keys(files).find((path) => path.endsWith('.als'));
  assert.ok(setPath, `${label}: no .als in the ZIP`);
  const xml = strFromU8(gunzipSync(files[setPath]));
  const tempo = /<Tempo>\s*<LomId Value="0" \/>\s*<Manual Value="([^"]+)"/.exec(xml)?.[1];
  // The first UserName after each <AudioTrack> is the track's own name.
  const tracks = [...xml.matchAll(/<AudioTrack [^>]*>[\s\S]*?<UserName Value="([^"]*)" \/>/g)].map(
    (match) => match[1]
  );
  const clips = (xml.match(/<AudioClip /g) || []).length;
  const wavs = Object.keys(files).filter((path) => path.endsWith('.wav'));
  return { name: download.suggestedFilename(), setPath, tempo, tracks, clips, wavs, xml };
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
const results = {};
try {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('console', (message) => {
    // Failed requests are reported above with their URL.
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text()))
      errors.push(`console: ${message.text()}`);
  });

  // Pocket: the starter pattern, 120 BPM by default.
  await page.goto(`${base}/studio/pocket`, { waitUntil: 'networkidle' });
  const pocketBpm = Number(
    (await page.locator('output').filter({ hasText: 'BPM' }).first().textContent()).match(/\d+/)[0]
  );
  const [pocketDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: 'Export for Ableton' }).click(),
  ]);
  results.pocket = await unpack(pocketDownload, 'pocket');
  assert.equal(Number(results.pocket.tempo), pocketBpm, 'Pocket tempo');
  assert.ok(results.pocket.clips >= 2, 'Pocket clips');
  assert.equal(results.pocket.clips, results.pocket.wavs.length, 'one clip per WAV');
  assert.ok(results.pocket.tracks.includes('Pocket mix'));

  // StemDeck: a full mix and a drum stem on Deck A.
  const mix = await testTrack('Groove Test.wav', 55);
  const drums = await testTrack('Groove Test drums.wav', 90);
  await page.goto(`${base}/studio`, { waitUntil: 'networkidle' });
  await page
    .getByRole('navigation', { name: 'STEMDECK workspaces' })
    .getByRole('button', { name: 'Perform' })
    .click();
  // Drop the full mix on the empty performance area, as a user would.
  const mixBytes = (await readFile(mix)).toString('base64');
  await page.locator('.sd-empty-performance').evaluate((target, base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'Groove Test.wav', { type: 'audio/wav' }));
    target.dispatchEvent(
      new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
    );
  }, mixBytes);
  const deckA = page.locator('article[aria-label="Deck A"]');
  await deckA.waitFor({ timeout: 60000 });
  const inputs = deckA.locator('input[type="file"]');
  await page.waitForFunction(
    () =>
      !/Empty deck/.test(
        document.querySelector('article[aria-label="Deck A"] .sd-deck-title')?.textContent || ''
      ),
    null,
    { timeout: 60000 }
  );
  await inputs.nth(1).setInputFiles(drums); // drums lane
  await page.waitForTimeout(3000);
  await deckA
    .getByRole('navigation', { name: 'Deck A tools' })
    .getByRole('button', { name: 'STEMS' })
    .click();
  const [deckDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    deckA.getByRole('button', { name: 'Ableton' }).click(),
  ]);
  results.stemdeck = await unpack(deckDownload, 'stemdeck');
  assert.deepEqual(results.stemdeck.tracks, ['Drums', 'Full mix'], 'StemDeck tracks');
  assert.ok(Number(results.stemdeck.tempo) > 0, 'StemDeck tempo');
  assert.equal(results.stemdeck.clips, 2);
  await context.close();
} finally {
  await browser.close();
  await server?.close();
}

for (const [label, result] of Object.entries(results)) {
  console.log(
    `${label}: ${result.name} → ${result.setPath} · tempo ${result.tempo} · tracks ${result.tracks.join(', ')} · ${result.wavs.length} WAVs`
  );
}
// The Vite dev server has no Netlify functions, so /api/* 404s there.
const realErrors = errors.filter(
  (text) => !/favicon/.test(text) && !(server && /^HTTP 404 .*\/api\//.test(text))
);
if (realErrors.length) {
  console.error(realErrors.join('\n'));
  process.exit(1);
}
console.log(`PASS — unzipped projects in ${output}`);
