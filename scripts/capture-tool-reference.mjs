import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.RESOURCE_QA_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Capture references from the local app only.');
await mkdir('public/images/tools', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('sattari-theme-pref-v1', 'night');
    localStorage.setItem('sattari-measurement-v1', 'denied');
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/stem-separator`);
  await page.getByLabel('Add audio tracks').setInputFiles('public/audio/sattari-practice-demo.wav');
  await page.getByRole('heading', { name: 'sattari-practice-demo.wav', exact: true }).waitFor();
  await page.screenshot({ path: 'public/images/tools/separator.jpg', type: 'jpeg', quality: 90 });
  await page.goto(`${base}/learn`);
  await page.locator('input[type="file"]').setInputFiles('public/audio/sattari-practice-demo.wav');
  await page.getByRole('button', { name: /Analyze & teach/i }).click();
  await page.getByText('Local analysis', { exact: true }).waitFor({ timeout: 90000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.learn-command-grid').screenshot({ path: 'public/images/tools/learn.jpg', type: 'jpeg', quality: 90 });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${base}/studio`);
  await page
    .locator('.sd-app-frame > input[type="file"][accept="audio/*"]')
    .setInputFiles('public/audio/sattari-practice-demo.wav');
  await page.getByText(/sattari-practice-demo.wav is ready in Deck/).waitFor({ timeout: 90000 });
  await page.screenshot({ path: 'public/images/tools/studio.jpg', type: 'jpeg', quality: 90 });
  assert.deepEqual(errors, []);
  console.log('Captured real Separator queue, completed Learn analysis and loaded Studio deck.');
} finally {
  await browser.close();
}
