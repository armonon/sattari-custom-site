// Generated audio and isolated storage only: never records physical inputs.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { recordingPreflight } from './recording-preflight.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.env.STUDIO_BROWSER_OUTPUT || '/tmp/stemdeck-browser-qa');
await mkdir(output, { recursive: true });
const disk = await recordingPreflight(output, {
  seconds: 120,
  channels: 10,
  reserveBytes: 2 * 1024 ** 3,
});
await writeFile(resolve(output, 'soak-disk-preflight.json'), JSON.stringify(disk, null, 2));
if (!disk.pass) throw Error('Insufficient disk headroom; recording soak refused before capture.');
await new Promise((accept, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(4192, '127.0.0.1', () => probe.close(accept));
});
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--config', 'vite.qa.config.mjs'],
  { stdio: 'inherit' }
);
let browser;
let report;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error('Soak server exited before readiness.');
    if (
      await fetch('http://127.0.0.1:4192/scripts/windowed-replay-qa.html')
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      ready = true;
      break;
    }
    await new Promise((accept) => setTimeout(accept, 250));
  }
  if (!ready) throw Error('Soak server did not become ready.');
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE
      ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
      : 'playwright'
  );
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4192/scripts/windowed-replay-qa.html?soak=120');
  await page.waitForFunction(() => window.qaResult, {}, { timeout: 200000 });
  report = {
    ...(await page.evaluate(() => window.qaResult)),
    errors,
    physicalHardwareMeasured: false,
  };
  report.pass &&= errors.length === 0;
} catch (error) {
  report = { pass: false, error: error.stack, physicalHardwareMeasured: false };
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
await writeFile(resolve(output, 'windowed-soak.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (!report.pass) process.exitCode = 1;
