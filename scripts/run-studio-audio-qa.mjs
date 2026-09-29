// Generated PCM only, isolated browser storage, no microphone/speaker access.
// Start an isolated Vite server, then:
// PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs node scripts/run-studio-audio-qa.mjs http://127.0.0.1:4194
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:4194');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname))
  throw new Error('Audio QA must use a local isolated origin, never a production session.');
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
    : 'playwright'
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
const checks = [
  ['compressed-window', null],
  ['windowed-replay', null],
  ['windowed-replay', null, '?slow-decode'],
  ['grain-stall', null],
  ['live-window', null],
  ['live-window', null, '?slow-decode'],
  ['input-audio', null],
  ['input-recording', null],
  ['sync-audio', '#run'],
  ['master-pro-browser', '#run'],
  ['rack-browser', '#run'],
  ['arrangement-browser', '#run'],
  ['reference-lifecycle', '#run'],
  ['loudness-tempo', '#run'],
  ['performance-recovery', '#run'], // includes the 60-second recording soak
];
const results = [];
try {
  for (const [name, button, query = ''] of checks) {
    const label = name + query;
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(new URL(`/scripts/${name}-qa.html${query}`, origin).href, { timeout: 90000 });
      if (button) await page.locator(button).click({ timeout: 90000 });
      await page.waitForFunction(
        (name) => {
          const value = document.querySelector('#result')?.textContent || '';
          if (name === 'performance-recovery') return value.includes('COMPLETE:');
          // A first failure is not completion: allow cleanup and later checks
          // to finish before closing the isolated context.
          return window.qaResult || /\d+ passed[,;]|COMPLETE:|"pass"\s*:/.test(value);
        },
        name,
        { timeout: 180000 }
      );
      const output = await page.locator('#result').innerText();
      let pass = !errors.length && !/FAIL|[1-9]\d* failed/.test(output);
      if (output.trim().startsWith('{')) pass &&= JSON.parse(output).pass === true;
      else pass &&= /[1-9]\d* passed/.test(output);
      results.push({ name: label, pass, output, errors });
    } catch (error) {
      results.push({
        name: label,
        pass: false,
        error: error.message,
        errors,
        output: await page
          .locator('#result')
          .innerText()
          .catch(() => ''),
      });
    } finally {
      await context.close();
    }
    console.log(JSON.stringify(results.at(-1)));
  }
} finally {
  await browser.close();
}
const report = {
  at: new Date().toISOString(),
  physicalHardwareMeasured: false,
  pass: results.length === checks.length && results.every((result) => result.pass),
  results,
};
await writeFile(
  resolve(process.env.STUDIO_QA_REPORT || '/tmp/stemdeck-audio-qa.json'),
  JSON.stringify(report, null, 2)
);
if (!report.pass) process.exitCode = 1;
