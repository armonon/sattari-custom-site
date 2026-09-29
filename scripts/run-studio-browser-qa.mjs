// Audio checks use source modules; UI checks exercise the already-built deploy artifact.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.env.STUDIO_BROWSER_OUTPUT || '/tmp/stemdeck-browser-qa');
await mkdir(output, { recursive: true });
const children = new Set();
async function requireFreePort(port) {
  await new Promise((resolveFree, reject) => {
    const probe = createServer();
    probe.once('error', () =>
      reject(new Error(`QA port ${port} is occupied; refusing to test an unrelated server.`))
    );
    probe.listen(port, '127.0.0.1', () => probe.close(resolveFree));
  });
}
function run(args, extra = {}) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extra },
  });
  children.add(child);
  const done = new Promise((resolveDone, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      children.delete(child);
      resolveDone(code ?? 1);
    });
  });
  return { child, done };
}
async function ready(url, child) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`QA server exited before readiness: ${url}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* server starting */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`QA server readiness timed out: ${url}`);
}
try {
  await Promise.all([requireFreePort(4192), requireFreePort(4193)]);
  const audio = run(['node_modules/vite/bin/vite.js', '--config', 'vite.qa.config.mjs']);
  const preview = run([
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4193',
    '--strictPort',
  ]);
  await Promise.all([
    ready('http://127.0.0.1:4192/scripts/input-audio-qa.html', audio.child),
    ready('http://127.0.0.1:4193/studio', preview.child),
  ]);
  // UI imports and offline renders must not compete with the live audio deadline tests.
  const audioStatus = await run(['scripts/run-studio-audio-qa.mjs', 'http://127.0.0.1:4192'], {
    STUDIO_QA_REPORT: resolve(output, 'audio.json'),
  }).done;
  const uiStatus = await run([
    'scripts/session-ui-qa.mjs',
    'http://127.0.0.1:4193',
    resolve(output, 'ui'),
  ]).done;
  const learnStatus = await run(['scripts/qualify-learn-review.mjs'], {
    LEARN_QA_URL: 'http://127.0.0.1:4192',
    LEARN_QA_OUTPUT: resolve(output, 'learn'),
  }).done;
  const checks = [audioStatus, uiStatus, learnStatus];
  if (checks.some((code) => code !== 0)) process.exitCode = 1;
} finally {
  for (const child of children) child.kill('SIGTERM');
}
