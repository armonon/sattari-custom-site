// End-to-end qualification of the two flagship tools against a served build.
//
//   npm run build && npx vite preview --host 127.0.0.1 --port 4310 --strictPort
//   FLAGSHIP_URL=http://127.0.0.1:4310 node scripts/qualify-flagship-tools.mjs
//
// Runs the real HTDemucs model on the approved 8-second Sattari demo, renders
// a drumless mix, re-imports the downloaded WAV and compares it with the sum of
// the downloaded stems, unpacks the song ZIP, continues into Key & BPM, applies
// corrections, round-trips a report in a fresh context, checks reload recovery
// and Clear saved work, and captures screenshots at phone/tablet/desktop widths.
// FLAGSHIP_DEVICE=auto uses the automatic (GPU-if-available) path; default CPU.
// This is a functional check, not a listening test or device qualification.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { parseWav } from '../src/utils/stemMix.js';
import { wavBytes } from '../src/utils/arrangementExport.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.FLAGSHIP_URL || 'http://127.0.0.1:4310').replace(/\/$/, '');
const out = process.env.FLAGSHIP_QA_DIR || '/tmp/sattari-flagship-qa';
const device = process.env.FLAGSHIP_DEVICE === 'auto' ? 'auto' : 'cpu';
const inferenceTimeout = Number(process.env.FLAGSHIP_TIMEOUT_MS || 45 * 60 * 1000);
await mkdir(out, { recursive: true });

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const check = async (name, fn) => {
  try {
    const detail = await fn();
    record(name, true, detail || '');
  } catch (error) {
    record(name, false, error.message);
  }
};
const toArrayBuffer = (buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const readDownload = async (download) => {
  const path = `${out}/${download.suggestedFilename()}`;
  await download.saveAs(path);
  return { path, name: download.suggestedFilename(), bytes: await readFile(path) };
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
const environment = {
  browser: `chromium ${browser.version()}`,
  platform: process.platform,
  device,
  startedAt: new Date().toISOString(),
};

try {
  await page.goto(`${base}/stem-separator`);
  await page.getByRole('heading', { name: /Stem Separator/ }).waitFor({ timeout: 120000 });
  environment.webgpu = await page.evaluate(async () =>
    Boolean(await navigator.gpu?.requestAdapter?.().catch(() => null))
  );
  for (const [label, width, height] of [
    ['phone', 390, 844],
    ['tablet', 768, 1024],
    ['desktop', 1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${out}/separator-empty-${label}.png`, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    record(
      `separator first screen fits ${label} (${width}px)`,
      overflow <= 0,
      `overflow ${overflow}px`
    );
  }

  if (device === 'cpu') {
    await page.getByText('Processing options').click();
    await page.getByLabel('Processing device').selectOption('cpu');
  }
  await page.getByRole('radio', { name: /Drum practice/ }).check();
  const started = Date.now();
  await page.getByRole('button', { name: /Try the 8-second example/ }).click();
  await page
    .getByRole('button', { name: 'Download my mix' })
    .waitFor({ timeout: inferenceTimeout });
  await page.getByRole('button', { name: 'Download my mix' }).isEnabled();
  await page.waitForFunction(
    () => !document.querySelector('.stem-player-play svg.stem-player-spin'),
    null,
    { timeout: 120000 }
  );
  environment.separationSeconds = Math.round((Date.now() - started) / 1000);
  record(
    'real HTDemucs separation of the demo',
    true,
    `${environment.separationSeconds}s on ${device}`
  );
  await page.screenshot({ path: `${out}/separator-player-desktop.png`, fullPage: true });

  await check('drum practice preset is active with drums muted', async () => {
    assert.equal(
      await page.getByRole('button', { name: 'Drum practice' }).getAttribute('aria-pressed'),
      'true'
    );
    assert.equal(
      await page.getByRole('button', { name: 'Mute drums' }).getAttribute('aria-pressed'),
      'true'
    );
  });

  // Download every stem from the player lanes (actual WAV links).
  const stems = {};
  for (const id of ['Vocals', 'Drums', 'Bass', 'Other instruments']) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .locator('.stem-player')
        .getByRole('link', { name: `Download ${id} WAV` })
        .click(),
    ]);
    stems[id] = parseWav(toArrayBuffer((await readDownload(download)).bytes));
  }
  await check('stems are 44.1 kHz stereo, equal length', async () => {
    const lengths = new Set(Object.values(stems).map((stem) => stem.channels[0].length));
    for (const stem of Object.values(stems)) {
      assert.equal(stem.sampleRate, 44100);
      assert.equal(stem.channels.length, 2);
      assert.equal(stem.float, true);
    }
    assert.equal(lengths.size, 1);
    return `${[...lengths][0]} frames, 32-bit float`;
  });

  await page
    .locator('.stem-player-peak')
    .filter({ hasText: /Mix peak/ })
    .waitFor({ timeout: 60000 });
  const peakText = await page.locator('.stem-player-peak').textContent();
  const [mixDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download my mix' }).click(),
  ]);
  const mixFile = await readDownload(mixDownload);
  const mix = parseWav(toArrayBuffer(mixFile.bytes));
  await check('mix file is named for its content', async () => {
    assert.match(mixFile.name, /-drumless-mix\.wav$/);
    return mixFile.name;
  });
  await check('downloaded mix equals vocals + bass + other, sample for sample', async () => {
    const frames = stems.Vocals.channels[0].length;
    assert.equal(mix.sampleRate, 44100);
    assert.equal(mix.channels.length, 2);
    assert.equal(mix.channels[0].length, frames);
    let maxError = 0;
    let energy = 0;
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < frames; i++) {
        const expected =
          stems.Vocals.channels[c][i] +
          stems.Bass.channels[c][i] +
          stems['Other instruments'].channels[c][i];
        maxError = Math.max(maxError, Math.abs(mix.channels[c][i] - expected));
        energy += mix.channels[c][i] ** 2;
      }
    assert(maxError < 1e-6, `max error ${maxError}`);
    assert(energy > 0, 'mix is silent');
    return `max |error| ${maxError.toExponential(2)}; UI ${peakText.trim()}`;
  });
  await check('mix excludes the drum stem', async () => {
    const frames = stems.Vocals.channels[0].length;
    let withDrums = 0;
    for (let i = 0; i < frames; i += 7)
      withDrums = Math.max(
        withDrums,
        Math.abs(
          mix.channels[0][i] -
            (stems.Vocals.channels[0][i] +
              stems.Bass.channels[0][i] +
              stems['Other instruments'].channels[0][i] +
              stems.Drums.channels[0][i])
        )
      );
    assert(withDrums > 1e-4, 'drums appear to be included');
  });
  await check('downloaded mix plays back in the browser', async () => {
    const played = await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
      audio.muted = true;
      await audio.play();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const result = { duration: audio.duration, time: audio.currentTime };
      audio.pause();
      return result;
    }, mixFile.bytes.toString('base64'));
    assert(played.time > 0.2, `currentTime ${played.time}`);
    return `duration ${played.duration.toFixed(2)}s, advanced to ${played.time.toFixed(2)}s`;
  });

  await check('all-muted mix cannot be exported', async () => {
    for (const name of ['Vocals', 'Bass', 'Other instruments'])
      await page.getByRole('button', { name: `Mute ${name}`, exact: true }).click();
    assert(await page.getByRole('button', { name: 'Download my mix' }).isDisabled());
    await page.getByRole('button', { name: 'All parts' }).click();
    assert(await page.getByRole('button', { name: 'Download my mix' }).isEnabled());
  });

  const setPosition = (seconds) =>
    page.getByLabel('Playback position').evaluate((input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, seconds);

  await check('beat grid is found on the demo at its tempo', async () => {
    const status = page.locator('.stem-player-grid-status');
    await status.filter({ hasText: /Beat grid|No steady beat/ }).waitFor({ timeout: 120000 });
    const text = await status.textContent();
    const bpm = Number(/([\d.]+) BPM/.exec(text)?.[1]);
    assert(Math.abs(bpm - 120) / 120 < 0.04, text);
    assert(await page.getByLabel('Count-in (1 bar)').isEnabled());
    return text;
  });

  await check('75% speed plays and downloads a longer mix through the stretch worker', async () => {
    await page.getByLabel('Playback speed').evaluate((input) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '0.75');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByText(/Practice playback/).waitFor({ timeout: 300000 });
    await page.getByLabel(/Use my speed/).check();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.getByRole('button', { name: 'Download my mix' }).click(),
    ]);
    const file = await readDownload(download);
    const slow = parseWav(toArrayBuffer(file.bytes));
    const expected = Math.round(mix.channels[0].length / 0.75);
    assert.match(file.name, /-75pct-/);
    assert(
      Math.abs(slow.channels[0].length - expected) <= 4,
      `${slow.channels[0].length} vs ${expected}`
    );
    let energy = 0;
    for (const value of slow.channels[0]) energy += value * value;
    assert(energy > 0, 'silent');
    await page.getByLabel(/Use my speed/).uncheck();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    return `${file.name}: ${slow.channels[0].length} frames (expected ${expected})`;
  });

  await check('A–B loop export equals the same frames of the full mix', async () => {
    await page.getByRole('button', { name: 'Drum practice' }).click();
    // Exact-frame comparison: turn beat snapping off (unit tests cover snapping).
    if (await page.getByLabel('Snap A–B to beats').isChecked())
      await page.getByLabel('Snap A–B to beats').uncheck();
    await setPosition(2);
    await page.getByRole('button', { name: /^Set A/ }).click();
    await setPosition(4);
    await page.getByRole('button', { name: /^Set B/ }).click();
    await page.getByLabel('Length of the mix').selectOption('loop');
    await page.getByLabel('Mix file format').selectOption('float32');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download my mix' }).click(),
    ]);
    const file = await readDownload(download);
    const loop = parseWav(toArrayBuffer(file.bytes));
    assert.match(file.name, /-drumless-loop-0m02s-0m04s\.wav$/);
    assert.equal(loop.channels[0].length, 2 * 44100);
    let maxError = 0;
    for (let i = 0; i < loop.channels[0].length; i++)
      maxError = Math.max(maxError, Math.abs(loop.channels[0][i] - mix.channels[0][2 * 44100 + i]));
    assert(maxError < 1e-6, `max error ${maxError}`);
    return `${file.name}, ${loop.channels[0].length} frames, max |error| ${maxError.toExponential(2)}`;
  });

  await check('M4A/AAC export decodes back to the same mix level and length', async () => {
    await page.getByLabel('Length of the mix').selectOption('full');
    const enabled = await page
      .getByLabel('Mix file format')
      .locator('option[value="aac"]')
      .evaluate((option) => !option.disabled);
    if (!enabled) throw new Error('This browser reports no AAC encoder');
    await page.getByLabel('Mix file format').selectOption('aac');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.getByRole('button', { name: 'Download my mix' }).click(),
    ]);
    const file = await readDownload(download);
    assert.match(file.name, /-drumless-mix\.m4a$/);
    const decoded = await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const context = new OfflineAudioContext(2, 1, 44100);
      const buffer = await context.decodeAudioData(bytes.buffer);
      const data = buffer.getChannelData(0);
      let sum = 0;
      for (const value of data) sum += value * value;
      return {
        duration: buffer.duration,
        rms: Math.sqrt(sum / data.length),
        rate: buffer.sampleRate,
      };
    }, file.bytes.toString('base64'));
    let sum = 0;
    for (const value of mix.channels[0]) sum += value * value;
    const wavRms = Math.sqrt(sum / mix.channels[0].length);
    const levelDb = 20 * Math.log10(decoded.rms / wavRms);
    assert(Math.abs(decoded.duration - 8) < 0.1, `duration ${decoded.duration}`);
    assert(Math.abs(levelDb) < 1, `level differs by ${levelDb.toFixed(2)} dB`);
    await page.getByLabel('Mix file format').selectOption('float32');
    return `${file.name}, ${(file.bytes.length / 1024).toFixed(0)} KB vs ${(mixFile.bytes.length / 1024).toFixed(0)} KB WAV, ${decoded.duration.toFixed(3)}s, level ${levelDb.toFixed(2)} dB`;
  });

  await check('song ZIP contains this song’s four stems and report', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Song ZIP' }).click(),
    ]);
    const zip = unzipSync(new Uint8Array((await readDownload(download)).bytes));
    const names = Object.keys(zip);
    for (const part of ['vocals', 'drums', 'bass', 'instruments'])
      assert(
        names.some((name) => name.includes(`sattari-practice-demo-${part}.wav`)),
        part
      );
    return names.join(', ');
  });

  await check('one preset for every song downloads a ZIP of practice mixes', async () => {
    const seconds = 50; // long enough for the 20-second preview pass
    const samples = Float32Array.from({ length: seconds * 44100 }, (_, i) => {
      const t = i / 44100;
      return (
        0.2 * Math.sin(2 * Math.PI * 110 * t) +
        0.15 * Math.exp(-(t % 0.5) * 30) * Math.sin(2 * Math.PI * 60 * t)
      );
    });
    await page.getByLabel('Add audio tracks').setInputFiles({
      name: 'second-song.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from(
        wavBytes({
          sampleRate: 44100,
          length: samples.length,
          numberOfChannels: 2,
          getChannelData: () => samples,
        })
      ),
    });
    await page.getByRole('button', { name: 'Separate 1 song' }).click();
    await page.getByText(/^Preview · /).waitFor({ timeout: inferenceTimeout });
    record('a 20-second preview is playable before the whole song finishes', true);
    await page.screenshot({ path: `${out}/separator-preview-desktop.png`, fullPage: true });
    await page.getByText('2 of 2 songs ready').waitFor({ timeout: inferenceTimeout });
    await page.getByLabel(/Same practice mix for all 2 songs/).selectOption('no-bass');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 300000 }),
      page.getByRole('button', { name: 'Download mixes ZIP' }).click(),
    ]);
    const zip = unzipSync(new Uint8Array((await readDownload(download)).bytes));
    const names = Object.keys(zip);
    assert(
      names.some((name) => name.endsWith('sattari-practice-demo-bassless-mix.wav')),
      names.join()
    );
    assert(
      names.some((name) => name.endsWith('second-song-bassless-mix.wav')),
      names.join()
    );
    const demo = parseWav(
      toArrayBuffer(
        Buffer.from(zip[names.find((name) => name.includes('sattari-practice-demo-bassless'))])
      )
    );
    let maxError = 0;
    for (let i = 0; i < demo.channels[0].length; i += 3)
      maxError = Math.max(
        maxError,
        Math.abs(
          demo.channels[0][i] -
            (stems.Vocals.channels[0][i] +
              stems.Drums.channels[0][i] +
              stems['Other instruments'].channels[0][i])
        )
      );
    assert(maxError < 1e-6, `max error ${maxError}`);
    return `${names.join(', ')}; demo mix max |error| ${maxError.toExponential(2)}`;
  });

  await check('saved song survives a reload', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Download my mix' }).waitFor({ timeout: 120000 });
  });

  // Page-level overflow is not enough: a component can be clipped inside a
  // column that itself fits. Every player control must stay within the player.
  for (const [label, width, height] of [
    ['phone', 390, 844],
    ['tablet', 768, 1024],
    ['small laptop', 1024, 768],
    ['desktop', 1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    const clipped = await page.evaluate(() => {
      const player = document.querySelector('.stem-player');
      const box = player.getBoundingClientRect();
      return [...player.querySelectorAll('button, input, select, a, canvas')]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.right > box.right + 1 || rect.left < box.left - 1);
        })
        .map(
          (element) =>
            element.getAttribute('aria-label') || element.textContent.trim() || element.tagName
        )
        .slice(0, 6);
    });
    record(
      `player controls fit inside the player at ${label} (${width}px)`,
      clipped.length === 0,
      clipped.join(', ')
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/separator-player-phone.png`, fullPage: true });
  record(
    'separator player fits phone width',
    (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: `${out}/separator-player-tablet.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Continue with the original song in Key & BPM (same-tab handoff).
  await page.getByRole('button', { name: 'Check key & BPM' }).first().click();
  await page.waitForURL(/\/studio\/keybpm$/);
  await check('Key & BPM shows the transferred source and measures it', async () => {
    await page.getByText(/Added from Stem Separator/).waitFor({ timeout: 30000 });
    await page.locator('tr[data-status="done"]').first().waitFor({ timeout: 300000 });
    return (await page.locator('tr[data-status="done"]').first().textContent()).replace(
      /\s+/g,
      ' '
    );
  });
  await check('Key & BPM route did not request the separation model', async () => {
    const entries = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => entry.name)
    );
    assert(
      !entries.some((name) => /htdemucs|ort-wasm|stemSeparator\.worker/.test(name)),
      'model requested'
    );
  });
  await check('half time correction keeps the detection', async () => {
    const row = page.locator('tr[data-status="done"]').first();
    const before = await row.locator('td').nth(3).textContent();
    await page
      .getByRole('button', { name: /Adjust key and tempo/ })
      .first()
      .click();
    await page.getByRole('button', { name: /Half time/ }).click();
    const after = await row.locator('td').nth(3).textContent();
    assert.match(after, /half time · detected/);
    await page.screenshot({ path: `${out}/keybpm-correction-desktop.png`, fullPage: true });
    return `${before.trim()} → ${after.trim()}`;
  });
  await check('original audio audition plays and pauses', async () => {
    await page.getByRole('button', { name: /^Play sattari-practice-demo/ }).click();
    await page.waitForFunction(
      () => {
        const audio = document.querySelector('audio');
        return audio && !audio.paused && audio.currentTime > 0.2;
      },
      null,
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert(await page.evaluate(() => document.querySelector('audio').paused));
  });
  const [reportDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save report' }).click(),
  ]);
  const report = await readDownload(reportDownload);
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  const csv = (await readDownload(csvDownload)).bytes.toString('utf8');
  await check('CSV keeps detected columns and adds correction columns', async () => {
    const [header, row] = csv.trim().split('\r\n');
    assert(header.startsWith('"File","Duration (s)","Key"'));
    assert(header.includes('"Corrected BPM","BPM correction"'));
    assert(row.includes('"half"'));
  });
  for (const [label, width, height] of [
    ['phone', 390, 844],
    ['tablet', 768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${out}/keybpm-${label}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });

  await check('a reload does not claim a transfer that no longer exists', async () => {
    await page.reload();
    await page.getByRole('heading', { name: /Key & BPM/ }).waitFor();
    assert.equal(await page.getByText(/Added from Stem Separator/).count(), 0);
  });
  await check('Key & BPM keeps results, correction and audio after a reload', async () => {
    const row = page.locator('tr[data-status="done"]').first();
    await row.waitFor({ timeout: 30000 });
    assert.match(await row.textContent(), /half time · detected 120/);
    assert(await page.getByRole('button', { name: /^Play sattari-practice-demo/ }).isEnabled());
  });

  await check(
    'report round trip in a fresh context keeps the correction, without audio',
    async () => {
      const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const other = await fresh.newPage();
      await other.goto(`${base}/studio/keybpm`);
      await other.getByLabel('Open analysis report').setInputFiles(report.path);
      await other.getByText('Report · audio not included').waitFor({ timeout: 30000 });
      const text = await other.locator('tbody tr').first().textContent();
      assert.match(text, /half time · detected/);
      assert(
        await other
          .getByRole('button', { name: /choose the source file again to listen/ })
          .isDisabled()
      );
      await other.getByLabel('Open analysis report').setInputFiles({
        name: 'broken.keybpm.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"schema":"SattariKeyBpm.report","version":2,"tracks":[{}]}'),
      });
      await other.getByText(/Existing tracks were not changed/).waitFor();
      assert.equal(await other.locator('tbody tr').count(), 1);
      await fresh.close();
    }
  );

  await check('a shared ?goal= link opens with that goal selected', async () => {
    await page.goto(`${base}/stem-separator?goal=bass-practice`);
    await page.getByRole('radio', { name: /Bass practice/ }).waitFor();
    assert(await page.getByRole('radio', { name: /Bass practice/ }).isChecked());
  });

  await check('Clear saved work removes saved songs after confirmation', async () => {
    await page.goto(`${base}/stem-separator`);
    await page.getByRole('button', { name: 'Download my mix' }).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Clear saved work' }).click();
    await page.getByRole('button', { name: 'Remove saved work' }).click();
    await page.getByText('Saved songs and stems were removed from this browser.').waitFor();
    await page.reload();
    await page.getByText('No songs yet').waitFor({ timeout: 60000 });
  });
} catch (error) {
  record('qualification run', false, error.message);
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
} finally {
  record('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
  environment.finishedAt = new Date().toISOString();
  await writeFile(`${out}/results.json`, JSON.stringify({ environment, results }, null, 2));
  await browser.close();
}
const failed = results.filter((result) => !result.pass);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed. Evidence: ${out}`
);
process.exit(failed.length ? 1 : 0);
