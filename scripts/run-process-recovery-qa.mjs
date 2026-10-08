// Real browser SIGKILL/restart and real Chromium quota rejection. Isolated synthetic data only.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4291');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))
  throw Error('Local isolated origin required');
const profile = await mkdtemp(join(tmpdir(), 'stemdeck-process-recovery-'));
let child, browser;
async function start() {
  child = spawn(
    process.env.CHROMIUM_EXECUTABLE || chromium.executablePath(),
    [
      '--headless',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Chromium launch timeout')), 30000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stderr.on('data', (data) => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(Error(`Chromium exited ${code}`));
    });
  });
  browser = await chromium.connectOverCDP(endpoint);
  report.browserVersion = browser.version();
  const page = await browser.contexts()[0].newPage();
  await page.goto(new URL('/scripts/process-recovery-qa.html', origin).href);
  await page.waitForFunction(() => !!window.qa);
  return page;
}
const report = {
  at: new Date().toISOString(),
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
  scope:
    'Actual Chromium process death and browser quota denial; not physical disk exhaustion or hardware qualification',
  profile,
  pass: false,
  checks: [],
};
try {
  let page = await start();
  const expected = await page.evaluate(() => window.qa.start());
  await page.waitForFunction(() => window.qa.health().durableAudioSeconds >= 5, null, {
    timeout: 30000,
  });
  expected.checkpoint = await page.evaluate(() => window.qa.checkpoint());
  const exited = new Promise((resolve) =>
    child.once('exit', (code, signal) => resolve({ code, signal }))
  );
  child.kill('SIGKILL');
  report.killed = await exited;
  page = await start();
  report.checks.push({
    name: 'SIGKILL while generated capture is active; reopen same profile',
    result: await page.evaluate((expected) => window.qa.recover(expected), expected),
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: origin.origin, quotaSize: 1 });
  report.checks.push({
    name: 'Actual quota denial preserves last-good session, audio and portable backup',
    result: await page.evaluate((expected) => window.qa.quota(expected), expected),
  });
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: origin.origin });
  await page.evaluate(() => window.qa.resumeCapture());
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: origin.origin, quotaSize: 1 });
  await page
    .waitForFunction(() => window.qa.captureState().finished, null, { timeout: 65000 })
    .catch(async (error) => {
      report.captureQuota = await page.evaluate(() => window.qa.captureState());
      throw error;
    });
  report.captureQuota = await page.evaluate(() => window.qa.captureState());
  if (!report.captureQuota.error)
    throw Error('Source capture stopped on actual quota exhaustion with no reported error');
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: origin.origin });
  report.quotaRecovered = await page.evaluate(() => window.qa.recoveredQuotaCapture());
  report.pass = true;
} catch (error) {
  report.error = error.stack;
} finally {
  await browser?.close().catch(() => {});
  if (child?.exitCode === null) child.kill('SIGTERM');
  await writeFile(
    resolve(process.env.STUDIO_RECOVERY_REPORT || '/tmp/stemdeck-process-recovery.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}
if (!report.pass) process.exitCode = 1;
