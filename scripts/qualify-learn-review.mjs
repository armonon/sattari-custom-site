import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LEARN_QA_URL || 'http://127.0.0.1:5190';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('Learn review qualification must run locally.');
}
const output = process.env.LEARN_QA_OUTPUT || '/tmp/sattari-learn-review-fixes';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--mute-audio'],
});
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      localStorage.setItem('sattari-measurement-v1', 'denied');
      window.qaTaps = [];
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...args) {
        if (destination instanceof AudioDestinationNode) {
          const analyser = this.context.createAnalyser();
          connect.call(this, analyser);
          window.qaTaps.push(analyser);
        }
        return connect.call(this, destination, ...args);
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/learn`);
    await page.getByRole('tab', { name: 'Practice', exact: true }).click();
    await page.getByRole('button', { name: 'Bass', exact: true }).click();
    await page.getByRole('button', { name: 'Start Play the roots', exact: true }).click();
    await page.getByRole('heading', { name: 'Play the roots', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('tab', { name: 'Bass', exact: true }).getAttribute('aria-selected'),
      'true'
    );
    await page.getByRole('button', { name: 'Play arrangement', exact: true }).click();
    await page.getByRole('button', { name: 'Pause arrangement', exact: true }).waitFor();
    await page.waitForFunction(() => {
      const audible = window.qaTaps.filter((tap) => {
        const samples = new Float32Array(tap.fftSize);
        tap.getFloatTimeDomainData(samples);
        return samples.some((sample) => Math.abs(sample) > 0.001);
      });
      window.qaPracticeContexts = [...new Set(audible.map((tap) => tap.context))];
      return window.qaPracticeContexts.length > 0;
    });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false
    );
    await page.screenshot({ path: `${output}/practice-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Mark practiced', exact: true }).click();
    await page.getByRole('heading', { name: 'Practice marked complete' }).waitFor();
    await page.waitForFunction(
      () =>
        window.qaPracticeContexts.length > 0 &&
        window.qaPracticeContexts.every((ctx) => ctx.state === 'closed')
    );
    await page.getByRole('button', { name: 'Next exercise', exact: true }).click();
    await page.getByRole('heading', { name: 'Lead the changes', exact: true }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Play arrangement', exact: true }).count(),
      1
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px: exercise opens, actual audible PCM, completion stops audio, next exercise, no overflow`
    );
    await context.close();
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await context.route(/\/src\/utils\/audioAnalysis(?:\.js)?(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `export const detectPitch = () => null;
      export const analyzeAudioFile = () => new Promise(resolve => {
        window.qaFinishAnalysis = () => resolve({ key: 'D minor' });
      });`,
    })
  );
  await page.goto(`${base}/learn`);
  const buffer = await readFile(
    new URL('../public/audio/sattari-practice-demo.wav', import.meta.url)
  );
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({ name: 'first.wav', mimeType: 'audio/wav', buffer });
  await page.getByRole('button', { name: 'Analyze & teach', exact: true }).click();
  await page.waitForFunction(() => typeof window.qaFinishAnalysis === 'function');
  await input.setInputFiles({ name: 'second.wav', mimeType: 'audio/wav', buffer });
  await page.evaluate(() => window.qaFinishAnalysis());
  assert.equal(await page.getByText('D minor', { exact: true }).count(), 0);
  assert.match(await page.locator('.learn-track-copy').innerText(), /second/);
  await page.getByRole('button', { name: 'Analyze & teach', exact: true }).waitFor();
  console.log('PASS stale analysis does not replace the new source');

  await page.getByRole('tab', { name: 'Challenge', exact: true }).click();
  await page.evaluate(() => {
    window.qaContext = new AudioContext();
    window.qaStream = window.qaContext.createMediaStreamDestination().stream;
    navigator.mediaDevices.getUserMedia = () =>
      new Promise((resolve) => {
        window.qaGrantPermission = () => resolve(window.qaStream);
      });
  });
  await page.getByRole('button', { name: /Microphone Start live pitch detection/ }).click();
  await page.waitForFunction(() => typeof window.qaGrantPermission === 'function');
  await page.getByRole('link', { name: 'Hub', exact: true }).click();
  await page.waitForURL('**/hub');
  await page.evaluate(() => window.qaGrantPermission());
  await page.waitForFunction(() =>
    window.qaStream.getTracks().every((track) => track.readyState === 'ended')
  );
  await page.evaluate(() => window.qaContext.close());
  console.log(
    'PASS late permission grant stops its synthetic stream after navigation; no real microphone used'
  );
  await context.unrouteAll();
  await page.goto(`${base}/studio`);
  await page.locator('#studio-workspace').waitFor({ timeout: 120000 });
  assert.equal(await page.getByRole('main').count(), 1);
  assert.equal(
    await page.getByRole('region', { name: 'Studio workspace', exact: true }).count(),
    1
  );
  await page.getByRole('link', { name: 'Skip to workspace' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(
    await page.locator('#studio-workspace').evaluate((node) => document.activeElement === node),
    true
  );
  console.log('PASS Studio has one main landmark and its skip link moves focus');
  await context.close();
} finally {
  await browser.close();
}
