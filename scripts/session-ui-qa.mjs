// Generated media in an isolated context; never touch an open session or microphone.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { releaseProjectFixture } from './studio-ui-fixture.mjs';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:4193');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))
  throw new Error('UI QA requires an isolated local origin.');
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
    : 'playwright'
);
const output = resolve(process.argv[3] || '/tmp/stemdeck-session-qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
// Visible area after clipping, not just a DOM box hidden behind an overflow parent.
async function geometry(locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    let top = Math.max(0, box.top),
      bottom = Math.min(innerHeight, box.bottom);
    let left = Math.max(0, box.left),
      right = Math.min(innerWidth, box.right);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent),
        rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        top = Math.max(top, rect.top);
        bottom = Math.min(bottom, rect.bottom);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        left = Math.max(left, rect.left);
        right = Math.min(right, rect.right);
      }
    }
    return {
      top: box.top,
      height: box.height,
      visibleHeight: Math.max(0, bottom - top),
      visibleWidth: Math.max(0, right - left),
    };
  });
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 615, height: 988 },
    { width: 390, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    // The unrelated shop API is not served by Vite preview; studio remains real.
    await context.route('**/api/inventory', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"stock":{}}' })
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('dialog', (dialog) => dialog.accept());
    const row = { width: viewport.width, pass: false, mockedEndpoints: ['/api/inventory'], errors };
    results.push(row);
    try {
      await page.goto(new URL('/studio', origin).href, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      await page.getByText('Local session', { exact: true }).waitFor({ state: 'attached' });
      await page.locator('input[accept="application/json,.json,.sattari"]').setInputFiles({
        name: 'session-integrity.sattari',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(releaseProjectFixture())),
      });
      await page
        .getByText('Session Integrity QA', { exact: true })
        .first()
        .waitFor({ state: 'attached' });
      const navigate = (name) =>
        page
          .getByRole('navigation', { name: 'STEMDECK workspaces' })
          .getByRole('button', { name, exact: true })
          .click();
      const overflows = () =>
        page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const mixerToggle = page
        .getByRole('navigation', { name: 'STEMDECK workspaces' })
        .getByRole('button', { name: 'Mixer', exact: true });
      for (const view of ['Perform', 'Library', 'Arrange']) {
        await navigate(view);
        await page.screenshot({ path: `${output}/${viewport.width}-${view}.png` });
        assert.equal(await overflows(), false, `${view} overflows horizontally`);
        if (view !== 'Perform') continue;
        // The mixer docks under the workspace: every track gets a channel, and
        // the dock scrolls inside itself rather than widening the page.
        await mixerToggle.click();
        const dock = page.getByRole('region', { name: 'Mixer', exact: true });
        await dock.waitFor();
        await page.screenshot({ path: `${output}/${viewport.width}-Mixer.png` });
        assert.equal(await overflows(), false, 'Mixer dock overflows horizontally');
        assert.equal(
          await dock.getByRole('group', { name: 'Tracks', exact: true }).getByRole('group').count(),
          6,
          'one mixer channel per imported track'
        );
        await mixerToggle.click();
        await dock.waitFor({ state: 'detached' });
      }
      await page.getByRole('button', { name: 'Select clip QA melody', exact: true }).waitFor();
      const clipLabel = await page
        .locator('.ae-clip strong')
        .first()
        .evaluate((label) => ({
          height: label.clientHeight,
          contentHeight: label.scrollHeight,
        }));
      assert.ok(clipLabel.height >= 16, 'clip title retains a readable line height');
      assert.ok(
        clipLabel.contentHeight <= clipLabel.height,
        'clip title is not vertically cropped'
      );
      assert.equal(
        await page.locator('input[aria-label^="Track name QA "]').count(),
        6,
        'six imported tracks'
      );
      row.timeline = await geometry(
        page.getByRole('region', { name: 'Arrangement timeline', exact: true })
      );
      row.workspace = await geometry(page.locator('#studio-workspace'));
      row.notice = await geometry(page.locator('.sd-notice > summary'));
      assert.ok(row.notice.visibleHeight >= 28, 'session status stays readable');
      assert.ok(
        row.notice.top >= row.workspace.top + row.workspace.visibleHeight,
        'session status occupies its own row without covering workspace controls'
      );
      if (viewport.width <= 700) {
        row.trackHeader = await geometry(page.locator('.ae-track-head').first());
        assert.ok(row.trackHeader.height <= 160, 'compact track header preserves timeline density');
        const options = page.locator('.ae-track-options').first();
        await options.locator('summary').click();
        assert.ok(
          await options.locator('input[type="number"]').isVisible(),
          'track gain remains reachable'
        );
        assert.ok(
          await options.locator('input[type="range"]').isVisible(),
          'track pan remains reachable'
        );
        await options.locator('summary').click();
      }
      assert.ok(row.timeline.top < viewport.height * 0.45, 'timeline must appear immediately');
      assert.ok(
        row.timeline.visibleHeight >= (viewport.width < 600 ? 240 : 360),
        'timeline has a useful visible height'
      );
      if (viewport.width >= 600)
        assert.ok(
          row.timeline.visibleHeight >= row.workspace.visibleHeight * 0.5,
          'timeline owns at least half the desktop workspace'
        );
      const play = page.getByRole('button', { name: 'Play arrangement', exact: true });
      row.transport = await geometry(play);
      assert.ok(
        row.transport.visibleHeight >= 24 && row.transport.visibleWidth >= 24,
        'transport remains reachable'
      );
      await play.click();
      await page.getByRole('button', { name: 'Pause arrangement', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Pause arrangement', exact: true }).click();
      await page.getByRole('button', { name: 'Select clip QA melody', exact: true }).click();
      const notes = page.getByRole('region', {
        name: 'Piano notes, scroll to change pitch or time',
        exact: true,
      });
      await notes.waitFor();
      row.notes = await geometry(notes);
      row.editorLayout = await page.locator('.ae-workspace-focused').evaluate((root) =>
        ['.ae-lower-editor', '.ae-scroll', '.ae-note-scroll'].map((selector) => {
          const element = root.querySelector(selector),
            style = getComputedStyle(element);
          return {
            selector,
            height: element.getBoundingClientRect().height,
            flex: style.flex,
            minHeight: style.minHeight,
            maxHeight: style.maxHeight,
          };
        })
      );
      assert.ok(
        row.notes.visibleHeight >= 200 && row.notes.visibleWidth >= 240,
        'opening MIDI reveals a useful note canvas without page scrolling'
      );
      const visibleNote = page.getByRole('button', { name: /Select C4 note/ }).first();
      row.note = await geometry(visibleNote);
      assert.ok(
        row.note.visibleHeight > 5 && row.note.visibleWidth > 5,
        'actual editable notes are visible'
      );
      await page.screenshot({ path: `${output}/${viewport.width}-Piano.png` });
      const back = page.getByRole('button', { name: '← Arrangement', exact: true });
      if (await back.isVisible()) await back.click();
      else await page.getByRole('button', { name: 'Close instrument editor', exact: true }).click();
      row.exports = [];
      for (const [label, signature] of [
        ['Export mixdown', 'RIFF'],
        ['Export track stems', 'PK'],
      ]) {
        const menu = page.locator('details.ae-edit-tools');
        if (!(await menu.getAttribute('open')) && (await menu.getAttribute('open')) !== '')
          await menu.locator('summary').click();
        const downloadReady = page.waitForEvent('download', { timeout: 120000 });
        await page.getByRole('button', { name: label, exact: true }).click();
        const download = await downloadReady;
        const path = await download.path();
        const bytes = await readFile(path);
        assert.equal(
          bytes.subarray(0, signature.length).toString(),
          signature,
          `${label} has a valid container header`
        );
        assert.ok(bytes.length > 1000, `${label} is nonempty`);
        row.exports.push({ label, bytes: bytes.length, filename: download.suggestedFilename() });
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page
        .getByText('Session Integrity QA', { exact: true })
        .first()
        .waitFor({ state: 'attached' });
      await navigate('Arrange');
      await page.getByRole('button', { name: 'Select clip QA melody', exact: true }).waitFor();
      assert.equal(
        await page.locator('input[aria-label^="Track name QA "]').count(),
        6,
        'six tracks survive reload'
      );
      assert.deepEqual(errors, [], 'no fatal browser/console errors');
      row.pass = true;
    } catch (error) {
      row.error = error.message;
      await page.screenshot({ path: `${output}/${viewport.width}-failure.png` }).catch(() => {});
    } finally {
      await context.close();
    }
    console.log(JSON.stringify(row));
  }
} finally {
  await browser.close();
}
await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2));
if (results.some((row) => !row.pass)) process.exitCode = 1;
