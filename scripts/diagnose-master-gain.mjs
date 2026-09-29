import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.qa.config.mjs'], { stdio: 'inherit' });
let browser;
try {
  const origin = 'http://127.0.0.1:4192';
  const deadline = Date.now() + 60000;
  while (true) {
    try { if ((await fetch(origin)).ok) break; } catch { /* starting */ }
    if (Date.now() > deadline) throw new Error('Vite readiness timed out');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({headless:true,args:['--mute-audio']});
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error));
  const results = {};
  for (const name of ['master-pro-browser', 'master-gain-diagnostic']) {
    await page.goto(`${origin}/scripts/${name}-qa.html`);
    await page.locator('#run').click();
    await page.waitForFunction(() => /\d+ passed[,;]|"complete"/.test(document.querySelector('#result')?.textContent || ''), null, {timeout:120000});
    results[name] = await page.locator('#result').innerText();
    console.log(name, results[name]);
  }
  await writeFile('/tmp/master-gain-diagnostic.json', JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  const stopped = new Promise(resolve => server.once('exit', resolve));
  server.kill('SIGTERM');
  await stopped;
}
