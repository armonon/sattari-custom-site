// Real local Pocket UI and browser storage with synthetic patterns; no physical capture.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  starterPattern,
  STORAGE_KEY,
  DRAFT_KEY,
  MAX_SAVED,
} from '../src/labs/pocket/pocketPattern.js';
const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.POCKET_CHECK_URL || 'http://127.0.0.1:4188';
assert.equal(new URL(base).hostname, '127.0.0.1');
const out = resolve(process.env.POCKET_REPORT_DIR || 'test-results/pocket-persistence');
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'pocket-check-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  acceptDownloads: true,
  viewport: { width: 1440, height: 1000 },
  ...(process.env.POCKET_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.POCKET_CHROMIUM_EXECUTABLE }
    : {}),
});
let page = await context.newPage();
const errors = [],
  checks = [],
  hash = (b) => createHash('sha256').update(b).digest('hex');
page.on('pageerror', (e) => errors.push(e.message));
const report = {
  observed_at: new Date().toISOString(),
  source_sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_hashes: {},
  browser: context.browser().version(),
  scope:
    'Local Chromium real storage/UI and synthetic Web Audio export; not physical audio, mobile hardware or deployed-artifact qualification.',
  checks,
  pass: false,
};
for (const f of [
  'src/labs/pocket/PocketPage.jsx',
  'src/labs/pocket/pocketPattern.js',
  'scripts/pocket-persistence-check.mjs',
])
  report.source_hashes[f] = hash(await readFile(f));
const checkpoint = async (name, run) => {
  await run();
  checks.push({ name, status: 'PASS' });
  console.log('PASS', name);
};
const go = async () => {
  await page.goto(base + '/studio/pocket', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Name', { exact: true }).waitFor();
};
const saved = () => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
try {
  await go();
  await checkpoint(
    'named beat save, actual close/reopen and editable drum/bass state',
    async () => {
      await page.getByLabel('Name', { exact: true }).fill('Qualification beat');
      await page.getByRole('button', { name: 'Kick step 2', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page
        .locator('.lab-status[role=status]')
        .filter({ hasText: 'Saved “Qualification beat”' })
        .waitFor();
      const before = JSON.parse(await saved());
      assert.equal(before[0].drums.kick[1], true);
      await page.close();
      page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await go();
      await page.getByRole('button', { name: 'Qualification beat · 92', exact: true }).click();
      assert.equal(
        await page.getByLabel('Name', { exact: true }).inputValue(),
        'Qualification beat'
      );
      assert.equal(
        await page
          .getByRole('button', { name: 'Kick step 2', exact: true })
          .getAttribute('aria-pressed'),
        'true'
      );
      assert.deepEqual(JSON.parse(await saved()), before);
    }
  );
  await checkpoint(
    'real synthesis starts and user WAV export is non-silent stereo24-bit at correct duration',
    async () => {
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.locator('.is-playhead').first().waitFor();
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      await page.getByRole('button', { name: '1 bar', exact: true }).click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'WAV loop', exact: true }).click(),
      ]);
      await download.saveAs(join(out, 'qualification.wav'));
      assert.equal(await download.failure(), null);
      const b = await readFile(join(out, 'qualification.wav'));
      assert.equal(b.toString('ascii', 0, 4), 'RIFF');
      assert.equal(b.toString('ascii', 8, 12), 'WAVE');
      const chunks = {};
      for (let at = 12; at + 8 <= b.length; ) {
        const n = b.readUInt32LE(at + 4);
        chunks[b.toString('ascii', at, at + 4)] = b.subarray(at + 8, at + 8 + n);
        at += 8 + n + (n % 2);
      }
      assert.equal(chunks['fmt '].readUInt16LE(0), 1);
      assert.equal(chunks['fmt '].readUInt16LE(2), 2);
      assert.equal(chunks['fmt '].readUInt16LE(14), 24);
      const rate = chunks['fmt '].readUInt32LE(4),
        frames = chunks.data.length / 6;
      assert.ok(Math.abs(frames / rate - 240 / 92) < 1 / rate);
      assert.ok(chunks.data.some((n) => n !== 0));
      report.wav = { sha256: hash(b), rate, frames, seconds: frames / rate, channels: 2, bits: 24 };
    }
  );
  await checkpoint(
    '41st named save refuses with every previous byte intact; same-name update works',
    async () => {
      const data = JSON.stringify(
        Array.from({ length: MAX_SAVED }, (_, i) => ({ ...starterPattern(), name: `Saved ${i}` }))
      );
      await page.evaluate(({ key, data }) => localStorage.setItem(key, data), {
        key: STORAGE_KEY,
        data,
      });
      await page.reload();
      await page.getByLabel('Name', { exact: true }).fill('Forty first');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'slots are full' }).waitFor();
      assert.equal(await saved(), data);
      await page.getByRole('button', { name: 'Saved 0 · 92', exact: true }).click();
      await page.getByRole('button', { name: 'Kick step 2', exact: true }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const updated = JSON.parse(await saved());
      assert.equal(updated.length, MAX_SAVED);
      assert.equal(updated[0].name, 'Saved 0');
      assert.equal(updated[0].drums.kick[1], true);
    }
  );
  await checkpoint(
    'corrupt named library and draft are not overwritten by save or autosave',
    async () => {
      await page.evaluate(
        ({ key, draft }) => {
          localStorage.setItem(key, '{recoverable library');
          localStorage.setItem(draft, '{recoverable draft');
        },
        { key: STORAGE_KEY, draft: DRAFT_KEY }
      );
      await page.reload();
      await page.getByLabel('Name', { exact: true }).fill('Current unsaved work');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Draft not saved' }).waitFor();
      assert.equal(await saved(), '{recoverable library');
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY),
        '{recoverable draft'
      );
      assert.equal(
        await page.getByLabel('Name', { exact: true }).inputValue(),
        'Current unsaved work'
      );
    }
  );
  await checkpoint(
    'semantically corrupt musical data is preserved and recoverable by real backup download',
    async () => {
      const rawDraft = JSON.stringify({ ...starterPattern(), drums: null });
      const rawLibrary = JSON.stringify([{ ...starterPattern(), bass: [0, null] }]);
      await page.evaluate(
        ({ key, draft, rawDraft, rawLibrary }) => {
          localStorage.setItem(key, rawLibrary);
          localStorage.setItem(draft, rawDraft);
        },
        { key: STORAGE_KEY, draft: DRAFT_KEY, rawDraft, rawLibrary }
      );
      await page.reload();
      await page.getByRole('alert').filter({ hasText: 'Draft not saved' }).waitFor();
      await page.getByLabel('Name', { exact: true }).fill('Keep current edits');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      assert.equal(await saved(), rawLibrary);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY), rawDraft);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page
          .getByRole('button', { name: 'Download stored-data recovery backup', exact: true })
          .click(),
      ]);
      await download.saveAs(join(out, 'pocket-storage-backup.json'));
      const backup = JSON.parse(await readFile(join(out, 'pocket-storage-backup.json'), 'utf8'));
      assert.deepEqual(backup, {
        format: 'pocket-storage-backup',
        version: 1,
        library: rawLibrary,
        draft: rawDraft,
      });
    }
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, 'phone-errors.png'), fullPage: true });
  report.phoneOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth
  );
  assert.deepEqual(errors, []);
  report.pass = true;
} catch (e) {
  report.error = e.stack;
  await page.screenshot({ path: join(out, 'failure.png'), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.errors = errors;
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
  await context.close();
  console.log(JSON.stringify(report, null, 2));
}
