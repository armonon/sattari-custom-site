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
  const results = {};
  for (const [name, query] of [['master-pro-browser',''],['windowed-replay',''],['windowed-replay','?slow-decode'],['live-window','?slow-decode']]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => {console.error(error);process.exitCode=1;});
    await page.goto(`${origin}/scripts/${name}-qa.html${query}`);
    if(name === 'master-pro-browser') await page.locator('#run').click();
    await page.waitForFunction(() => window.qaResult || /\d+ passed[,;]|"complete"/.test(document.querySelector('#result')?.textContent || ''), null, {timeout:180000});
    const output=await page.locator('#result').innerText();
    results[name+query] = output;
    console.log(name+query, output);
    if(/FAIL|[1-9]\d* failed/.test(output) || (output.startsWith('{') && !JSON.parse(output).pass))process.exitCode=1;
    await context.close();
  }
  await writeFile('/tmp/master-gain-diagnostic.json', JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  const stopped = new Promise(resolve => server.once('exit', resolve));
  server.kill('SIGTERM');
  await stopped;
}
