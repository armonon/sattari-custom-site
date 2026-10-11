import { chromium } from '/Users/lillypad/Projects/scene-account-20261010/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const out = new URL('./', import.meta.url).pathname;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
try {
  await p.goto(new URL('/studio', process.env.STUDIO_ORIGIN || 'http://127.0.0.1:4203').href);
  await p.getByRole('button', { name: 'Add source', exact: true }).waitFor();
  const wav = Buffer.alloc(44 + 48000 * 4 * 2);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 48000 * 4; i++)
    wav.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 220) / 48000) * 6000), 44 + i * 2);
  const files = ['Pulse', 'Texture', 'Voice', 'Percussion'].map((name) => ({
    name: name + '.wav',
    mimeType: 'audio/wav',
    buffer: wav,
  }));
  const inputs = p.locator('input[type=file][multiple]');

  await inputs.filter({ visible: false }).last().setInputFiles(files);
  await p
    .getByRole('article', { name: 'Deck D overview' })
    .getByRole('button', { name: 'Play Deck D' })
    .waitFor();
  await p.waitForFunction(
    () =>
      document.querySelectorAll('.sd-overview-deck h3').length === 4 &&
      [...document.querySelectorAll('.sd-overview-deck h3')].every(
        (x) => x.textContent !== 'Add a track'
      )
  );
  await p.getByRole('button', { name: 'No thanks', exact: true }).click();
  for (const id of ['A', 'B', 'C', 'D']) {
    const card = p.getByRole('article', { name: `Deck ${id} overview` });
    for (const stem of ['Vocals', 'Drums', 'Bass', 'Music']) {
      const chooser = p.waitForEvent('filechooser');
      await card.getByRole('button', { name: stem, exact: true }).click();
      await (await chooser).setFiles({ name: stem + '.wav', mimeType: 'audio/wav', buffer: wav });
      await card.getByRole('slider', { name: `Deck ${id} ${stem} level` }).waitFor();
      await p.waitForFunction(
        ({ id, stem }) =>
          !document.querySelector(`[aria-label="Deck ${id} ${stem} level"]`).disabled,
        { id, stem }
      );
    }
  }
  const a = p.getByRole('article', { name: 'Deck A overview' });
  await a.getByRole('slider', { name: 'Deck A Vocals level' }).fill('65');
  await a.getByRole('button', { name: 'Mute Deck A Drums' }).click();
  await a.getByRole('button', { name: 'Play Deck A', exact: true }).click();
  await a.getByRole('button', { name: 'Pause Deck A', exact: true }).waitFor();
  await p.waitForFunction(
    () => document.querySelector('.sd-overview-time span').textContent !== '0:00'
  );
  await a.getByRole('button', { name: 'Pause Deck A', exact: true }).click();
  await p.screenshot({ path: out + 'desktop.png', fullPage: true });
  await a.getByRole('button', { name: 'Open Deck A controls' }).click();
  await p.getByRole('article', { name: 'Deck A', exact: true }).waitFor();
  await p.getByRole('button', { name: 'All four decks', exact: true }).click();
  const download = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Save project file', exact: true }).click();
  const file = await download;
  await file.saveAs(out + 'four-decks.sattari');
  const project = await readFile(out + 'four-decks.sattari');
  assert.equal(project.subarray(0, 8).toString(), 'SATPROJ6');
  await a.getByRole('slider', { name: 'Deck A Vocals level' }).fill('30');
  p.on('dialog', (d) => d.accept());
  await p
    .locator('input[accept="application/json,.json,.sattari"]')
    .setInputFiles(out + 'four-decks.sattari');
  await p.waitForFunction(
    () => document.querySelector('[aria-label="Deck A Vocals level"]')?.value === '65'
  );
  assert.equal(
    await p.getByRole('button', { name: 'Mute Deck A Drums' }).getAttribute('aria-pressed'),
    'true'
  );
  const widths = [];
  for (const width of [1440, 1024, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    await p.screenshot({ path: out + `overview-${width}.png`, fullPage: true });
    const size = await p.evaluate(() => ({
      viewport: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(size.scroll <= width, JSON.stringify(size));
    widths.push(size);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    out + 'browser.json',
    JSON.stringify(
      {
        pass: true,
        widths,
        checks: [
          'four deck imports',
          '16 prepared stem imports',
          'playback advances',
          'stem level and mute',
          'detailed controls switch',
          'embedded audio project save/reopen',
          'responsive widths',
        ],
        errors,
      },
      null,
      2
    )
  );
  console.log('PASS');
} catch(error) {
  await p.screenshot({path:out+'failure.png',fullPage:true});
  console.log((await p.locator('body').innerText()).slice(0,7000));
  throw error;
} finally {
  await b.close();
}
