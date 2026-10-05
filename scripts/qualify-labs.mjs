// Browser smoke test for the wave-2 alpha tools (Canvas, Pocket, Press) against
// the production build. Run `npm run build` first, then:
//   node scripts/qualify-labs.mjs            (starts `vite preview` itself)
//   LABS_QA_URL=https://deploy-preview… node scripts/qualify-labs.mjs
// PLAYWRIGHT_CHANNEL=chrome uses an installed Chrome instead of Playwright's.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const output = process.env.LABS_QA_OUTPUT || '/tmp/sattari-labs-qa';
await mkdir(output, { recursive: true });

let server = null;
let base = process.env.LABS_QA_URL;
if (!base) {
  server = await preview({ preview: { port: 5391, host: '127.0.0.1' } });
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

/** A 4 s, 120 BPM test track: synthetic kicks over quiet noise, as 16-bit WAV. */
async function testTrack() {
  const rate = 44100;
  const frames = rate * 4;
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
  let seed = 1;
  for (let i = 0; i < frames; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const t = (i % (rate / 2)) / rate;
    const sample =
      Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t / 0.07) * 0.8 +
      ((seed / 2 ** 32) * 2 - 1) * 0.02;
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2);
  }
  const path = `${output}/kick-test.wav`;
  await writeFile(path, data);
  return path;
}

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const results = [];

async function open(path, width) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}${path}`, { timeout: 120000 });
  await page.getByRole('heading', { level: 1 }).waitFor();
  const heading = await page.getByRole('heading', { level: 1 }).textContent();
  assert.match(heading, /Alpha/, `${path}: heading must say Alpha`);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
    `${path} @${width}: horizontal overflow`
  );
  assert.match(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    /noindex/,
    `${path}: alpha tools stay noindex`
  );
  return { context, page, errors };
}

async function download(page, click) {
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), click()]);
  const path = `${output}/${file.suggestedFilename()}`;
  await file.saveAs(path);
  return { name: file.suggestedFilename(), bytes: await readFile(path) };
}

try {
  for (const width of [1280, 390]) {
    // ---- Canvas ----
    {
      const { context, page, errors } = await open('/studio/canvas', width);
      await page.getByLabel('Track').setInputFiles(await testTrack());
      await page.getByText(/kicks detected/).waitFor();
      const status = await page.locator('p.lab-status[role="status"]').textContent();
      const kicks = Number(status.match(/(\d+) kicks/)[1]);
      assert.ok(kicks >= 6 && kicks <= 9, `Canvas: expected ~8 kicks, got ${kicks}`);
      for (const scene of ['Chladni', 'Ripple', 'Lattice', 'Horizon', 'Pulse']) {
        await page.getByRole('button', { name: scene, exact: true }).click();
        await page.waitForTimeout(250);
        const lit = await page.locator('canvas').evaluate((canvas) => {
          const ctx = canvas.getContext('2d');
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let sum = 0;
          for (let i = 0; i < data.length; i += 4 * 97) sum += data[i] + data[i + 1] + data[i + 2];
          return sum;
        });
        assert.ok(lit > 1000, `Canvas: ${scene} drew nothing`);
        if (width === 1280)
          await page.locator('canvas').screenshot({ path: `${output}/canvas-${scene}.png` });
      }
      await page.getByRole('button', { name: '4 s', exact: true }).click();
      const video = await download(page, () =>
        page.getByRole('button', { name: /Export 4 s loop/ }).click()
      );
      assert.match(video.name, /\.(mp4|webm)$/);
      assert.ok(video.bytes.length > 20000, `Canvas: video only ${video.bytes.length} bytes`);
      results.push(
        `Canvas @${width}: ${kicks} kicks, ${video.name} ${(video.bytes.length / 1e6).toFixed(2)} MB`
      );
      await page.screenshot({ path: `${output}/canvas-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
    }

    // ---- Pocket ----
    {
      const { context, page, errors } = await open('/studio/pocket', width);
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.locator('.pocket-step.is-playhead').first().waitFor();
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      const wav = await download(page, () =>
        page.getByRole('button', { name: /WAV loop/ }).click()
      );
      assert.equal(wav.bytes.toString('ascii', 0, 4), 'RIFF');
      // 2 bars at 92 BPM, stereo 24-bit at 44.1 kHz.
      const expected = Math.round((60 / 92) * 8 * 44100) * 2 * 3 + 44;
      assert.ok(
        Math.abs(wav.bytes.length - expected) <= 6,
        `Pocket: WAV ${wav.bytes.length} vs ${expected}`
      );
      const zip = await download(page, () => page.getByRole('button', { name: /Stems/ }).click());
      assert.equal(zip.bytes.readUInt32LE(0), 0x04034b50);
      await page.getByRole('button', { name: /Send to StemDeck/ }).click();
      await page.getByText(/Added \d+ files to the StemDeck Library/).waitFor();
      const libraryTracks = await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const request = indexedDB.open('sattari-music-library-v1');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const all = request.result.transaction('tracks').objectStore('tracks').getAll();
              all.onsuccess = () => resolve(all.result.map((track) => track.path));
            };
          })
      );
      assert.ok(libraryTracks.some((path) => path.startsWith('Pocket/')));
      results.push(
        `Pocket @${width}: WAV ${wav.bytes.length} B, ZIP ${zip.bytes.length} B, ${libraryTracks.length} files in StemDeck library`
      );
      await page.screenshot({ path: `${output}/pocket-${width}.png`, fullPage: true });
      if (width === 1280) {
        await page.getByRole('link', { name: /Open StemDeck Library/ }).click();
        await page.waitForURL(/\/studio$/);
        await page
          .getByRole('tab', { name: /Library/ })
          .or(page.getByRole('button', { name: /^Library$/ }))
          .first()
          .click();
        await page
          .getByText(/starter-groove-kick/i)
          .first()
          .waitFor({ timeout: 20000 });
        await page.screenshot({ path: `${output}/pocket-to-stemdeck.png` });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }

    // ---- Press ----
    {
      const { context, page, errors } = await open('/press', width);
      await page.getByLabel('Artist or band name').fill('Nova Lane');
      await page.getByLabel('Title 1').fill('First single');
      await page.getByLabel(/URL 1/).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.getByLabel('Booking email').fill('book@example.com');
      await page.waitForTimeout(600);
      const frame = page.frameLocator('iframe[title="Press kit preview"]');
      await frame.getByRole('heading', { name: 'Nova Lane' }).waitFor();
      const html = await download(page, () =>
        page.getByRole('button', { name: /Download HTML/ }).click()
      );
      const text = html.bytes.toString('utf8');
      assert.match(text, /<h1>Nova Lane<\/h1>/);
      assert.match(text, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
      assert.doesNotMatch(text, /<script/i);
      results.push(`Press @${width}: ${html.name} ${text.length} chars`);
      await page.screenshot({ path: `${output}/press-${width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
    }
  }

  // Hub lists the labs.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    await page.goto(`${base}/hub`, { timeout: 120000 });
    for (const name of ['Canvas', 'Pocket', 'Press'])
      await page
        .locator('.hub-labs')
        .getByRole('link', { name: new RegExp(name) })
        .waitFor();
    await page.locator('.hub-labs').screenshot({ path: `${output}/hub-labs.png` });
    await context.close();
  }
  console.log(results.join('\n'));
  console.log(`PASS: labs smoke test. Screenshots in ${output}`);
} finally {
  await browser.close();
  await server?.close();
}
